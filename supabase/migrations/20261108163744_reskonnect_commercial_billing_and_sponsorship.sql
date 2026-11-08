-- Phase 6: configurable, audit-ready commercial operations.
-- No prices are assumed, no merchant credentials are embedded, and all paid
-- features begin disabled. Manual financial reconciliation is explicit.

create table if not exists public.reskonnect_commercial_issuer (
 singleton boolean primary key default true check(singleton),
 legal_name text not null check(length(trim(legal_name)) between 3 and 180),
 billing_email text not null check(length(billing_email) between 5 and 254),
 registered_address text not null check(length(trim(registered_address))>=10),
 company_registration text,
 vat_number text,
 bank_payment_instructions text,
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.reskonnect_commercial_issuer enable row level security;
revoke all on public.reskonnect_commercial_issuer from public,anon,authenticated;
grant select,insert,update on public.reskonnect_commercial_issuer to authenticated;
grant all on public.reskonnect_commercial_issuer to service_role;
create policy rk_issuer_read on public.reskonnect_commercial_issuer for select to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role));
create policy rk_issuer_write on public.reskonnect_commercial_issuer for insert to authenticated
 with check(public.has_role((select auth.uid()),'admin'::public.app_role) and updated_by=(select auth.uid()));
create policy rk_issuer_update on public.reskonnect_commercial_issuer for update to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role))
 with check(public.has_role((select auth.uid()),'admin'::public.app_role) and updated_by=(select auth.uid()));

create table if not exists public.reskonnect_commercial_products (
 code text primary key check(code ~ '^[a-z][a-z0-9_]{3,44}$'),
 name text not null check(length(trim(name)) between 3 and 120),
 description text not null default '',
 billing_unit text not null check(billing_unit in
   ('per_live_listing_month','per_bed_month','per_confirmed_placement','one_time_promotion')),
 unit_price_cents bigint check(unit_price_cents between 0 and 10000000000),
 vat_rate_percent numeric(5,2) check(vat_rate_percent between 0 and 100),
 tax_inclusive boolean not null default true,
 is_active boolean not null default false,
 updated_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint rk_active_product_has_tax_and_price check(not is_active or
      (unit_price_cents is not null and unit_price_cents>0 and vat_rate_percent is not null))
);
alter table public.reskonnect_commercial_products enable row level security;
revoke all on public.reskonnect_commercial_products from public,anon,authenticated;
grant select,insert,update on public.reskonnect_commercial_products to authenticated;
grant all on public.reskonnect_commercial_products to service_role;
create policy rk_products_read on public.reskonnect_commercial_products for select to authenticated
 using(is_active or public.has_role((select auth.uid()),'admin'::public.app_role));
create policy rk_products_write on public.reskonnect_commercial_products for insert to authenticated
 with check(public.has_role((select auth.uid()),'admin'::public.app_role)
 and updated_by=(select auth.uid()));
create policy rk_products_update on public.reskonnect_commercial_products for update to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role))
 with check(public.has_role((select auth.uid()),'admin'::public.app_role)
 and updated_by=(select auth.uid()));

-- Product definitions are intentionally unpriced and not active. Admin must
-- specify an approved ZAR price and explicit tax rate before activation.
insert into public.reskonnect_commercial_products(code,name,description,billing_unit)
values ('listing_monthly','Residence listing subscription','Monthly fee per live listing','per_live_listing_month'),
('managed_bed_monthly','Residence operations management','Monthly operations service per bed','per_bed_month'),
('confirmed_placement','Verified tenant placement','Fee only following confirmed and audited tenant placement','per_confirmed_placement'),
('sponsored_feature','Sponsored residence placement','Clearly labelled sponsored discoverability slot','one_time_promotion')
on conflict(code) do nothing;

create table if not exists public.reskonnect_commercial_billing_profiles (
 residence_id uuid primary key references public.residences(id) on delete cascade,
 legal_name text not null check(length(trim(legal_name)) between 3 and 180),
 billing_email text not null check(length(billing_email) between 5 and 254),
 billing_address text not null check(length(trim(billing_address))>=8),
 vat_number text,
 company_registration text,
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.reskonnect_commercial_billing_profiles enable row level security;
revoke all on public.reskonnect_commercial_billing_profiles from public,anon,authenticated;
grant select,insert,update on public.reskonnect_commercial_billing_profiles to authenticated;
grant all on public.reskonnect_commercial_billing_profiles to service_role;
create policy rk_billing_profile_read on public.reskonnect_commercial_billing_profiles for select to authenticated
 using(public.is_authorized_residence_user(residence_id) or public.has_role((select auth.uid()),'admin'::public.app_role));
create policy rk_billing_profile_insert on public.reskonnect_commercial_billing_profiles for insert to authenticated
 with check((public.is_authorized_residence_user(residence_id) or
 public.has_role((select auth.uid()),'admin'::public.app_role)) and updated_by=(select auth.uid()));
create policy rk_billing_profile_update on public.reskonnect_commercial_billing_profiles for update to authenticated
 using(public.is_authorized_residence_user(residence_id) or public.has_role((select auth.uid()),'admin'::public.app_role))
 with check((public.is_authorized_residence_user(residence_id) or
 public.has_role((select auth.uid()),'admin'::public.app_role)) and updated_by=(select auth.uid()));

create sequence if not exists public.reskonnect_commercial_invoice_number_seq as bigint start with 10001;
revoke all on sequence public.reskonnect_commercial_invoice_number_seq from public,anon,authenticated;
grant usage on sequence public.reskonnect_commercial_invoice_number_seq to service_role;

create table if not exists public.reskonnect_commercial_invoices (
 id uuid primary key default gen_random_uuid(),
 invoice_number text not null unique,
 residence_id uuid not null references public.residences(id) on delete restrict,
 product_code text not null references public.reskonnect_commercial_products(code),
 quantity integer not null check(quantity between 1 and 10000),
 billing_unit text not null,
 unit_price_cents bigint not null check(unit_price_cents>=0),
 subtotal_cents bigint not null check(subtotal_cents>=0),
 tax_rate_percent numeric(5,2) not null,
 tax_inclusive boolean not null,
 tax_cents bigint not null check(tax_cents>=0),
 total_cents bigint not null check(total_cents>0),
 currency text not null default 'ZAR' check(currency='ZAR'),
 issuer_snapshot jsonb not null,
 recipient_snapshot jsonb not null,
 status text not null default 'issued' check(status in
  ('issued','payment_review','paid','void')),
 due_date date not null,
 issued_at timestamptz not null default now(),
 payment_reference text,
 payment_review_note text,
 marked_paid_at timestamptz,
 marked_paid_by uuid references auth.users(id),
 settlement_method text check(settlement_method in ('manual_verified_eft')),
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
create index if not exists rk_invoice_residence on public.reskonnect_commercial_invoices(residence_id,issued_at desc);
create index if not exists rk_invoice_status on public.reskonnect_commercial_invoices(status,issued_at desc);
alter table public.reskonnect_commercial_invoices enable row level security;
revoke all on public.reskonnect_commercial_invoices from public,anon,authenticated;
grant select on public.reskonnect_commercial_invoices to authenticated;
grant all on public.reskonnect_commercial_invoices to service_role;
create policy rk_invoices_read on public.reskonnect_commercial_invoices for select to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role)
  or public.is_authorized_residence_user(residence_id));

create table if not exists public.reskonnect_commercial_audit (
 id bigint generated always as identity primary key,
 invoice_id uuid references public.reskonnect_commercial_invoices(id) on delete restrict,
 residence_id uuid references public.residences(id) on delete restrict,
 actor_user_id uuid references auth.users(id),
 event_type text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists rk_billing_audit_invoice on public.reskonnect_commercial_audit(invoice_id,created_at desc);
alter table public.reskonnect_commercial_audit enable row level security;
revoke all on public.reskonnect_commercial_audit from public,anon,authenticated;
grant select on public.reskonnect_commercial_audit to authenticated;
grant all on public.reskonnect_commercial_audit to service_role;
create policy rk_commercial_audit_read on public.reskonnect_commercial_audit for select to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role)
       or public.is_authorized_residence_user(residence_id));

create or replace function public.reskonnect_issue_invoice(
 p_residence_id uuid,p_product_code text,p_quantity integer,p_due_date date
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare product public.reskonnect_commercial_products%rowtype;
issuer public.reskonnect_commercial_issuer%rowtype;
payer public.reskonnect_commercial_billing_profiles%rowtype;
subtotal bigint; tax bigint; total bigint; result_id uuid;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then
   raise exception 'Admin finance approval required' using errcode='42501';end if;
 if p_quantity<1 or p_quantity>10000 then raise exception 'Invalid commercial quantity';end if;
 if p_due_date<current_date or p_due_date>current_date+90 then raise exception 'Choose a due date within 90 days';end if;
 select * into product from public.reskonnect_commercial_products where code=p_product_code and is_active for share;
 if not found then raise exception 'Commercial product is not active or approved';end if;
 select * into issuer from public.reskonnect_commercial_issuer where singleton=true;
 if not found then raise exception 'Configure ResKonnect legal issuer details before invoicing';end if;
 select * into payer from public.reskonnect_commercial_billing_profiles where residence_id=p_residence_id;
 if not found then raise exception 'Landlord billing profile is not complete';end if;
 subtotal:=product.unit_price_cents*p_quantity;
 if product.tax_inclusive then
   tax:=round(subtotal*product.vat_rate_percent/(100+product.vat_rate_percent));
   total:=subtotal;
 else
   tax:=round(subtotal*product.vat_rate_percent/100);
   total:=subtotal+tax;
 end if;
 insert into public.reskonnect_commercial_invoices
 (invoice_number,residence_id,product_code,quantity,billing_unit,unit_price_cents,
 subtotal_cents,tax_rate_percent,tax_inclusive,tax_cents,total_cents,due_date,
 issuer_snapshot,recipient_snapshot,created_by)
 values(
 'RK-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.reskonnect_commercial_invoice_number_seq')::text,7,'0'),
 p_residence_id,p_product_code,p_quantity,product.billing_unit,product.unit_price_cents,
 subtotal,product.vat_rate_percent,product.tax_inclusive,tax,total,p_due_date,
 to_jsonb(issuer)-'updated_by'-'updated_at'-'singleton',
 to_jsonb(payer)-'updated_by'-'created_at'-'updated_at',auth.uid())
 returning id into result_id;
 insert into public.reskonnect_commercial_audit(invoice_id,residence_id,actor_user_id,event_type,metadata)
 values(result_id,p_residence_id,auth.uid(),'invoice_issued',jsonb_build_object('product_code',p_product_code,'quantity',p_quantity));
 return result_id;
end;
$fn$;
revoke all on function public.reskonnect_issue_invoice(uuid,text,integer,date) from public,anon;
grant execute on function public.reskonnect_issue_invoice(uuid,text,integer,date) to authenticated;

create or replace function public.reskonnect_submit_invoice_payment_reference(
 p_invoice_id uuid,p_reference text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare invoice_row public.reskonnect_commercial_invoices%rowtype;
begin
 if auth.uid() is null then raise exception 'Login required' using errcode='42501';end if;
 select * into invoice_row from public.reskonnect_commercial_invoices where id=p_invoice_id for update;
 if not found or not public.is_authorized_residence_user(invoice_row.residence_id) then
   raise exception 'Invoice unavailable to this residence' using errcode='42501';end if;
 if invoice_row.status not in ('issued','payment_review') then raise exception 'Invoice is not awaiting payment';end if;
 if length(trim(coalesce(p_reference,'')))<6 or length(p_reference)>140 then raise exception 'Enter a valid EFT reference';end if;
 update public.reskonnect_commercial_invoices set status='payment_review',
 payment_reference=trim(p_reference),payment_review_note=null,updated_at=now() where id=p_invoice_id;
 insert into public.reskonnect_commercial_audit(invoice_id,residence_id,actor_user_id,event_type,metadata)
 values(p_invoice_id,invoice_row.residence_id,auth.uid(),'reference_submitted',jsonb_build_object('reference_last4',right(trim(p_reference),4)));
 return jsonb_build_object('ok',true,'status','payment_review','provider_verified',false);
end;
$fn$;
revoke all on function public.reskonnect_submit_invoice_payment_reference(uuid,text) from public,anon;
grant execute on function public.reskonnect_submit_invoice_payment_reference(uuid,text) to authenticated;

create or replace function public.reskonnect_reconcile_invoice(
 p_invoice_id uuid,p_action text,p_bank_reference text,p_reconciliation_note text,p_verified_from_bank boolean
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare inv public.reskonnect_commercial_invoices%rowtype;
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then
  raise exception 'Admin finance authorization required' using errcode='42501';end if;
 if p_action not in ('verify_paid','void','request_recheck') then raise exception 'Invalid reconciliation action';end if;
 select * into inv from public.reskonnect_commercial_invoices where id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found';end if;
 if inv.status in ('paid','void') then raise exception 'Finalized invoice cannot be changed';end if;
 if length(trim(coalesce(p_reconciliation_note,'')))<15 then
   raise exception 'A meaningful finance audit note is mandatory';end if;
 if p_action='verify_paid' then
   if not p_verified_from_bank or length(trim(coalesce(p_bank_reference,'')))<8 then
    raise exception 'Verify the bank transaction independently and record its reference';end if;
   update public.reskonnect_commercial_invoices set status='paid',
    payment_reference=trim(p_bank_reference),payment_review_note=left(trim(p_reconciliation_note),1200),
    marked_paid_at=now(),marked_paid_by=auth.uid(),
    settlement_method='manual_verified_eft',updated_at=now() where id=p_invoice_id;
 elsif p_action='void' then
   update public.reskonnect_commercial_invoices set status='void',
     payment_review_note=left(trim(p_reconciliation_note),1200),updated_at=now()
    where id=p_invoice_id;
 else
   update public.reskonnect_commercial_invoices set status='issued',
     payment_review_note=left(trim(p_reconciliation_note),1200),updated_at=now()
    where id=p_invoice_id;
 end if;
 insert into public.reskonnect_commercial_audit(invoice_id,residence_id,actor_user_id,event_type,metadata)
 values(p_invoice_id,inv.residence_id,auth.uid(),p_action,
   jsonb_build_object('verified_independently',p_action='verify_paid' and p_verified_from_bank));
 return jsonb_build_object('ok',true,'status',case p_action when 'verify_paid' then 'paid'
   when 'void' then 'void' else 'issued' end,'settlement','manual_bank_review');
end;
$fn$;
revoke all on function public.reskonnect_reconcile_invoice(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.reskonnect_reconcile_invoice(uuid,text,text,text,boolean) to authenticated;

-- Sponsor placement always clearly labelled, approval-gated, and never
-- falsely treated as a price promotion or independent accreditation.
create table if not exists public.reskonnect_commercial_promotions (
 id uuid primary key default gen_random_uuid(),
 residence_id uuid not null references public.residences(id) on delete restrict,
 title text not null check(length(title) between 4 and 100),
 description text not null default '',
 placement text not null check(placement in ('find','home')),
 funding_basis text not null check(funding_basis in ('complimentary','paid_invoice')),
 invoice_id uuid references public.reskonnect_commercial_invoices(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'draft' check(status in ('draft','approved','paused','cancelled')),
 approved_by uuid references auth.users(id),
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '365 days'),
 check(funding_basis='complimentary' or invoice_id is not null)
);
create index if not exists rk_promotions_schedule on public.reskonnect_commercial_promotions(status,placement,starts_at,ends_at);
alter table public.reskonnect_commercial_promotions enable row level security;
revoke all on public.reskonnect_commercial_promotions from public,anon,authenticated;
grant select,insert,update on public.reskonnect_commercial_promotions to authenticated;
grant all on public.reskonnect_commercial_promotions to service_role;
create policy rk_promotion_manage_read on public.reskonnect_commercial_promotions for select to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role)
 or public.is_authorized_residence_user(residence_id));
create policy rk_promotion_admin_create on public.reskonnect_commercial_promotions for insert to authenticated
 with check(public.has_role((select auth.uid()),'admin'::public.app_role)
 and created_by=(select auth.uid()) and status='draft');
create policy rk_promotion_admin_update on public.reskonnect_commercial_promotions for update to authenticated
 using(public.has_role((select auth.uid()),'admin'::public.app_role))
 with check(public.has_role((select auth.uid()),'admin'::public.app_role));

create or replace function reskonnect_internal.guard_sponsored_promotion()
returns trigger language plpgsql security invoker set search_path=''
as $fn$
declare inv public.reskonnect_commercial_invoices%rowtype;
begin
 if new.status='approved' then
   if not public.has_role(auth.uid(),'admin'::public.app_role) then
      raise exception 'Administrator approval is required';end if;
   if not exists(select 1 from public.residences r where r.id=new.residence_id
     and r.is_visible=true and coalesce(r.cover_image_url,r.image_url) is not null) then
     raise exception 'A visible residence with real property imagery is required';end if;
   if new.funding_basis='paid_invoice' then
     select * into inv from public.reskonnect_commercial_invoices where id=new.invoice_id;
     if not found or inv.residence_id<>new.residence_id or inv.status<>'paid'
       or inv.product_code<>'sponsored_feature' then
       raise exception 'A verified paid promotion invoice for this residence is required';end if;
   end if;
   new.approved_by:=auth.uid();
 end if;
 new.updated_at:=now();
 return new;
end;
$fn$;
revoke all on function reskonnect_internal.guard_sponsored_promotion() from public,anon,authenticated;
create trigger rk_promo_approval before insert or update on public.reskonnect_commercial_promotions
 for each row execute function reskonnect_internal.guard_sponsored_promotion();

-- Expose only safe public campaign details; never the invoice, price, or payer.
create or replace view public.reskonnect_sponsored_residences_v with(security_invoker=true)
as select id,residence_id,title,description,placement,starts_at,ends_at,
  'Sponsored'::text as disclosure_label
from public.reskonnect_commercial_promotions
where status='approved' and starts_at<=now() and ends_at>now();
-- Invoker view needs a public RLS policy, while sensitive financial columns
-- are reachable only through the restricted base table.
grant select on public.reskonnect_sponsored_residences_v to anon,authenticated;
grant select on public.reskonnect_commercial_promotions to anon;
create policy rk_sponsored_public_read on public.reskonnect_commercial_promotions for select to anon,authenticated
 using(status='approved' and starts_at<=now() and ends_at>now());
-- Revoke base-table access from anon; use a narrow, RLS-safe public projection
-- in a dedicated query RPC instead of exposing invoices and funding details.
revoke select on public.reskonnect_commercial_promotions from anon;

create or replace function public.reskonnect_public_sponsored_residences(p_placement text default 'find')
returns table (residence_id uuid,title text,description text,placement text,disclosure_label text)
language sql stable security definer set search_path=''
as $fn$
 select p.residence_id,p.title,p.description,p.placement,'Sponsored'::text
 from public.reskonnect_commercial_promotions p join public.residences r on r.id=p.residence_id
 where p.status='approved' and p.starts_at<=now() and p.ends_at>now()
   and p.placement=p_placement and r.is_visible=true
 order by p.starts_at desc limit 24;
$fn$;
revoke all on function public.reskonnect_public_sponsored_residences(text) from public;
grant execute on function public.reskonnect_public_sponsored_residences(text) to anon,authenticated;
comment on function public.reskonnect_public_sponsored_residences(text) is 'Only public, active, approved, clearly labelled sponsorships. No billing data.';
