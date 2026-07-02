import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v3.1.0-rpc-plus-fallback";
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

type JsonRecord = Record<string, unknown>;

const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(
    JSON.stringify({ ...body, _version: VERSION, _deployed_at: DEPLOYED_AT }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

const errorMessage = (error: unknown, fallback = 'Unknown error') => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    for (const key of ['message', 'details', 'hint', 'code']) {
      const value = e[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    try {
      const text = JSON.stringify(error);
      if (text && text !== '{}') return text;
    } catch (_) {
      // ignore stringify failures
    }
  }
  return fallback;
};

const isRpcVisibilityError = (error: unknown) => {
  const message = errorMessage(error, '').toLowerCase();
  const code = error && typeof error === 'object' ? String((error as Record<string, unknown>).code ?? '') : '';
  return code === 'PGRST202' || message.includes('schema cache') || message.includes('could not find the function');
};

const isLegacyUserRoleUniqueError = (error: unknown) => {
  const message = errorMessage(error, '').toLowerCase();
  return message.includes('user_roles_user_id_unique') || message.includes('user_roles_user_id_key');
};

const isConflictMessage = (message: string) =>
  message.includes('already has') ||
  message.includes('already linked') ||
  message.includes('already in use') ||
  message.includes('duplicate key');

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
      return jsonResponse({ error: 'Server configuration error - missing external database credentials' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Check if caller is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin
      .rpc('has_role', { _user_id: caller.id, _role: 'admin' });

    if (roleError || !isAdmin) {
      return jsonResponse({ error: 'Unauthorized: Admin role required' }, 403);
    }

    const { residence_id, email, password }: CreateUserRequest = await req.json();
    const cleanEmail = email?.trim().toLowerCase();

    if (!residence_id || !cleanEmail || !password) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({ error: 'Password must be at least 8 characters' }, 400);
    }

    const { data: residenceExists, error: residenceLookupError } = await supabaseAdmin
      .from('residences')
      .select('id')
      .eq('id', residence_id)
      .maybeSingle();

    if (residenceLookupError) {
      return jsonResponse({ error: `Residence lookup failed: ${errorMessage(residenceLookupError)}` }, 500);
    }

    if (!residenceExists) {
      return jsonResponse({ error: 'Selected residence was not found' }, 404);
    }

    const { data: existingResidencePortal, error: existingResidenceError } = await supabaseAdmin
      .from('residence_portal_accounts')
      .select('residence_id')
      .eq('residence_id', residence_id)
      .maybeSingle();

    if (existingResidenceError) {
      return jsonResponse({ error: `Portal duplicate check failed: ${errorMessage(existingResidenceError)}` }, 500);
    }

    if (existingResidencePortal) {
      return jsonResponse({ error: 'This residence already has a portal account' }, 409);
    }

    const { data: existingEmailPortal, error: existingEmailError } = await supabaseAdmin
      .from('residence_portal_accounts')
      .select('email')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingEmailError) {
      return jsonResponse({ error: `Portal email check failed: ${errorMessage(existingEmailError)}` }, 500);
    }

    if (existingEmailPortal) {
      return jsonResponse({ error: 'Portal email is already in use' }, 409);
    }

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      return jsonResponse({ error: authError.message }, 400);
    }

    if (!authData.user?.id) {
      return jsonResponse({ error: 'Auth user was not created' }, 500);
    }

    const newUserId = authData.user.id;

    const assignPortalRole = async () => {
      const { error: firstRoleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: newUserId, role: 'residence_portal' },
          { onConflict: 'user_id,role', ignoreDuplicates: true }
        );

      if (!firstRoleError) return;
      if (!isLegacyUserRoleUniqueError(firstRoleError)) {
        throw new Error(`Role assignment failed: ${errorMessage(firstRoleError)}`);
      }

      // A legacy UNIQUE(user_id) index means the new auth user's automatic
      // student role blocks the residence_portal role. For brand-new portal
      // users only, remove that auto student role before assigning portal.
      const { error: cleanupError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', newUserId)
        .neq('role', 'admin');
      if (cleanupError) throw new Error(`Legacy role cleanup failed: ${errorMessage(cleanupError)}`);

      const { error: retryRoleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: newUserId, role: 'residence_portal' },
          { onConflict: 'user_id,role', ignoreDuplicates: true }
        );
      if (retryRoleError) throw new Error(`Role assignment failed after cleanup: ${errorMessage(retryRoleError)}`);
    };

    try {
      console.log(`[${VERSION}] Created user ${newUserId}, assigning role...`);

      // 2 + 3 · Atomic role + portal write via RPC (returns readable errors).
      // Use the caller-scoped client so auth.uid() resolves inside the SECURITY
      // DEFINER function's admin check. If the SQL pack has not been run or
      // PostgREST has stale function cache, fall back to service-role writes.
      const { data: rpcData, error: rpcError } = await supabaseUser.rpc(
        'admin_create_residence_portal',
        { _residence_id: residence_id, _user_id: newUserId, _email: cleanEmail }
      );

      if (rpcError) {
        console.error(`[${VERSION}] rpc failed`, rpcError);
        if (!isRpcVisibilityError(rpcError) && !isLegacyUserRoleUniqueError(rpcError)) {
          throw new Error(errorMessage(rpcError, 'Portal RPC failed'));
        }

        console.warn(`[${VERSION}] using service-role fallback for portal database writes`);

        await assignPortalRole();

        const { error: portalInsertError } = await supabaseAdmin
          .from('residence_portal_accounts')
          .insert({
            residence_id,
            user_id: newUserId,
            email: cleanEmail,
            is_active: true,
          });

        if (portalInsertError) throw new Error(`Portal account insert failed: ${errorMessage(portalInsertError)}`);

        console.log(`[${VERSION}] fallback database writes ok`);
      } else {
        console.log(`[${VERSION}] rpc ok`, rpcData);
      }

      console.log(`[${VERSION}] Portal account created successfully`);

      return jsonResponse({
        success: true,
        user_id: newUserId,
        residence_id,
        email: cleanEmail,
      });

    } catch (dbError: any) {
      // Rollback: Delete the auth user if DB insert failed
      await supabaseAdmin.auth.admin.deleteUser(newUserId);

      const msg = errorMessage(dbError, 'Failed to create database records');
      const isConflict = isConflictMessage(msg);
      console.error(`[${VERSION}] dbError caught:`, msg, dbError);

      return jsonResponse({ error: msg, debug_code: isLegacyUserRoleUniqueError(dbError) ? 'LEGACY_USER_ROLE_UNIQUE' : undefined }, isConflict ? 409 : 500);
    }

  } catch (error: unknown) {
    const msg = errorMessage(error, 'Internal Server Error');
    console.error(`[${VERSION}] Error:`, msg);
    return jsonResponse({ error: msg }, 500);
  }
});
