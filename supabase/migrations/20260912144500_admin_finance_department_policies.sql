-- Finance & Administration department permissions.
-- Commercial/order administration is delegated; banking configuration remains God Mode-only.

do $$
declare t text;
begin
  foreach t in array array[
    'delivery_zones','discount_orders','hamper_bundle_items','hamper_items','hampers',
    'marketplace_listings','product_categories','products','shop_order_items','shop_orders',
    'stores','student_discounts','seller_kyc_log'
  ] loop
    execute format('drop policy if exists finance_department_manage on public.%I',t);
    execute format(
      'create policy finance_department_manage on public.%I for all to authenticated using (public.has_admin_department_access(''finance_admin'')) with check (public.has_admin_department_access(''finance_admin''))',
      t
    );
  end loop;
end $$;

drop policy if exists finance_department_eft_manage on public.eft_payments;
create policy finance_department_eft_manage on public.eft_payments
for all to authenticated using (public.has_admin_department_access('finance_admin'))
with check (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_payment_proofs_manage on public.payment_proofs;
create policy finance_department_payment_proofs_manage on public.payment_proofs
for all to authenticated using (public.has_admin_department_access('finance_admin'))
with check (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_payments_manage on public.payments;
create policy finance_department_payments_manage on public.payments
for all to authenticated using (public.has_admin_department_access('finance_admin'))
with check (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_payment_logs_manage on public.payment_action_logs;
create policy finance_department_payment_logs_manage on public.payment_action_logs
for all to authenticated using (public.has_admin_department_access('finance_admin'))
with check (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_order_history_manage on public.order_status_history;
create policy finance_department_order_history_manage on public.order_status_history
for all to authenticated using (public.has_admin_department_access('finance_admin'))
with check (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_earnings_read on public.seller_earnings;
create policy finance_department_earnings_read on public.seller_earnings
for select to authenticated using (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_settings_read on public.platform_settings;
create policy finance_department_settings_read on public.platform_settings
for select to authenticated using (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_profiles_read on public.profiles;
create policy finance_department_profiles_read on public.profiles
for select to authenticated using (public.has_admin_department_access('finance_admin'));

drop policy if exists finance_department_notifications_insert on public.notifications;
create policy finance_department_notifications_insert on public.notifications
for insert to authenticated with check (public.has_admin_department_access('finance_admin'));

comment on policy finance_department_settings_read on public.platform_settings is
'Finance/Admin may read operational platform settings, but may not mutate banking/platform settings through this policy.';
