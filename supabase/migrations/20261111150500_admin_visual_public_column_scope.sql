-- Public page layout data has no business displaying the administrative editor's user IDs.
REVOKE SELECT ON TABLE public.rk_visual_page_sections FROM anon, authenticated;
GRANT SELECT (page_key,section_key,title,position,visible,required,editable_copy,headline,subtitle,updated_at)
 ON TABLE public.rk_visual_page_sections TO anon, authenticated;
