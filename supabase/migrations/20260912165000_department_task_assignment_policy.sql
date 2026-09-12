-- Let each assigned department work its own staff-task queue.
drop policy if exists department_assigned_staff_tasks_manage on public.staff_tasks;
create policy department_assigned_staff_tasks_manage
on public.staff_tasks
for all to authenticated
using (
  department_key is not null
  and public.has_admin_department_access(department_key)
)
with check (
  department_key is not null
  and public.has_admin_department_access(department_key)
);
