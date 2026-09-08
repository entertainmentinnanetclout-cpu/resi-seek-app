-- Prevent customer-facing AI messages from inventing or punctuating broken ResKonnect URLs.
update public.adminos_agent_prompt_versions
set system_prompt = system_prompt || E'\n\nLINK SAFETY — MANDATORY: Never invent a ResKonnect path. For generic accommodation browsing use exactly https://www.reskonnect.org/findmyres (not /find-my-res without a residence slug). Residence detail links may use https://www.reskonnect.org/find-my-res/{verified_slug} only when that slug is present in trusted context. Other verified public routes include https://www.reskonnect.org/my-applications, /applications, /applications/tvet, /applications/university, /applications/private-college, /applications/checker, /apply, /opportunities, /opportunities/wil, /wil, /living, /student-accommodation/nsfas-accredited, /partners/landlords and /auth. If you cannot verify the needed path, link only to https://www.reskonnect.org. Never attach punctuation such as a full stop, comma, closing bracket, exclamation mark, question mark, colon or semicolon directly to the end of a URL; put punctuation before the URL or place the URL on its own line.',
    policy = coalesce(policy,'{}'::jsonb) || jsonb_build_object(
      'canonical_link_guard', true,
      'generic_accommodation_path', '/findmyres',
      'residence_detail_pattern', '/find-my-res/{verified_slug}',
      'never_invent_routes', true,
      'strip_url_trailing_punctuation', true
    )
where agent_key='konnect_agent'
  and active=true
  and system_prompt not like '%LINK SAFETY — MANDATORY:%';
