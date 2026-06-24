import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v2.0.0-external";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRefCode(appId: string): string {
  return appId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString('en-ZA')}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50);
}

serve(async (req) => {
  console.log(`[${VERSION}] download-handover-pack request`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use EXTERNAL Supabase credentials
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error(`[${VERSION}] Missing external Supabase credentials`);
      return new Response(
        JSON.stringify({ error: 'Server configuration error', _version: VERSION }),
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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', _version: VERSION }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin
    const { data: isAdmin } = await supabaseAdmin
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required', _version: VERSION }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { residence_id, application_ids, skip_validation } = await req.json();

    if (!residence_id && !application_ids) {
      return new Response(
        JSON.stringify({ error: 'Missing residence_id or application_ids', _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ----- Pre-export integrity validation (blocks export on failure) -----
    if (!skip_validation) {
      const { data: validation, error: vErr } = await supabaseAdmin
        .rpc('validate_handover_pack', { _residence_id: residence_id ?? null });
      if (vErr) {
        console.error(`[${VERSION}] Validator RPC failed`, vErr);
        return new Response(
          JSON.stringify({ error: 'Validation failed to run', detail: vErr.message, _version: VERSION }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (validation && validation.ok === false) {
        return new Response(
          JSON.stringify({
            error: 'DATA INTEGRITY ERROR — export blocked',
            validation,
            _version: VERSION,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ----- Pull rows from the single validated view -----
    let vQuery = supabaseAdmin.from('residence_handover_export_v').select('*');
    if (residence_id) {
      vQuery = vQuery.eq('residence_id', residence_id);
    } else if (application_ids) {
      vQuery = vQuery.in('application_id', application_ids);
    }
    const { data: rows, error: vErr2 } = await vQuery.order('application_date', { ascending: false });
    if (vErr2 || !rows?.length) {
      return new Response(
        JSON.stringify({ error: 'No applications found', _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adapter so downstream HTML code keeps its existing shape
    const applications = rows.map((r: any) => ({
      id: r.application_id,
      user_id: r.user_id,
      residence_id: r.residence_id,
      status: r.status,
      application_date: r.application_date,
      residence: { name: r.residence_name },
      funding_source: r.funding_source,
    }));
    const profileMap = new Map(rows.map((r: any) => [r.user_id, {
      id: r.user_id,
      full_name: [r.student_name, r.student_surname].filter(Boolean).join(' '),
      student_number: r.student_number,
      email: r.email,
      phone: r.phone,
    }]));
    const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))];

    // Fetch documents for all applicants
    const { data: allDocuments } = await supabaseAdmin
      .from('documents')
      .select('*')
      .in('user_id', userIds);

    const documentsMap = new Map<string, any[]>();
    allDocuments?.forEach(doc => {
      const existing = documentsMap.get(doc.user_id) || [];
      existing.push(doc);
      documentsMap.set(doc.user_id, existing);
    });

    const residenceName = applications[0]?.residence?.name || 'Unknown';
    const today = new Date().toISOString().split('T')[0];

    // Generate summary HTML
    const summaryHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Handover Pack - ${residenceName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; padding: 20px; font-size: 12px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; margin-bottom: 0; }
    .header h1 { font-size: 24px; margin-bottom: 4px; }
    .header p { opacity: 0.9; font-size: 13px; }
    .meta { background: #f8f9fa; padding: 12px 24px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
    .meta-item { }
    .meta-label { font-size: 10px; color: #888; text-transform: uppercase; }
    .meta-value { font-weight: 600; color: #333; }
    .content { padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1a1a2e; color: white; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) { background: #fafafa; }
    .status-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
    .status-submitted { background: #e0e7ff; color: #3b82f6; }
    .status-approved { background: #d1fae5; color: #10b981; }
    .status-rejected { background: #fee2e2; color: #ef4444; }
    .docs-list { font-size: 10px; color: #666; }
    .footer { text-align: center; padding: 16px; font-size: 10px; color: #888; border-top: 1px solid #eee; margin-top: 20px; }
    .summary-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center; }
    .summary-number { font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .summary-label { font-size: 11px; color: #666; }
    @media print { body { padding: 0; } .header { border-radius: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>ResKonnect</h1>
    <p>Handover Pack - ${residenceName}</p>
  </div>
  
  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Generated</div>
      <div class="meta-value">${new Date().toLocaleString('en-ZA')}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Applications</div>
      <div class="meta-value">${applications.length}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Residence</div>
      <div class="meta-value">${residenceName}</div>
    </div>
  </div>

  <div class="content">
    <div class="summary-box">
      <div class="summary-grid">
        <div>
          <div class="summary-number">${applications.filter(a => a.status === 'submitted').length}</div>
          <div class="summary-label">Pending</div>
        </div>
        <div>
          <div class="summary-number">${applications.filter(a => a.status === 'under_review').length}</div>
          <div class="summary-label">Under Review</div>
        </div>
        <div>
          <div class="summary-number">${applications.filter(a => a.status === 'approved').length}</div>
          <div class="summary-label">Approved</div>
        </div>
        <div>
          <div class="summary-number">${applications.filter(a => a.status === 'rejected').length}</div>
          <div class="summary-label">Rejected</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ref Code</th>
          <th>Student Name</th>
          <th>Student Number</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Applied</th>
          <th>Status</th>
          <th>Documents</th>
        </tr>
      </thead>
      <tbody>
        ${applications.map((app, idx) => {
          const profile = profileMap.get(app.user_id);
          const docs = documentsMap.get(app.user_id) || [];
          const refCode = generateRefCode(app.id);
          const statusClass = app.status === 'approved' ? 'status-approved' : 
                              app.status === 'rejected' ? 'status-rejected' : 'status-submitted';
          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${refCode}</strong></td>
              <td>${profile?.full_name || 'N/A'}</td>
              <td>${profile?.student_number || 'N/A'}</td>
              <td>${profile?.email || 'N/A'}</td>
              <td>${profile?.phone || 'N/A'}</td>
              <td>${formatDate(app.application_date)}</td>
              <td><span class="status-badge ${statusClass}">${app.status.replace(/_/g, ' ')}</span></td>
              <td class="docs-list">${docs.length > 0 ? docs.map(d => d.document_type.replace(/_/g, ' ')).join(', ') : 'None'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>ResKonnect • South Africa's Premier Student Accommodation Platform</p>
    <p>This document was generated automatically. For support: support@reskonnect.co.za</p>
  </div>
</body>
</html>
`;

    console.log(`[${VERSION}] Handover pack generated for ${residenceName}`);

    // For now, return the HTML summary
    // In a full implementation, we would generate a ZIP with all documents
    return new Response(summaryHtml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="HandoverPack_${sanitizeFileName(residenceName)}_${today}.html"`
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error(`[${VERSION}] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
