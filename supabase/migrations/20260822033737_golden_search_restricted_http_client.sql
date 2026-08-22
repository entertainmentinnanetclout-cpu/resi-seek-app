create schema if not exists seo_http;
revoke all on schema seo_http from public;
revoke all on schema seo_http from anon, authenticated;

create extension if not exists http with schema seo_http;

revoke all on all functions in schema seo_http from public;
revoke all on all functions in schema seo_http from anon, authenticated;
grant usage on schema seo_http to service_role;
grant execute on all functions in schema seo_http to service_role;

comment on schema seo_http is 'Restricted server-side HTTP client used for controlled search-index submission diagnostics. Not exposed to anon or authenticated application users.';
