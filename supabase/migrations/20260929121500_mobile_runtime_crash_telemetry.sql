drop policy if exists "mobile runtime insert anonymous" on public.mobile_runtime_events;
create policy "mobile runtime insert anonymous"
on public.mobile_runtime_events
for insert to anon
with check (
  user_id is null
  and platform in ('android','web','ios','macos','windows')
  and event_type in ('webview_renderer_recovered','js_error','promise_rejection','offline_boot','reconnected')
  and char_length(release) <= 40
  and coalesce(char_length(stage),0) <= 80
  and coalesce(char_length(message),0) <= 240
  and octet_length(metadata::text) <= 4096
);

drop policy if exists "mobile runtime insert own" on public.mobile_runtime_events;
create policy "mobile runtime insert own"
on public.mobile_runtime_events
for insert to authenticated
with check (
  (user_id is null or user_id = auth.uid())
  and platform in ('android','web','ios','macos','windows')
  and event_type in ('webview_renderer_recovered','js_error','promise_rejection','offline_boot','reconnected')
  and char_length(release) <= 40
  and coalesce(char_length(stage),0) <= 80
  and coalesce(char_length(message),0) <= 240
  and octet_length(metadata::text) <= 4096
);
