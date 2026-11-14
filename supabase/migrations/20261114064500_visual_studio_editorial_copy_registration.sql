-- Extend the existing audited God Mode page registry only to editorial headings/intros.
-- Do not make search, payments, compliance, placement, FAQ answers or other workflow data editable.
UPDATE public.rk_visual_page_sections SET
 editable_copy=true,
 headline=CASE WHEN btrim(headline)<>'' THEN headline ELSE
  CASE section_key
   WHEN 'vision' THEN 'ResKonnect — Building Africa''s First AI/SI-Powered Student Platform.'
   WHEN 'cities' THEN 'A campus nearby. A place that works for you. Found on ResKonnect.'
   WHEN 'benefits' THEN 'Why Choose ResKonnect?'
   WHEN 'faq' THEN 'ResKonnect, answered clearly'
   ELSE headline END END,
 subtitle=CASE WHEN btrim(subtitle)<>'' THEN subtitle ELSE
  CASE section_key
   WHEN 'vision' THEN 'From student accommodation and single-room searches to applications, NSFAS funding checks, bursaries and WIL placements — ResKonnect connects Artificial Intelligence (AI) with Service Intelligence (SI) to help students make informed next steps.'
   WHEN 'cities' THEN 'Explore the areas where ResKonnect has published residence records. Check property addresses, funding acceptance, room types and real provider prices when supplied. Missing prices are not advertised as budget offers.'
   WHEN 'benefits' THEN ''
   WHEN 'faq' THEN 'Canonical facts for students, partners, search engines and AI answer systems.'
   ELSE subtitle END END,
 updated_at=now()
WHERE page_key='landing' AND section_key IN('vision','cities','benefits','faq');
