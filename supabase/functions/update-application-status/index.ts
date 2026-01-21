import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusUpdateRequest {
  application_id: string;
  new_status: string;
  notes?: string;
}

const ALLOWED_STATUSES = [
  'new', 'submitted', 'docs_required', 'ready_for_review', 'under_review',
  'provisionally_approved', 'approved', 'declined', 'rejected', 'withdrawn', 'stale'
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create service role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: StatusUpdateRequest = await req.json();
    const { application_id, new_status, notes } = body;

    // Validate status
    if (!ALLOWED_STATUSES.includes(new_status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status: ${new_status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is authorized (residence portal user for this application)
    const { data: portalAccount, error: portalError } = await supabaseAdmin
      .from('residence_portal_accounts')
      .select('residence_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Also check if user is admin
    const { data: isAdmin } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!portalAccount && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to update applications' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the application
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('*, residences(name)')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if residence portal user is authorized for this specific application
    if (portalAccount && application.residence_id !== portalAccount.residence_id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this residence' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const old_status = application.status;
    const actor_type = portalAccount ? 'residence' : 'admin';

    // Update the application status
    const { error: updateError } = await supabaseAdmin
      .from('applications')
      .update({ 
        status: new_status, 
        notes: notes || application.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', application_id);

    if (updateError) {
      throw updateError;
    }

    // Log the activity
    await supabaseAdmin
      .from('application_activity_log')
      .insert({
        application_id,
        residence_id: application.residence_id,
        actor_user_id: user.id,
        actor_type,
        action_type: 'status_changed',
        metadata: { old_status, new_status, notes }
      });

    // CRITICAL: Create referral claim if provisionally_approved AND NSFAS funded
    if (new_status === 'provisionally_approved' && application.funding_type === 'nsfas') {
      // Check if claim already exists
      const { data: existingClaim } = await supabaseAdmin
        .from('referral_claims')
        .select('id')
        .eq('application_id', application_id)
        .single();

      if (!existingClaim) {
        // Create new referral claim
        const { error: claimError } = await supabaseAdmin
          .from('referral_claims')
          .insert({
            application_id,
            residence_id: application.residence_id,
            student_ref: application.student_profile?.student_number || null,
            funding_type: application.funding_type,
            claim_status: 'pending_nsfas',
            academic_year: new Date().getFullYear()
          });

        if (claimError) {
          console.error('Failed to create referral claim:', claimError);
        } else {
          // Log the claim creation
          await supabaseAdmin
            .from('application_activity_log')
            .insert({
              application_id,
              residence_id: application.residence_id,
              actor_user_id: user.id,
              actor_type: 'system',
              action_type: 'referral_claim_created',
              metadata: { funding_type: 'nsfas', status: 'pending_nsfas' }
            });
        }
      }

      // Send system message to student
      await supabaseAdmin
        .from('application_messages')
        .insert({
          application_id,
          residence_id: application.residence_id,
          sender_type: 'system',
          sender_user_id: null,
          message: `Congratulations! Your application has been provisionally approved by ${application.residences?.name || 'the residence'}. Please ensure you have all original documents ready for verification when you arrive. Follow any additional instructions provided by the residence.`
        });
    }

    // Send notification to student for status changes
    const statusMessages: Record<string, string> = {
      'docs_required': 'Your application requires additional documents. Please check your application for details.',
      'under_review': 'Your application is now under review. We will notify you once a decision is made.',
      'provisionally_approved': 'Great news! Your application has been provisionally approved!',
      'approved': 'Congratulations! Your application has been approved!',
      'declined': 'Unfortunately, your application has been declined. You may apply to other residences.',
      'rejected': 'Your application was not successful. Please consider other options.'
    };

    if (statusMessages[new_status]) {
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: application.user_id,
          type: 'application',
          title: `Application ${new_status.replace('_', ' ')}`,
          message: statusMessages[new_status],
          metadata: { 
            application_id, 
            residence_id: application.residence_id,
            new_status 
          }
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        old_status, 
        new_status,
        referral_claim_created: new_status === 'provisionally_approved' && application.funding_type === 'nsfas'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error updating application status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
