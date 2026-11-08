-- Security hardening: the public sponsored listing RPC returns only safe fields.
-- Never expose the backing promotion record (invoice IDs and funding details)
-- to anonymous or unrelated authenticated users.
drop view if exists public.reskonnect_sponsored_residences_v;
drop policy if exists rk_sponsored_public_read on public.reskonnect_commercial_promotions;
revoke select on public.reskonnect_commercial_promotions from anon;
-- Keep authenticated SELECT for legitimate residence owners, scoped by RLS.
-- The public RPC uses strict approved/status/time and residence visibility checks.

-- Prevent a stale invoice from being used for paid sponsorship following
-- invoice cancellation. The public RPC revalidates payment on every read.
create or replace function public.reskonnect_public_sponsored_residences(p_placement text default 'find')
returns table (residence_id uuid,title text,description text,placement text,disclosure_label text)
language sql stable security definer set search_path=''
as $fn$
 select p.residence_id,p.title,p.description,p.placement,'Sponsored'::text
 from public.reskonnect_commercial_promotions p
 join public.residences r on r.id=p.residence_id
 left join public.reskonnect_commercial_invoices i on i.id=p.invoice_id
 where p.status='approved' and p.starts_at<=now() and p.ends_at>now()
   and p.placement=p_placement and r.is_visible=true
   and (p.funding_basis='complimentary' or
      (p.funding_basis='paid_invoice' and i.status='paid' and
        i.residence_id=p.residence_id and i.product_code='sponsored_feature'))
 order by p.starts_at desc limit 24;
$fn$;
revoke all on function public.reskonnect_public_sponsored_residences(text) from public;
grant execute on function public.reskonnect_public_sponsored_residences(text) to anon,authenticated;

-- Avoid multiple invoicing attempts for the same reviewed finance charge.
-- Each issued document remains a locked snapshot; rate edits never rewrite it.
create index if not exists rk_commercial_invoice_product_idx on public.reskonnect_commercial_invoices(product_code,issued_at desc);
create index if not exists rk_promotion_invoice_idx on public.reskonnect_commercial_promotions(invoice_id) where invoice_id is not null;
