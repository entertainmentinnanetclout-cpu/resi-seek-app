import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple QR Code generator using text-based SVG
function generateQRCodeSVG(data: string): string {
  // Create a simple visual representation for the reference code
  const size = 100;
  const chars = data.split('');
  const gridSize = Math.ceil(Math.sqrt(chars.length));
  const cellSize = size / gridSize;
  
  let rects = '';
  chars.forEach((char, i) => {
    const x = (i % gridSize) * cellSize;
    const y = Math.floor(i / gridSize) * cellSize;
    const charCode = char.charCodeAt(0);
    const fill = charCode % 2 === 0 ? '#000' : '#fff';
    rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${fill}" />`;
  });
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#fff"/>
    ${rects}
    <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="#000" stroke-width="2"/>
  </svg>`;
}

function generateRefCode(appId: string): string {
  return appId.replace(/-/g, '').substring(0, 8).toUpperCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString('en-ZA')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(
        JSON.stringify({ error: 'Missing application_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch application with residence data
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('*, residence:residences(*)')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership (user must own this application)
    if (application.user_id !== user.id) {
      // Check if admin
      const { data: isAdmin } = await supabaseAdmin
        .rpc('has_role', { _user_id: user.id, _role: 'admin' });
      
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Not authorized to access this application' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Fetch student profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', application.user_id)
      .single();

    const refCode = generateRefCode(application.id);
    const qrSvg = generateQRCodeSVG(refCode);
    const qrBase64 = btoa(qrSvg);

    // Generate HTML for the booking slip
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Booking Slip - ${refCode}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 24px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 4px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .badge { display: inline-block; background: #10b981; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 12px; text-transform: uppercase; }
    .content { padding: 24px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item { }
    .info-label { font-size: 11px; color: #888; text-transform: uppercase; }
    .info-value { font-size: 15px; font-weight: 500; color: #333; margin-top: 2px; }
    .residence-card { background: #f8f9fa; border-radius: 8px; padding: 16px; border-left: 4px solid #3b82f6; }
    .residence-name { font-size: 18px; font-weight: 600; color: #1a1a2e; }
    .residence-address { font-size: 13px; color: #666; margin-top: 4px; }
    .residence-details { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
    .detail-badge { background: #e0e7ff; color: #3b82f6; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .price-highlight { font-size: 24px; font-weight: 700; color: #10b981; }
    .qr-section { text-align: center; padding: 20px; background: #fafafa; border-radius: 8px; margin-top: 16px; }
    .qr-code { display: inline-block; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .ref-code { font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #1a1a2e; margin-top: 12px; }
    .footer { background: #f8f9fa; padding: 16px 24px; text-align: center; border-top: 1px solid #eee; }
    .footer p { font-size: 11px; color: #888; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 12px; color: #856404; }
    @media print { body { background: white; padding: 0; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ResKonnect</h1>
      <p>Student Accommodation Platform</p>
      <span class="badge">Application Booking Slip</span>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">Student Information</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Full Name</div>
            <div class="info-value">${profile?.full_name || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Student Number</div>
            <div class="info-value">${profile?.student_number || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">${profile?.email || 'N/A'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Phone</div>
            <div class="info-value">${profile?.phone || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Accommodation Details</div>
        <div class="residence-card">
          <div class="residence-name">${application.residence?.name || 'Unknown Residence'}</div>
          <div class="residence-address">${application.residence?.address || ''}</div>
          <div class="residence-details">
            <span class="detail-badge">${application.residence?.room_type || 'Standard'}</span>
            <span class="detail-badge">${application.residence?.campus || 'TUT'}</span>
          </div>
          <div style="margin-top: 16px;">
            <div class="info-label">Monthly Rent</div>
            <div class="price-highlight">${formatCurrency(application.residence?.price || 0)}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Application Details</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Applied On</div>
            <div class="info-value">${formatDate(application.application_date)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value" style="text-transform: capitalize;">${application.status.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      <div class="qr-section">
        <div class="section-title">Verification Code</div>
        <div class="qr-code">
          <img src="data:image/svg+xml;base64,${qrBase64}" alt="QR Code" width="100" height="100" />
        </div>
        <div class="ref-code">${refCode}</div>
        <p style="font-size: 11px; color: #888; margin-top: 8px;">Present this code at the residence</p>
      </div>

      <div class="disclaimer">
        <strong>⚠️ Important:</strong> This slip confirms your application was submitted to ResKonnect. 
        It does not guarantee accommodation. Final approval is subject to verification and availability.
      </div>
    </div>

    <div class="footer">
      <p>ResKonnect • South Africa's Premier Student Accommodation Platform</p>
      <p style="margin-top: 4px;">Generated on ${new Date().toLocaleDateString('en-ZA')} • support@reskonnect.co.za</p>
    </div>
  </div>
</body>
</html>
`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="BookingSlip_${refCode}.html"`
      }
    });

  } catch (error: any) {
    console.error('Error generating booking slip:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
