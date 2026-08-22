-- Views do not have RLS of their own; expose only the minimum read privileges intended for each audience.
revoke all on public.seo_public_pages_v from anon, authenticated;
grant select on public.seo_public_pages_v to anon, authenticated;

revoke all on public.public_student_accommodation_market_v from anon, authenticated;
grant select on public.public_student_accommodation_market_v to anon, authenticated;

revoke all on public.public_property_market_v from anon, authenticated;
grant select on public.public_property_market_v to anon, authenticated;

revoke all on public.public_opportunity_market_v from anon, authenticated;
grant select on public.public_opportunity_market_v to anon, authenticated;

revoke all on public.seo_programmatic_eligibility_v from anon, authenticated;
grant select on public.seo_programmatic_eligibility_v to authenticated;

revoke all on public.seo_search_coverage_v from anon, authenticated;
grant select on public.seo_search_coverage_v to authenticated;
