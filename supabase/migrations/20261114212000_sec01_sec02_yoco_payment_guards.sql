-- SEC-01 / SEC-02: do not expose order-money writes to customers; reconcile only verified Yoco events.
-- Shop checkout has zero live orders/payments at audit time; preserve EFT proof submission.
-- All public security-definer RPCs below include deliberate JWT/role guards and REVOKE-by-default.
create table if not exists public.rk_yoco_payment_intents (
  order_id uuid primary key references public.shop_orders(id) on delete cascade,
  checkout_id text unique not null,
  user_id uuid not null references public.profiles(id),
  amount_cents bigint not null check (amount_cents >= 200),
  currency text not null default 'ZAR' check(currency='ZAR'),
  created_at timestamptz not null default now()
);
create table if not exists public.rk_yoco_verified_events (
  event_id text primary key,
  order_id uuid not null references public.shop_orders(id),
  checkout_id text not null,
  payment_reference text,
  event_type text not null check(event_type in('payment.succeeded','payment.failed')),
  amount_cents bigint not null,
  currency text not null default 'ZAR' check(currency='ZAR'),
  result text not null,
  received_at timestamptz not null default now()
);
alter table public.rk_yoco_payment_intents enable row level security;
alter table public.rk_yoco_verified_events enable row level security;
revoke all on public.rk_yoco_payment_intents from public,anon,authenticated;
revoke all on public.rk_yoco_verified_events from public,anon,authenticated;
create unique index if not exists rk_yoco_paid_payment_reference_unique
 on public.payments(transaction_reference)
 where payment_gateway='yoco' and transaction_reference is not null;

-- A user's ALL policy allowed them to set paid/confirmed without a payment. Replace it.
drop policy if exists "users_manage_own_shop_orders" on public.shop_orders;
drop policy if exists rk_shop_orders_user_read on public.shop_orders;
drop policy if exists rk_shop_orders_user_insert on public.shop_orders;
drop policy if exists rk_shop_orders_user_update_limited on public.shop_orders;
create policy rk_shop_orders_user_read on public.shop_orders for select to authenticated
 using ((select auth.uid())=user_id);
create policy rk_shop_orders_user_insert on public.shop_orders for insert to authenticated
 with check (
  (select auth.uid())=user_id and status='pending' and
  payment_status in('pending','awaiting_payment') and
  payment_method in('cod','eft','yoco') and yoco_checkout_id is null and
  coalesce(commission_amount,0)=0 and coalesce(referral_credited,false)=false and
  coalesce(payout_status,'pending')='pending'
 );
create policy rk_shop_orders_user_update_limited on public.shop_orders for update to authenticated
 using((select auth.uid())=user_id)
 with check((select auth.uid())=user_id);

create or replace function reskonnect_internal.rk_shop_order_guard_money()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_admin boolean;
begin
 if auth.role()='service_role' then return new; end if;
 v_admin:=coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false)
  or coalesce(public.has_admin_department_access('finance_admin'),false);
 if v_admin then return new; end if;
 if auth.uid() is null or new.user_id is distinct from auth.uid() then
  raise exception 'Order ownership required' using errcode='42501';
 end if;
 if TG_OP='INSERT' then
  if new.status is distinct from 'pending' or
    new.payment_status not in('pending','awaiting_payment') or
    new.yoco_checkout_id is not null or
    new.payment_method not in('cod','eft','yoco') then
   raise exception 'Order payment fields cannot be set by customers' using errcode='42501';
  end if;
  return new;
 end if;
 -- Only nonfinancial delivery notes and proof metadata may change; never "paid".
 if (to_jsonb(new)-array['notes','delivery_address','delivery_phone','pop_url','pop_uploaded_at','payment_status','updated_at'])
   is distinct from
   (to_jsonb(old)-array['notes','delivery_address','delivery_phone','pop_url','pop_uploaded_at','payment_status','updated_at']) then
  raise exception 'Order financial and fulfillment fields are server controlled' using errcode='42501';
 end if;
 if new.payment_status is distinct from old.payment_status and not (
  old.payment_method='eft' and old.status='pending' and
  old.payment_status in('pending','awaiting_payment') and new.payment_status='awaiting_verification'
  and new.pop_url is not null and length(new.pop_url)>12
 ) then
  raise exception 'Customer cannot change payment status' using errcode='42501';
 end if;
 return new;
end $fn$;
revoke all on function reskonnect_internal.rk_shop_order_guard_money() from public,anon,authenticated;
drop trigger if exists rk_shop_order_guard_money_trigger on public.shop_orders;
create trigger rk_shop_order_guard_money_trigger
before insert or update on public.shop_orders
for each row execute function reskonnect_internal.rk_shop_order_guard_money();

-- Recompute the charge from actual product/variant/hamper catalogue, never from client totals.
-- Existing shop order item inserts are still mediated by their own separate RLS; reject missing items.
create or replace function public.rk_yoco_checkout_quote(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_order public.shop_orders%rowtype;
 v_count integer;v_invalid integer;v_subtotal_cents bigint;
 v_delivery numeric:=0;v_zone public.delivery_zones%rowtype;
 v_total_cents bigint;v_active_zones boolean;
begin
 if auth.uid() is null then
  raise exception 'Authentication required' using errcode='42501';
 end if;
 select * into v_order from public.shop_orders where id=p_order_id and user_id=auth.uid();
 if not found then raise exception 'Order not found or access denied' using errcode='42501';end if;
 if v_order.status<>'pending' or v_order.payment_method<>'yoco' or
    v_order.payment_status not in('pending','awaiting_payment') or
    v_order.yoco_checkout_id is not null then
  raise exception 'Order not eligible for Yoco checkout' using errcode='22023';
 end if;
 select count(*),count(*) filter(where unit_price is null or unit_price<=0 or quantity<1 or quantity>100),
  coalesce(sum(round(unit_price*100)::bigint*quantity),0)
 into v_count,v_invalid,v_subtotal_cents
 from(
   select oi.quantity,
    case
     when coalesce(oi.item_type,'product')='product' and p.id is not null and p.is_active
       and (oi.variant_id is null or (pv.id is not null and pv.is_active)) then
         case when oi.variant_id is null then p.price else pv.price end
     when oi.item_type='hamper' and h.id is not null and h.is_active then
       coalesce(nullif(h.sale_price,0),nullif(h.price,0),h.base_price)
     when oi.item_type='hamper_item' and hi.id is not null and hi.is_active
       and hi.is_orderable then coalesce(hi.price,hi.estimated_price)
     else null end as unit_price
   from public.shop_order_items oi
   left join public.products p on p.id=oi.product_id
   left join public.product_variants pv on pv.id=oi.variant_id and pv.product_id=oi.product_id
   left join public.hampers h on h.id=oi.hamper_id
   left join public.hamper_items hi on hi.id=oi.hamper_item_id
   where oi.order_id=p_order_id
 ) lines;
 if v_count=0 or v_count>100 or v_invalid>0 then
  raise exception 'Order lines missing, stale or invalid; recreate checkout' using errcode='22023';
 end if;
 select exists(select 1 from public.delivery_zones where is_active) into v_active_zones;
 if v_order.delivery_zone_id is null and v_active_zones then
  raise exception 'Select a valid delivery zone' using errcode='22023';
 end if;
 if v_order.delivery_zone_id is not null then
  select * into v_zone from public.delivery_zones where id=v_order.delivery_zone_id and is_active;
  if not found then raise exception 'Delivery zone no longer available' using errcode='22023';end if;
  v_delivery:=case when v_zone.free_threshold is not null
    and v_subtotal_cents >= round(v_zone.free_threshold*100)::bigint then 0
    else coalesce(v_zone.base_fee,0) end;
 end if;
 if v_delivery<0 or v_delivery>100000 then raise exception 'Invalid delivery charge' using errcode='22023';end if;
 v_total_cents:=v_subtotal_cents+round(v_delivery*100)::bigint;
 if v_total_cents<200 or v_total_cents>100000000 then
  raise exception 'Unsupported payment amount' using errcode='22023';
 end if;
 -- Current storefront does not implement server-verified coupon discount: fail closed.
 if coalesce(v_order.discount_total,0)<>0 or
    round(coalesce(v_order.delivery_fee,0)*100)::bigint<>round(v_delivery*100)::bigint or
    round(coalesce(v_order.total_amount,0)*100)::bigint<>v_total_cents then
  raise exception 'Client order total differs from verified catalogue and delivery price' using errcode='22023';
 end if;
 return jsonb_build_object('order_id',p_order_id,'user_id',auth.uid(),
   'amount_cents',v_total_cents,'currency','ZAR','order_number',v_order.order_number);
end $fn$;
revoke all on function public.rk_yoco_checkout_quote(uuid) from public,anon,authenticated;
grant execute on function public.rk_yoco_checkout_quote(uuid) to authenticated;

-- Claim provider checkout only after server-quoted price. This cannot be called from browser JWTs.
create or replace function public.rk_yoco_register_checkout(
 p_order_id uuid,p_user_id uuid,p_checkout_id text,p_amount_cents bigint
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_order public.shop_orders%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'Server only' using errcode='42501';end if;
 if p_checkout_id is null or length(p_checkout_id)<5 or length(p_checkout_id)>160
   or p_amount_cents<200 or p_user_id is null then
  raise exception 'Invalid Yoco checkout' using errcode='22023';
 end if;
 select * into v_order from public.shop_orders where id=p_order_id for update;
 if not found or v_order.user_id is distinct from p_user_id or
    v_order.payment_method<>'yoco' or v_order.status<>'pending' or
    v_order.payment_status not in('pending','awaiting_payment') or
    round(coalesce(v_order.total_amount,0)*100)::bigint<>p_amount_cents then
  raise exception 'Order changed; checkout registration denied' using errcode='22023';
 end if;
 if v_order.yoco_checkout_id is not null then
  raise exception 'Another checkout is already linked' using errcode='23505';
 end if;
 insert into public.rk_yoco_payment_intents(order_id,checkout_id,user_id,amount_cents)
 values (p_order_id,p_checkout_id,p_user_id,p_amount_cents);
 update public.shop_orders set yoco_checkout_id=p_checkout_id,payment_status='awaiting_payment'
 where id=p_order_id;
 return jsonb_build_object('registered',true,'order_id',p_order_id);
end $fn$;
revoke all on function public.rk_yoco_register_checkout(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.rk_yoco_register_checkout(uuid,uuid,text,bigint) to service_role;

-- Provider authenticity is checked in Edge before invoking this all-or-nothing transaction.
create or replace function public.rk_yoco_apply_verified_event(
 p_event_id text,p_order_id uuid,p_payment_id text,p_event_type text,
 p_amount_cents bigint,p_currency text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_order public.shop_orders%rowtype;v_intent public.rk_yoco_payment_intents%rowtype;
 v_inserted integer;
begin
 if auth.role()<>'service_role' then raise exception 'Server only' using errcode='42501';end if;
 if p_event_type not in('payment.succeeded','payment.failed') or
   p_event_id is null or length(p_event_id)<4 or length(p_event_id)>180 or
   p_payment_id is null or length(p_payment_id)<4 or length(p_payment_id)>180 or
   p_currency<>'ZAR' or p_amount_cents is null or p_amount_cents<200 then
  raise exception 'Malformed verified provider event' using errcode='22023';
 end if;
 select * into v_order from public.shop_orders where id=p_order_id for update;
 select * into v_intent from public.rk_yoco_payment_intents where order_id=p_order_id;
 if not found or v_order.id is null or v_intent.checkout_id is distinct from v_order.yoco_checkout_id or
    v_intent.amount_cents is distinct from p_amount_cents or v_intent.currency<>p_currency then
  raise exception 'Payment not linked to a matching server-issued checkout' using errcode='22023';
 end if;
 if v_order.status in('cancelled','refunded') then
  raise exception 'This order cannot be settled' using errcode='22023';
 end if;
 insert into public.rk_yoco_verified_events
  (event_id,order_id,checkout_id,payment_reference,event_type,amount_cents,currency,result)
 values(p_event_id,p_order_id,v_intent.checkout_id,p_payment_id,p_event_type,p_amount_cents,p_currency,
  case when p_event_type='payment.succeeded' then 'paid' else 'failed' end)
 on conflict (event_id) do nothing;
 get diagnostics v_inserted=row_count;
 if v_inserted=0 then
  return jsonb_build_object('duplicate',true,'paid',v_order.payment_status='paid');
 end if;
 if v_order.payment_status='paid' then
  return jsonb_build_object('duplicate',false,'already_paid',true,'paid',true);
 end if;
 if p_event_type='payment.failed' then
  update public.shop_orders set payment_status='failed' where id=p_order_id and payment_status<>'paid';
  return jsonb_build_object('paid',false,'failed',true);
 end if;
 if round(coalesce(v_order.total_amount,0)*100)::bigint<>p_amount_cents then
  raise exception 'Order amount changed since checkout' using errcode='22023';
 end if;
 update public.shop_orders set payment_status='paid',status='confirmed',payment_method='yoco'
 where id=p_order_id;
 insert into public.payments
  (order_id,provider,reference,amount,currency,status,payment_method,payment_gateway,payment_status,transaction_reference,paid_at)
 values(p_order_id,'yoco',p_payment_id,p_amount_cents/100.0,'ZAR','completed','card','yoco','completed',p_payment_id,now());
 insert into public.order_status_history(order_id,status,note,updated_by)
 values(p_order_id,'confirmed','Payment verified from signed Yoco event',null);
 return jsonb_build_object('paid',true,'duplicate',false,'order_id',p_order_id);
end $fn$;
revoke all on function public.rk_yoco_apply_verified_event(text,uuid,text,text,bigint,text)
 from public,anon,authenticated;
grant execute on function public.rk_yoco_apply_verified_event(text,uuid,text,text,bigint,text)
 to service_role;
create unique index if not exists rk_yoco_checkout_id_unique
 on public.shop_orders(yoco_checkout_id) where yoco_checkout_id is not null;
