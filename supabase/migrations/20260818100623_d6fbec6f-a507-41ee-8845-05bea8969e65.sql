insert into public.profiles (id, email, full_name, is_active)
select u.id, u.email, initcap(split_part(u.email,'@',1)), true
from auth.users u
where u.email in ('bishalbishwokarma2029@gmail.com','jagadish@ado','ritesh@ado','jitendra@ado','bishal@ado','pratyush@ado')
on conflict (id) do update set is_active = true, email = excluded.email;

insert into public.user_roles (user_id, role)
select u.id, case when u.email = 'bishalbishwokarma2029@gmail.com' then 'admin'::app_role else 'staff'::app_role end
from auth.users u
where u.email in ('bishalbishwokarma2029@gmail.com','jagadish@ado','ritesh@ado','jitendra@ado','bishal@ado','pratyush@ado')
on conflict (user_id, role) do nothing;

insert into public.module_permissions (user_id, module, can_view, can_edit)
select u.id, m.module, true, true
from auth.users u
cross join (values ('dashboard'),('inventory'),('guangzhou'),('yiwu'),('lots'),('clients'),('notes'),('analytics'),('ai')) as m(module)
where u.email in ('jagadish@ado','ritesh@ado','jitendra@ado','bishal@ado','pratyush@ado')
on conflict (user_id, module) do update set can_view = true, can_edit = true;