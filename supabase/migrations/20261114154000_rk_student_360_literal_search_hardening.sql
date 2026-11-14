-- Prevent SQL LIKE meta-characters in literal Student 360 directory searches.
-- Use E strings so the two-character escaped wildcard is unambiguous.
CREATE OR REPLACE FUNCTION public.rk_student_360_search(p_query text, p_limit integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_q text:=left(btrim(coalesce(p_query,'')),80); v_result jsonb;
begin
 if not reskonnect_internal.rk_godmode_authorized() then
   raise exception 'God Mode with verified MFA required' using errcode='42501';
 end if;
 if p_limit not between 1 and 25 then
   raise exception 'Invalid search limit' using errcode='22023';
 end if;
 if length(v_q)<2 then return '[]'::jsonb; end if;
 -- Escape pattern metacharacters so a query cannot enumerate the directory with % or _.
 v_q:=replace(replace(replace(v_q,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_');
 select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc),'[]'::jsonb) into v_result
 from (
  select p.id as user_id,p.full_name,p.email,p.student_number,p.campus,
   p.student_stage,p.course,p.updated_at
  from public.profiles p
  where coalesce(p.full_name,'') ilike '%'||v_q||'%' escape '\'
    or coalesce(p.email,'') ilike '%'||v_q||'%' escape '\'
    or coalesce(p.student_number,'') ilike '%'||v_q||'%' escape '\'
  order by p.updated_at desc limit p_limit
 ) t;
 return v_result;
end $function$;
revoke all on function public.rk_student_360_search(text,integer) from public,anon,authenticated;
grant execute on function public.rk_student_360_search(text,integer) to authenticated;
