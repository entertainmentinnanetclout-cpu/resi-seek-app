insert into public.platform_settings (key, value, description, updated_at)
values (
  'residence_poster_marketing',
  jsonb_build_object(
    'version', 3,
    'show_referral_fee', false,
    'urgency_line', 'Popular residences fill fast — secure your space early.',
    'conversion_line', 'Explore real residence photos, compare live accommodation details and apply online through ResKonnect.',
    'network_label', 'ACCOMMODATIONS & RENTALS',
    'start_to_up_logo_url', 'https://raw.githubusercontent.com/entertainmentinnanetclout-cpu/Start-To-Up/main/public/brand/start-to-up-logo-light.png',
    'formats', jsonb_build_object(
      'square', jsonb_build_object('width',4096,'height',4096,'label','Square 4K'),
      'story', jsonb_build_object('width',2160,'height',3840,'label','Story 4K'),
      'landscape', jsonb_build_object('width',3840,'height',2160,'label','Landscape 4K (16:9)')
    )
  ),
  'Public-safe configuration for premium residence marketing poster generation. Referral-fee copy is disabled. Posters use live residence photos, province, campus, pricing and availability.',
  now()
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

create or replace function public.get_residence_poster_marketing_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings jsonb := '{}'::jsonb;
  v_visible_count integer := 0;
  v_claim text;
begin
  select value into v_settings
  from public.platform_settings
  where key = 'residence_poster_marketing'
  limit 1;

  select count(*)::integer into v_visible_count
  from public.residences
  where coalesce(is_visible, true);

  v_claim := case
    when v_visible_count > 300 then 'OVER 300 ACCOMMODATIONS & RENTALS ON RESKONNECT'
    when v_visible_count >= 300 then '300+ ACCOMMODATIONS & RENTALS ON RESKONNECT'
    when v_visible_count >= 100 then (floor(v_visible_count / 100.0)::int * 100)::text || '+ ACCOMMODATIONS & RENTALS ON RESKONNECT'
    else v_visible_count::text || ' ACCOMMODATIONS & RENTALS ON RESKONNECT'
  end;

  return coalesce(v_settings, '{}'::jsonb) || jsonb_build_object(
    'visible_listing_count', v_visible_count,
    'network_claim', v_claim,
    'show_referral_fee', false
  );
end;
$$;

revoke all on function public.get_residence_poster_marketing_config() from public;
grant execute on function public.get_residence_poster_marketing_config() to anon, authenticated;
