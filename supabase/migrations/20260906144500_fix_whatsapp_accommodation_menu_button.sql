update public.adminos_whatsapp_rich_content
set config = jsonb_set(config,'{button}','"Accommodation"'::jsonb),
    status = case when status='provider_error' then 'not_created' else status end,
    metadata = metadata - 'provider_error' - 'provider_error_at',
    updated_at = now()
where content_key='rk_accommodation_menu';