-- Phase 9/10: Multilingual Dimpho
-- Deterministic language preference + phrase library + localized WhatsApp menus. No translation/model call required.

alter table public.adminos_whatsapp_threads
  add column if not exists language_code text not null default 'en';

create table if not exists public.adminos_contact_languages (
  contact_id uuid primary key references public.adminos_contacts(id) on delete cascade,
  language_code text not null default 'en' check (language_code in ('en','zu','nso','tn','st','xh','af')),
  detection_source text not null default 'default' check (detection_source in ('default','detected','selected','profile','staff')),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  updated_at timestamptz not null default now()
);
alter table public.adminos_contact_languages enable row level security;
drop policy if exists "Language preference visible to owner and staff" on public.adminos_contact_languages;
create policy "Language preference visible to owner and staff" on public.adminos_contact_languages for select to authenticated
using (contact_id in (select id from public.adminos_contacts where profile_user_id=auth.uid()) or (select public.adminos_is_staff()));
revoke all on public.adminos_contact_languages from anon;
grant select on public.adminos_contact_languages to authenticated;

create table if not exists public.adminos_i18n_phrases (
  phrase_key text not null,
  language_code text not null check (language_code in ('en','zu','nso','tn','st','xh','af')),
  phrase_text text not null,
  primary key (phrase_key,language_code)
);
alter table public.adminos_i18n_phrases enable row level security;
drop policy if exists "I18n phrases readable" on public.adminos_i18n_phrases;
create policy "I18n phrases readable" on public.adminos_i18n_phrases for select to authenticated using (true);
revoke all on public.adminos_i18n_phrases from anon;
grant select on public.adminos_i18n_phrases to authenticated;

insert into public.adminos_i18n_phrases(phrase_key,language_code,phrase_text) values
('thanks','en','Thank you. I have saved that.'),
('thanks','zu','Ngiyabonga. Ngikulondolozile lokho.'),
('thanks','nso','Ke a leboga. Ke bolokile seo.'),
('thanks','tn','Ke a leboga. Ke bolokile seo.'),
('thanks','st','Kea leboha. Ke bolokile seo.'),
('thanks','xh','Enkosi. Ndiyigcinile loo nto.'),
('thanks','af','Dankie. Ek het dit gestoor.'),
('csat_thanks','en','Thank you for rating your ResKonnect experience. Your feedback helps us improve our service.'),
('csat_thanks','zu','Siyabonga ngokulinganisa ulwazi lwakho lwe-ResKonnect. Impendulo yakho isisiza sithuthukise isevisi yethu.'),
('csat_thanks','nso','Re leboga tekolo ya gago ya maitemogelo a ResKonnect. Karabo ya gago e re thuša go kaonafatša tirelo.'),
('csat_thanks','tn','Re lebogela tekanyetso ya gago ya maitemogelo a ResKonnect. Karabo ya gago e re thusa go tokafatsa tirelo.'),
('csat_thanks','st','Rea leboha ka ho lekanya boiphihlelo ba hao ba ResKonnect. Maikutlo a hao a re thusa ho ntlafatsa tshebeletso.'),
('csat_thanks','xh','Enkosi ngokulinganisa amava akho eResKonnect. Ingxelo yakho isinceda siphucule inkonzo yethu.'),
('csat_thanks','af','Dankie dat jy jou ResKonnect-ervaring beoordeel het. Jou terugvoer help ons om ons diens te verbeter.'),
('human_wait','en','A ResKonnect team member will take over this conversation. Your context is already attached, so you do not need to repeat yourself.'),
('human_wait','zu','Ilungu lethimba le-ResKonnect lizothatha ingxoxo. Umongo wakho usunamathiselwe, ngakho awudingi ukuphinda konke.'),
('human_wait','nso','Setho sa sehlopha sa ResKonnect se tla tšea poledišano. Dintlha tša gago di šetše di kgomaretšwe, ka gona ga go hlokagale gore o boeletše.'),
('human_wait','tn','Leloko la setlhopha sa ResKonnect le tla tsaya puisano. Dintlha tsa gago di setse di le teng, ka jalo ga o tlhoke go ipoeletsa.'),
('human_wait','st','Setho sa sehlopha sa ResKonnect se tla nka puisano. Dintlha tsa hao di se di hoketswe, kahoo ha o hloke ho ipheta.'),
('human_wait','xh','Ilungu leqela leResKonnect liza kuthatha incoko. Umxholo wakho sele uqhotyoshelwe, ngoko akufuneki uphinde yonke into.'),
('human_wait','af','’n ResKonnect-spanlid sal die gesprek oorneem. Jou konteks is reeds aangeheg, so jy hoef jouself nie te herhaal nie.')
on conflict (phrase_key,language_code) do update set phrase_text=excluded.phrase_text;

create or replace function public.adminos_detect_language(p_text text)
returns text language plpgsql immutable as $$
declare v text:=lower(coalesce(p_text,''));
begin
  if v ~ '\b(afrikaans|dankie|asseblief|verblyf|vandag|hallo)\b' then return 'af'; end if;
  if v ~ '\b(isizulu|sawubona|ngiyabonga|ngicela|indawo yokuhlala|namuhla)\b' then return 'zu'; end if;
  if v ~ '\b(isixhosa|molo|enkosi|ndicela|namhlanje|ndifuna)\b' then return 'xh'; end if;
  if v ~ '\b(sepedi|ke a leboga|dumela|lehono|thuša|nyaka)\b' then return 'nso'; end if;
  if v ~ '\b(setswana|ke a leboga|gompieno|thusa|tlhoka|batla)\b' then return 'tn'; end if;
  if v ~ '\b(sesotho|kea leboha|kajeno|thusa|hloka|batla)\b' then return 'st'; end if;
  return 'en';
end; $$;

create or replace function public.adminos_set_contact_language(p_contact_id uuid,p_language_code text,p_source text default 'selected',p_confidence numeric default 1)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_language_code not in ('en','zu','nso','tn','st','xh','af') then raise exception 'Unsupported language'; end if;
  insert into public.adminos_contact_languages(contact_id,language_code,detection_source,confidence,updated_at)
  values(p_contact_id,p_language_code,case when p_source in ('default','detected','selected','profile','staff') then p_source else 'selected' end,least(1,greatest(0,p_confidence)),now())
  on conflict (contact_id) do update set language_code=excluded.language_code,detection_source=excluded.detection_source,confidence=excluded.confidence,updated_at=now();
  update public.adminos_whatsapp_threads set language_code=p_language_code,updated_at=now() where contact_id=p_contact_id;
end; $$;
revoke all on function public.adminos_set_contact_language(uuid,text,text,numeric) from public,anon;

insert into public.adminos_whatsapp_rich_content(content_key,display_name,content_type,approval_required,purpose,status,config) values
('rk_language_menu','Choose language','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Choose the language you want Dimpho to use.','button','Language','items',jsonb_build_array(
  jsonb_build_object('item','English','id','lang:en','description','Continue in English'),
  jsonb_build_object('item','isiZulu','id','lang:zu','description','Qhubeka ngesiZulu'),
  jsonb_build_object('item','Sepedi','id','lang:nso','description','Tšwela pele ka Sepedi'),
  jsonb_build_object('item','Setswana','id','lang:tn','description','Tswelela ka Setswana'),
  jsonb_build_object('item','Sesotho','id','lang:st','description','Tswela pele ka Sesotho'),
  jsonb_build_object('item','isiXhosa','id','lang:xh','description','Qhubeka ngesiXhosa'),
  jsonb_build_object('item','Afrikaans','id','lang:af','description','Gaan voort in Afrikaans')
))),
('rk_main_menu_zu','ResKonnect main menu — isiZulu','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Sawubona {{1}}. Siyabonga ngokuxhumana ne-ResKonnect. Singakusiza ngani namuhla?','button','Khetha','items',jsonb_build_array(
  jsonb_build_object('item','Indawo yokuhlala','id','menu:accommodation','description','Thola, faka isicelo noma ubhukhe'),
  jsonb_build_object('item','Izicelo','id','menu:applications','description','Landela isicelo noma amadokhumenti'),
  jsonb_build_object('item','WIL namathuba','id','menu:opportunities','description','WIL, amathuba nokubekwa'),
  jsonb_build_object('item','Izinsiza zethu','id','menu:company','description','Ulwazi nge-ResKonnect'),
  jsonb_build_object('item','Usizo lwe-app','id','menu:technical','description','Ukungena, i-app noma iwebhusayithi'),
  jsonb_build_object('item','Khuluma nomuntu','id','menu:human','description','Dlulisela ethimbeni'),
  jsonb_build_object('item','Shintsha ulimi','id','menu:language','description','Khetha olunye ulimi')
))),
('rk_main_menu_nso','ResKonnect main menu — Sepedi','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Dumela {{1}}. Re leboga ge o ikgokagantše le ResKonnect. Re ka go thuša ka eng lehono?','button','Kgetha','items',jsonb_build_array(
  jsonb_build_object('item','Madulo','id','menu:accommodation','description','Hwetša, dira kgopelo goba boloka'),
  jsonb_build_object('item','Dikgopelo','id','menu:applications','description','Latela kgopelo le ditokomane'),
  jsonb_build_object('item','WIL le menyetla','id','menu:opportunities','description','WIL, menyetla le placement'),
  jsonb_build_object('item','Ditirelo tša rena','id','menu:company','description','Tsebo ka ResKonnect'),
  jsonb_build_object('item','Thušo ya app','id','menu:technical','description','Login, app goba website'),
  jsonb_build_object('item','Bolela le motho','id','menu:human','description','Fetišetša go sehlopha'),
  jsonb_build_object('item','Fetola polelo','id','menu:language','description','Kgetha polelo ye nngwe')
))),
('rk_main_menu_tn','ResKonnect main menu — Setswana','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Dumela {{1}}. Re lebogela go ikgolaganya le ResKonnect. Re ka go thusa ka eng gompieno?','button','Tlhopha','items',jsonb_build_array(
  jsonb_build_object('item','Bonno','id','menu:accommodation','description','Batla, dira kopo kgotsa boloka'),
  jsonb_build_object('item','Dikopo','id','menu:applications','description','Latela kopo le ditokomane'),
  jsonb_build_object('item','WIL le ditshono','id','menu:opportunities','description','WIL, ditshono le placement'),
  jsonb_build_object('item','Ditirelo tsa rona','id','menu:company','description','Tshedimosetso ka ResKonnect'),
  jsonb_build_object('item','Thuso ya app','id','menu:technical','description','Login, app kgotsa website'),
  jsonb_build_object('item','Bua le motho','id','menu:human','description','Fetisetsa kwa setlhopheng'),
  jsonb_build_object('item','Fetola puo','id','menu:language','description','Tlhopha puo e nngwe')
))),
('rk_main_menu_st','ResKonnect main menu — Sesotho','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Dumela {{1}}. Rea leboha ka ho ikopanya le ResKonnect. Re ka o thusa ka eng kajeno?','button','Kgetha','items',jsonb_build_array(
  jsonb_build_object('item','Bolulo','id','menu:accommodation','description','Batla, etsa kopo kapa boloka'),
  jsonb_build_object('item','Dikopo','id','menu:applications','description','Latela kopo le ditokomane'),
  jsonb_build_object('item','WIL le menyetla','id','menu:opportunities','description','WIL, menyetla le placement'),
  jsonb_build_object('item','Ditshebeletso','id','menu:company','description','Tsebo ka ResKonnect'),
  jsonb_build_object('item','Thuso ya app','id','menu:technical','description','Login, app kapa website'),
  jsonb_build_object('item','Bua le motho','id','menu:human','description','Fetisetsa ho sehlopha'),
  jsonb_build_object('item','Fetola puo','id','menu:language','description','Kgetha puo e nngwe')
))),
('rk_main_menu_xh','ResKonnect main menu — isiXhosa','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Molo {{1}}. Enkosi ngokuqhagamshelana neResKonnect. Singakunceda ngantoni namhlanje?','button','Khetha','items',jsonb_build_array(
  jsonb_build_object('item','Indawo yokuhlala','id','menu:accommodation','description','Fumana, faka isicelo okanye ubhukishe'),
  jsonb_build_object('item','Izicelo','id','menu:applications','description','Landela isicelo namaxwebhu'),
  jsonb_build_object('item','WIL namathuba','id','menu:opportunities','description','WIL, amathuba ne-placement'),
  jsonb_build_object('item','Iinkonzo zethu','id','menu:company','description','Ulwazi ngeResKonnect'),
  jsonb_build_object('item','Uncedo lwe-app','id','menu:technical','description','Login, app okanye website'),
  jsonb_build_object('item','Thetha nomntu','id','menu:human','description','Dlulisela kwiqela'),
  jsonb_build_object('item','Tshintsha ulwimi','id','menu:language','description','Khetha olunye ulwimi')
))),
('rk_main_menu_af','ResKonnect main menu — Afrikaans','twilio/list-picker',false,'service','not_created',jsonb_build_object('body','Hallo {{1}}. Dankie dat jy ResKonnect kontak. Hoe kan ons jou vandag help?','button','Kies','items',jsonb_build_array(
  jsonb_build_object('item','Verblyf','id','menu:accommodation','description','Vind, doen aansoek of bespreek'),
  jsonb_build_object('item','Aansoeke','id','menu:applications','description','Volg status en dokumente'),
  jsonb_build_object('item','WIL en geleenthede','id','menu:opportunities','description','WIL, plasing en geleenthede'),
  jsonb_build_object('item','Ons dienste','id','menu:company','description','Meer oor ResKonnect'),
  jsonb_build_object('item','App-ondersteuning','id','menu:technical','description','Aanmeld, app of webwerf'),
  jsonb_build_object('item','Praat met iemand','id','menu:human','description','Eskaleer na die span'),
  jsonb_build_object('item','Verander taal','id','menu:language','description','Kies n ander taal')
)))
on conflict (content_key) do update set display_name=excluded.display_name,content_type=excluded.content_type,approval_required=excluded.approval_required,purpose=excluded.purpose,config=excluded.config,status=case when adminos_whatsapp_rich_content.content_sid is null then 'not_created' else adminos_whatsapp_rich_content.status end,updated_at=now();