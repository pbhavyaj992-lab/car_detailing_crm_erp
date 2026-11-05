insert into public.user_roles (user_id, role)
select u.id, 'super_admin'::public.app_role from auth.users u
where u.email = 'pbhavyaj992@gmail.com'
and not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'super_admin');