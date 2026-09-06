update public.adminos_whatsapp_rich_content
set config = jsonb_build_object(
  'body','Applications can be confusing. Choose exactly what you need and Luna will guide you from there.',
  'button','Applications',
  'items',jsonb_build_array(
    jsonb_build_object('item','Track my application','id','app:status','description','Check your latest ResKonnect application status'),
    jsonb_build_object('item','Docs & missing','id','app:missing','description','See document issues and secure upload guidance'),
    jsonb_build_object('item','University applications','id','app:university','description','University application guidance'),
    jsonb_build_object('item','TVET / college','id','app:tvet','description','TVET and public college application guidance'),
    jsonb_build_object('item','Private college','id','app:private-college','description','Private college application guidance'),
    jsonb_build_object('item','APS / readiness checker','id','app:checker','description','Prepare choices and check application readiness'),
    jsonb_build_object('item','Start an application','id','app:start','description','Open the ResKonnect applications hub'),
    jsonb_build_object('item','Accommodation','id','menu:accommodation','description','Find or continue accommodation'),
    jsonb_build_object('item','Speak to a human','id','menu:human','description','Escalate a protected or unusual issue'),
    jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')
  )
), status='not_created', content_sid=null, metadata=metadata-'provider_error'-'provider_error_at', updated_at=now()
where content_key='rk_application_menu_v2';

update public.adminos_whatsapp_rich_content
set config = jsonb_build_object(
  'body','Choose the WIL or opportunity support you need. Luna will guide routine steps and escalate protected placement decisions.',
  'button','WIL options',
  'items',jsonb_build_array(
    jsonb_build_object('item','Check WIL status','id','wil:status','description','Track your latest WIL application'),
    jsonb_build_object('item','Apply / get started','id','wil:apply','description','Open WIL and opportunity pathways'),
    jsonb_build_object('item','WIL requirements','id','wil:requirements','description','Understand common readiness requirements'),
    jsonb_build_object('item','WIL documents','id','wil:documents','description','Secure document and checklist guidance'),
    jsonb_build_object('item','Placement support','id','wil:placement','description','Guidance on workplace placement progress'),
    jsonb_build_object('item','Available opportunities','id','wil:opportunities','description','Explore published opportunities'),
    jsonb_build_object('item','Employer / host company','id','wil:employer','description','Employer, host-company or partnership enquiry'),
    jsonb_build_object('item','Funding / stipend','id','wil:funding','description','Guidance on funding and stipend information'),
    jsonb_build_object('item','Speak to a human','id','menu:human','description','Escalate a protected or unusual issue'),
    jsonb_build_object('item','Main menu','id','menu:main','description','Return to all services')
  )
), status='not_created', content_sid=null, metadata=metadata-'provider_error'-'provider_error_at', updated_at=now()
where content_key='rk_wil_menu_v2';