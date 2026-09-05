-- Release 2 security gate: approval decisions must execute with caller privileges.
alter function public.adminos_decide_approval(uuid,text,text) security invoker;
revoke all on function public.adminos_decide_approval(uuid,text,text) from public;
revoke all on function public.adminos_decide_approval(uuid,text,text) from anon;
grant execute on function public.adminos_decide_approval(uuid,text,text) to authenticated;
