-- Initial Search Territory Map. This is an operational baseline, not a promise of rankings.
-- "covered" means a deliberate canonical ResKonnect destination exists for the intent.

insert into public.seo_pages(path,title,description,h1,primary_keyword,search_intent,canonical_path,schema_type,indexable,content_status,published_at,last_verified_at)
values('/student-accommodation/pretoria','Student Accommodation Pretoria | ResKonnect','Find student accommodation across Pretoria with ResKonnect, including residences and private student housing connected to major universities, TVET colleges and campus areas.','Student Accommodation in Pretoria','student accommodation Pretoria','commercial','/student-accommodation/pretoria','CollectionPage',true,'published',now(),now())
on conflict(path) do update set title=excluded.title,description=excluded.description,h1=excluded.h1,primary_keyword=excluded.primary_keyword,indexable=true,content_status='published',last_verified_at=now(),updated_at=now();

insert into public.seo_search_intents(pillar,cluster,intent,query_pattern,priority,target_path,status) values
('living','generic','commercial','student accommodation','critical','/student-accommodation','covered'),
('living','generic','commercial','student housing South Africa','critical','/student-accommodation','covered'),
('living','generic','commercial','student residences South Africa','high','/student-accommodation','covered'),
('living','funding','commercial','NSFAS accommodation','critical','/student-accommodation/nsfas-accredited','covered'),
('living','funding','commercial','NSFAS accredited accommodation','critical','/student-accommodation/nsfas-accredited','covered'),
('living','location','commercial','student accommodation Pretoria','critical','/student-accommodation/pretoria','covered'),
('living','location','commercial','student accommodation Pretoria West','critical','/student-accommodation/pretoria-west','covered'),
('living','institution','commercial','student accommodation near TUT','critical','/student-accommodation/near-tut','covered'),
('living','institution','commercial','TUT accommodation','critical','/student-accommodation/near-tut','covered'),
('living','institution','commercial','TUT Pretoria West accommodation','critical','/student-accommodation/near-tut-pretoria-west','covered'),
('living','private','commercial','private student accommodation','high','/living/private-rentals','covered'),
('living','roommate','commercial','student roommate finder','medium','/roommates','covered'),
('applications','generic','informational','university applications South Africa','high','/applications/university','covered'),
('applications','tvet','informational','TVET college applications','high','/applications/tvet','covered'),
('applications','readiness','tool','APS checker','high','/applications/aps-checker','covered'),
('applications','institution','informational','TUT applications','high','/applications/university','covered'),
('applications','institution','informational','UP applications','high','/applications/university','covered'),
('applications','institution','informational','UNISA applications','high','/applications/university','covered'),
('applications','course-match','tool','course match South Africa','high','/applications/checker','covered'),
('applications','documents','informational','university application documents','high','/applications/application-readiness','covered'),
('opportunity','wil','commercial','WIL placement opportunities','critical','/opportunities/wil','covered'),
('opportunity','wil','commercial','work integrated learning opportunities','critical','/opportunities/wil','covered'),
('opportunity','seta','commercial','SETA opportunities','high','/opportunities/seta','covered'),
('opportunity','internships','commercial','student internships South Africa','high','/opportunities/internships','covered'),
('opportunity','graduate','commercial','graduate opportunities South Africa','high','/opportunities/internships','covered'),
('opportunity','funding','commercial','student bursaries South Africa','high','/bursaries','covered'),
('property','investment','commercial','student accommodation for sale','critical','/student-accommodation-for-sale','covered'),
('property','investment','commercial','student housing investment South Africa','critical','/properties','covered'),
('property','location','commercial','student accommodation for sale Pretoria','high','/student-accommodation-for-sale','covered'),
('property','auction','commercial','student accommodation auctions','critical','/property-auctions','covered'),
('property','auction','commercial','property auctions Pretoria student accommodation','high','/property-auctions','covered'),
('property','development','commercial','student housing development opportunities','high','/development-opportunities','covered'),
('property','conversion','commercial','houses for student accommodation','high','/development-opportunities','covered'),
('ai','student','informational','AI for students South Africa','medium','/ai','covered'),
('ai','course','tool','AI course matching South Africa','medium','/ai','covered'),
('partner','landlord','commercial','list student accommodation South Africa','high','/partners/landlords','covered'),
('partner','institution','commercial','student accommodation partnerships','medium','/partners/institutions','covered'),
('brand','brand','navigational','ResKonnect','critical','/','covered'),
('brand','brand','navigational','Res Konnect','critical','/','covered'),
('brand','brand','navigational','ResConnect','high','/','covered'),
('brand','brand','navigational','Res Connect','high','/','covered')
on conflict(query_pattern) do update set target_path=excluded.target_path,status=excluded.status,priority=excluded.priority,updated_at=now();
