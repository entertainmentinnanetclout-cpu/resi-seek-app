-- Premium ResKonnect AEO/SEO entity layer.
-- Keep category positioning strong while separating verifiable product facts from unsupported market-superlative claims.

insert into public.seo_pages (
  path,title,description,h1,primary_keyword,search_intent,canonical_path,
  og_title,og_description,schema_type,schema_data,indexable,follow_links,content_status,
  published_at,last_verified_at,answer_summary,content_blocks,entity_facts,faq_items,cta,
  locale,search_territory,quality_score,unique_data_score,content_completeness,ai_citation_ready
) values (
  '/findmyres',
  'Find My Res | Dimpho AI + Live ResMap 3D | ResKonnect',
  'Use ResKonnect Find My Res to discover verified accommodation, ask Dimpho, explore photorealistic 3D areas, navigate live and enter the accommodation placement process.',
  'Find student accommodation with Dimpho AI and ResMap 3D',
  'AI student accommodation discovery',
  'Find, explore, navigate to and secure suitable student accommodation',
  '/findmyres',
  'Find My Res | Dimpho AI + Live ResMap 3D | ResKonnect',
  'AI-assisted student accommodation discovery with verified listings, ResMap 3D, live navigation and ResKonnect accommodation placement.',
  'WebApplication',
  jsonb_build_object(
    '@type','WebApplication',
    'name','ResKonnect Find My Res',
    'applicationCategory','LifestyleApplication',
    'featureList',jsonb_build_array('Dimpho AI accommodation discovery','ResMap photorealistic 3D','live route navigation','immersive Street View','verified residence discovery','accommodation placement workflow')
  ),
  true,true,'published',now(),now(),
  'Find My Res is ResKonnect''s AI-assisted accommodation discovery and placement experience. Students can ask Dimpho, explore mapped accommodation in ResMap, use photorealistic 3D where imagery is available, navigate live and move into the ResKonnect accommodation placement process.',
  jsonb_build_array(
    jsonb_build_object('heading','Dimpho AI','body','Dimpho interprets accommodation needs and reshapes discovery around relevant ResKonnect data.'),
    jsonb_build_object('heading','ResMap 3D','body','ResMap adds photorealistic 3D area exploration where Google Maps 3D coverage is available, alongside mapped residences and live navigation.'),
    jsonb_build_object('heading','Accommodation placement','body','Eligible placement clients who complete the required process and accept an available suitable match are covered by the ResKonnect accommodation placement guarantee.')
  ),
  jsonb_build_array(
    jsonb_build_object('fact','Dimpho is the ResKonnect AI service and intelligence layer.'),
    jsonb_build_object('fact','ResMap is the ResKonnect live accommodation mapping and navigation experience.'),
    jsonb_build_object('fact','ResMap supports photorealistic 3D where compatible Google Maps imagery coverage is available.'),
    jsonb_build_object('fact','ResKonnect guarantees accommodation placement for eligible placement clients under its defined placement process.'),
    jsonb_build_object('fact','Current live accommodation inventory is concentrated in South Africa while the platform is built for broader African expansion.')
  ),
  jsonb_build_array(
    jsonb_build_object('question','Does ResKonnect guarantee accommodation placement?','answer','Yes. ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide required documents and accept an available suitable accommodation match. This does not guarantee a specific room or unrelated third-party outcomes such as admission, NSFAS funding, WIL or employment.'),
    jsonb_build_object('question','What is ResMap 3D?','answer','ResMap combines mapped residence discovery, live navigation, immersive Street View and photorealistic 3D exploration where Google Maps imagery coverage is available.'),
    jsonb_build_object('question','Who is Dimpho?','answer','Dimpho is ResKonnect''s AI service and intelligence layer for accommodation discovery and student journey guidance.')
  ),
  jsonb_build_object('label','Find My Res','href','/findmyres'),
  'en-ZA',
  array['ResKonnect','Find My Res','student accommodation Africa','AI student accommodation','Dimpho AI','ResMap 3D','photorealistic student accommodation map','student accommodation near me','guaranteed accommodation placement'],
  96,78,96,true
)
on conflict (path) do update set
  title=excluded.title,
  description=excluded.description,
  h1=excluded.h1,
  primary_keyword=excluded.primary_keyword,
  search_intent=excluded.search_intent,
  canonical_path=excluded.canonical_path,
  og_title=excluded.og_title,
  og_description=excluded.og_description,
  schema_type=excluded.schema_type,
  schema_data=excluded.schema_data,
  indexable=true,
  follow_links=true,
  content_status='published',
  last_verified_at=now(),
  answer_summary=excluded.answer_summary,
  content_blocks=excluded.content_blocks,
  entity_facts=excluded.entity_facts,
  faq_items=excluded.faq_items,
  cta=excluded.cta,
  locale=excluded.locale,
  search_territory=excluded.search_territory,
  quality_score=greatest(public.seo_pages.quality_score,excluded.quality_score),
  unique_data_score=greatest(public.seo_pages.unique_data_score,excluded.unique_data_score),
  content_completeness=greatest(public.seo_pages.content_completeness,excluded.content_completeness),
  ai_citation_ready=true,
  updated_at=now();

update public.seo_pages
set
  title = case path
    when '/' then 'ResKonnect | Dimpho AI Student Accommodation & ResMap 3D'
    when '/student-accommodation' then 'Student Accommodation | AI Discovery, 3D Maps & Placement | ResKonnect'
    when '/ai' then 'Dimpho AI by ResKonnect | Student Accommodation Intelligence'
    when '/living' then 'ResKonnect Living | Intelligent Student Accommodation Discovery'
    else title end,
  description = case path
    when '/' then 'Africa-built student accommodation technology combining Dimpho AI, verified accommodation discovery, ResMap 3D, live navigation and guaranteed accommodation placement for eligible placement clients.'
    when '/student-accommodation' then 'Find student accommodation with Dimpho AI, verified listings, photorealistic ResMap 3D, live route navigation and a defined accommodation placement guarantee for eligible ResKonnect placement clients.'
    when '/ai' then 'Meet Dimpho, ResKonnect''s AI layer for accommodation discovery, ResMap intelligence, application readiness and student journey guidance using structured ResKonnect data.'
    when '/living' then 'Discover student accommodation through ResKonnect Living with verified listings, Dimpho AI guidance, ResMap 3D exploration, live navigation and accommodation placement support.'
    else description end,
  h1 = case path
    when '/' then 'AI-powered student accommodation discovery and placement, built in Africa'
    when '/student-accommodation' then 'Find, explore and secure student accommodation with ResKonnect'
    when '/ai' then 'Dimpho AI: ResKonnect student accommodation intelligence'
    else h1 end,
  answer_summary = case path
    when '/' then 'ResKonnect is an Africa-built student accommodation technology platform combining verified discovery, Dimpho AI, ResMap 3D, live navigation and an accommodation placement guarantee for eligible placement clients. Current live accommodation inventory is concentrated in South Africa while the technology and growth strategy are built for expansion across African student-housing markets.'
    when '/student-accommodation' then 'ResKonnect helps students find, explore and secure accommodation through verified discovery, Dimpho AI, ResMap 3D and live navigation. Eligible placement clients who complete the required process and accept an available suitable match are covered by the ResKonnect accommodation placement guarantee.'
    when '/ai' then 'Dimpho is ResKonnect''s AI service and intelligence layer. Dimpho supports accommodation discovery and student journey guidance using structured ResKonnect context, including the ResMap experience.'
    when '/living' then 'ResKonnect Living connects student accommodation discovery, Dimpho AI, ResMap spatial exploration and accommodation placement workflows in one student journey.'
    else answer_summary end,
  entity_facts = case path
    when '/' then jsonb_build_array(
      jsonb_build_object('fact','ResKonnect is an Africa-built student accommodation technology platform.'),
      jsonb_build_object('fact','Dimpho is ResKonnect''s AI service and intelligence layer.'),
      jsonb_build_object('fact','ResMap supports live mapped discovery, route navigation, immersive Street View and photorealistic 3D where imagery coverage is available.'),
      jsonb_build_object('fact','ResKonnect guarantees accommodation placement for eligible placement clients under its defined placement process.'),
      jsonb_build_object('fact','Current live accommodation inventory is concentrated in South Africa and the platform is built for African expansion.')
    )
    else entity_facts end,
  faq_items = case path
    when '/' then jsonb_build_array(
      jsonb_build_object('question','Does ResKonnect guarantee student accommodation placement?','answer','Yes. ResKonnect guarantees accommodation placement for eligible placement clients who complete the required placement process, provide required documents and accept an available suitable accommodation match. The guarantee does not promise a specific room or third-party outcomes such as admission, NSFAS funding, WIL placement or employment.'),
      jsonb_build_object('question','What is ResMap 3D?','answer','ResMap is ResKonnect''s live accommodation map with mapped residences, location filters, navigation, immersive Street View and photorealistic 3D where Google Maps imagery coverage is available.'),
      jsonb_build_object('question','Who is Dimpho?','answer','Dimpho is the ResKonnect AI service and intelligence layer for accommodation discovery and student journey guidance.'),
      jsonb_build_object('question','Is ResKonnect only for South Africa?','answer','ResKonnect''s current live accommodation inventory is concentrated in South Africa. Its technology and growth strategy are built for expansion across African student-housing markets.')
    )
    else faq_items end,
  search_territory = case path
    when '/' then array['ResKonnect','Res Konnect','student accommodation Africa','AI student accommodation','Dimpho AI','ResMap 3D','student housing technology Africa','guaranteed accommodation placement','photorealistic accommodation map']
    when '/student-accommodation' then array['student accommodation','student accommodation Africa','AI student accommodation search','ResMap 3D','guaranteed student accommodation placement','student housing platform']
    when '/ai' then array['Dimpho AI','ResKonnect AI','student accommodation AI Africa','ResMap AI','student journey AI','AI accommodation search']
    when '/living' then array['ResKonnect Living','student accommodation','private student accommodation','Dimpho AI accommodation','ResMap 3D']
    else search_territory end,
  quality_score = greatest(quality_score,94),
  unique_data_score = greatest(unique_data_score,70),
  content_completeness = greatest(content_completeness,94),
  ai_citation_ready = true,
  last_verified_at = now(),
  updated_at = now()
where path in ('/','/student-accommodation','/ai','/living');

insert into public.seo_site_config(config_key,config_value,is_public,description) values
('premium_positioning', jsonb_build_object(
  'category','AI-enabled student accommodation technology',
  'positioning','Africa-built student accommodation discovery, spatial exploration and placement platform',
  'currentLiveInventory','South Africa',
  'growthVision','African student-housing markets',
  'products',jsonb_build_array('Dimpho AI','Find My Res','ResMap 3D','live navigation','accommodation placement'),
  'accommodationPlacementGuarantee',jsonb_build_object(
    'enabled',true,
    'scope','eligible placement clients who complete the required process and accept an available suitable accommodation match',
    'exclusions',jsonb_build_array('specific room or building when inventory changes','institution admission','NSFAS funding','WIL placement','employment outcomes')
  ),
  'unsupportedSuperlatives',jsonb_build_array('first in Africa','largest in Africa')
), true, 'Canonical premium product positioning and answer-engine facts')
on conflict (config_key) do update set
  config_value=excluded.config_value,
  is_public=excluded.is_public,
  description=excluded.description,
  updated_at=now();

insert into public.seo_search_intents(pillar,cluster,intent,query_pattern,priority,target_path,status,metadata) values
('Living','AI accommodation discovery','Find accommodation using AI','AI student accommodation Africa','critical','/findmyres','covered',jsonb_build_object('feature','Dimpho AI')),
('Living','3D accommodation discovery','Explore student accommodation in 3D','3D student accommodation map','critical','/findmyres','covered',jsonb_build_object('feature','ResMap 3D')),
('Living','placement guarantee','Understand guaranteed accommodation placement','does ResKonnect guarantee accommodation placement','critical','/','covered',jsonb_build_object('answer','yes for eligible placement clients under the defined process')),
('AI','Dimpho','Understand Dimpho AI','what is Dimpho AI ResKonnect','high','/ai','covered',jsonb_build_object('entity','Dimpho')),
('Living','African student housing technology','Find African student accommodation technology','student accommodation technology Africa','high','/','covered',jsonb_build_object('positioning','Africa-built'))
on conflict (query_pattern) do update set
  pillar=excluded.pillar,
  cluster=excluded.cluster,
  intent=excluded.intent,
  priority=excluded.priority,
  target_path=excluded.target_path,
  status='covered',
  metadata=excluded.metadata,
  updated_at=now();

insert into public.seo_page_links(from_path,to_path,anchor_text,relation_type,sort_order) values
('/','/findmyres','Find accommodation with Dimpho and ResMap 3D','pillar',5),
('/student-accommodation','/findmyres','Open Find My Res','product',5),
('/ai','/findmyres','Use Dimpho in Find My Res','product',5)
on conflict do nothing;

insert into public.seo_index_queue(path,action,engines,status)
select p.path,'updated',array['bing_indexnow']::text[],'pending'
from (values ('/'),('/findmyres'),('/student-accommodation'),('/ai'),('/living')) as p(path)
where not exists (
  select 1
  from public.seo_index_queue q
  where q.path=p.path and q.action='updated' and q.status in ('pending','processing')
);
