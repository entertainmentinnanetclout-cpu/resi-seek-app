-- Final Service Intelligence content/persona layer.
-- Keep routine automation deterministic; Dimpho only invokes the configured OpenAI service agent
-- when structured journeys and verified data cannot resolve the customer's natural-language query.

update public.adminos_whatsapp_rich_content
set config=jsonb_set(
      config,
      '{actions}',
      '[{"id":"menu:main","type":"QUICK_REPLY","title":"Continue"},{"id":"human:wait","type":"QUICK_REPLY","title":"Human help"}]'::jsonb
    ),
    status='not_created',
    content_sid=null,
    metadata=(metadata - 'provider_error' - 'provider_error_at'),
    updated_at=now()
where content_key='rk_next_step_reminder' and status='provider_error';

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,status,purpose,config,metadata)
values
(
  'rk_main_menu_v2','Dimpho main menu','twilio/list-picker',false,'not_created','service',
  jsonb_build_object(
    'body','Hi {{1}}. I’m Dimpho, ResKonnect’s service assistant. How can I help you today?',
    'button','Choose an option',
    'items',jsonb_build_array(
      jsonb_build_object('id','menu:accommodation','item','Accommodation','description','Find, apply, reserve or track accommodation'),
      jsonb_build_object('id','menu:applications','item','Applications','description','Applications, status and missing documents'),
      jsonb_build_object('id','menu:reservations','item','Reservations','description','Manage an accommodation reservation'),
      jsonb_build_object('id','menu:opportunities','item','WIL & Opportunities','description','WIL, placements and opportunities'),
      jsonb_build_object('id','menu:company','item','Our services','description','What ResKonnect can help with'),
      jsonb_build_object('id','menu:technical','item','App / Website support','description','Account, app or website issues'),
      jsonb_build_object('id','menu:language','item','Change language','description','English, isiZulu, Sepedi and more'),
      jsonb_build_object('id','menu:human','item','Speak to a human','description','Escalate when a person is required')
    )
  ),jsonb_build_object('persona','Dimpho','release','service_intelligence')
),
(
  'rk_application_menu_v3','Dimpho applications concierge','twilio/list-picker',false,'not_created','service',
  jsonb_build_object(
    'body','Applications can be confusing. Choose exactly what you need and Dimpho will guide you from there.',
    'button','Applications',
    'items',jsonb_build_array(
      jsonb_build_object('id','app:status','item','Track my application','description','Check your latest ResKonnect application status'),
      jsonb_build_object('id','app:missing','item','Docs & missing','description','See document issues and secure upload guidance'),
      jsonb_build_object('id','app:university','item','University applications','description','University application guidance'),
      jsonb_build_object('id','app:tvet','item','TVET / college','description','TVET and public college application guidance'),
      jsonb_build_object('id','app:private-college','item','Private college','description','Private college application guidance'),
      jsonb_build_object('id','app:checker','item','APS / readiness checker','description','Prepare choices and check application readiness'),
      jsonb_build_object('id','app:start','item','Start an application','description','Open the ResKonnect applications hub'),
      jsonb_build_object('id','menu:accommodation','item','Accommodation','description','Find or continue accommodation'),
      jsonb_build_object('id','menu:human','item','Speak to a human','description','Escalate a protected or unusual issue'),
      jsonb_build_object('id','menu:main','item','Main menu','description','Return to all services')
    )
  ),jsonb_build_object('persona','Dimpho','supersedes','rk_application_menu_v2')
),
(
  'rk_wil_menu_v3','Dimpho WIL guided concierge','twilio/list-picker',false,'not_created','service',
  jsonb_build_object(
    'body','Choose the WIL or opportunity support you need. Dimpho will guide routine steps and escalate protected placement decisions.',
    'button','WIL options',
    'items',jsonb_build_array(
      jsonb_build_object('id','wil:status','item','Check WIL status','description','Track your latest WIL application'),
      jsonb_build_object('id','wil:apply','item','Apply / get started','description','Open WIL and opportunity pathways'),
      jsonb_build_object('id','wil:requirements','item','WIL requirements','description','Understand common readiness requirements'),
      jsonb_build_object('id','wil:documents','item','WIL documents','description','Secure document and checklist guidance'),
      jsonb_build_object('id','wil:placement','item','Placement support','description','Guidance on workplace placement progress'),
      jsonb_build_object('id','wil:opportunities','item','Available opportunities','description','Explore published opportunities'),
      jsonb_build_object('id','wil:employer','item','Employer / host company','description','Employer, host-company or partnership enquiry'),
      jsonb_build_object('id','wil:funding','item','Funding / stipend','description','Guidance on funding and stipend information'),
      jsonb_build_object('id','menu:human','item','Speak to a human','description','Escalate a protected or unusual issue'),
      jsonb_build_object('id','menu:main','item','Main menu','description','Return to all services')
    )
  ),jsonb_build_object('persona','Dimpho','supersedes','rk_wil_menu_v2')
)
on conflict (content_key) do update set
  display_name=excluded.display_name,
  content_type=excluded.content_type,
  approval_required=excluded.approval_required,
  purpose=excluded.purpose,
  config=excluded.config,
  metadata=excluded.metadata,
  updated_at=now();

update public.adminos_agent_prompt_versions set active=false where agent_key='konnect_agent' and active=true;
insert into public.adminos_agent_prompt_versions(agent_key,version,name,system_prompt,policy,tool_allowlist,active)
values(
  'konnect_agent',4,'Dimpho Premium Concierge',
  'You are Dimpho, ResKonnect''s premium service assistant and operational reasoning layer. Resolve routine customer, student, applicant, partner and prospect enquiries end-to-end using verified context supplied to you. Sound like a polished human service professional, not a generic bot. Preserve conversation history and interpret short contextual replies against the preceding question. Use only supplied database and knowledge context for account-specific facts. Never invent application or reservation statuses, residence availability, prices, deadlines, approvals, funding outcomes, partner commitments, payment results or legal terms. Never request passwords, OTPs, banking credentials, identity numbers or sensitive documents in open WhatsApp. Direct sensitive documents to the secure ResKonnect portal. Structured menus, database rules, next-best-actions, application health, service recovery, CSAT, residence readiness and language routing are handled deterministically outside the model; do not duplicate those systems. Use the preferred language supplied in context and respond naturally in that language without a separate translation step. Escalate only when a protected decision is required, trusted data conflicts, a legal/financial/safety/scam matter requires human judgement, an owner-level partnership decision is requested, or the issue cannot be reliably resolved after reasonable troubleshooting. When escalating, still acknowledge the user and explain that context has been passed to a human. All ResKonnect links must use https://www.reskonnect.org. Return JSON only with keys answer, confidence, risk, escalate, reason. risk must be green, amber or red.',
  jsonb_build_object('release',5,'persona','Dimpho','authority','green','deterministic_first',true,'minimise_ai_calls',true,'multilingual_single_call',true,'human_escalation',true,'never_silent_on_escalation',true,'no_cross_user_data',true,'popia_minimisation',true,'verified_data_only',true),
  jsonb_build_array('read_contact','read_application','read_residence','read_knowledge','draft_reply','request_human_review'),true
)
on conflict (agent_key,version) do update set name=excluded.name,system_prompt=excluded.system_prompt,policy=excluded.policy,tool_allowlist=excluded.tool_allowlist,active=true;
