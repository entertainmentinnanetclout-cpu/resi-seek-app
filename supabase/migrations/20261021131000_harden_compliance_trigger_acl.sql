-- Trigger functions should not be directly callable over the exposed API.
revoke all on function public.ensure_compliance_case_from_request() from public, anon, authenticated;
