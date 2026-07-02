import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v3.0.0-atomic-rpc";
const DEPLOYED_AT = new Date().toISOString();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreateUserRequest {
  residence_id: string;
  email: string;
  password: string;
}

serve(async (req) => {
  console.log(`[${VERSION}] create-residence-portal-user request`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use EXTERNAL Supabase credentials
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error(`[${VERSION}] Missing external Supabase credentials:`, {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing external database credentials', _version: VERSION }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', _version: VERSION }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token', _version: VERSION }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if caller is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: caller.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role required', _version: VERSION }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { residence_id, email, password }: CreateUserRequest = await req.json();

    if (!residence_id || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields', _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message, _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = authData.user.id;

    try {
      console.log(`[${VERSION}] Created user ${newUserId}, assigning role...`);

      // 2 + 3 · Atomic role + portal write via RPC (returns readable errors).
      // Use the caller-scoped client so auth.uid() resolves inside the SECURITY
      // DEFINER function's admin check.
      const { data: rpcData, error: rpcError } = await supabaseUser.rpc(
        'admin_create_residence_portal',
        { _residence_id: residence_id, _user_id: newUserId, _email: email }
      );

      if (rpcError) {
        const msg = rpcError.message || rpcError.details || rpcError.hint || rpcError.code || 'Unknown Postgres error';
        console.error(`[${VERSION}] rpc failed`, rpcError);
        throw new Error(msg);
      }
      console.log(`[${VERSION}] rpc ok`, rpcData);

      console.log(`[${VERSION}] Portal account created successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUserId,
          residence_id,
          email,
          _version: VERSION
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (dbError: any) {
      // Rollback: Delete the auth user if DB insert failed
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      const msg = dbError?.message || dbError?.details || dbError?.hint || (typeof dbError === 'string' ? dbError : JSON.stringify(dbError));
      const isConflict = msg?.includes('already has') || msg?.includes('already in use');
      console.error(`[${VERSION}] dbError caught:`, msg, dbError);

      return new Response(
        JSON.stringify({ error: msg || 'Failed to create database records', _version: VERSION }),
        {
          status: isConflict ? 409 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error(`[${VERSION}] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
