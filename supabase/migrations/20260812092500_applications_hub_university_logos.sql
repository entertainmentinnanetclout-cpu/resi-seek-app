-- Use the university logo assets supplied for the Pretoria Applications Hub.
-- These are served from the app's public/institution-logos directory so the
-- student cards and admin preview share the same canonical artwork.

update public.application_hub_institutions
set logo_url = '/institution-logos/tut.jpg',
    updated_at = now()
where slug = 'tut';

update public.application_hub_institutions
set logo_url = '/institution-logos/unisa.jpg',
    updated_at = now()
where slug = 'unisa';

update public.application_hub_institutions
set logo_url = '/institution-logos/up.jpg',
    updated_at = now()
where slug = 'up';
