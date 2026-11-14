-- منظومة المتابعة — دعم إدارة المستخدمين من داخل المنظومة
-- 1) اسم الدخول في profiles (الجزء قبل @monazoma.local) عشان المدير يشوفه في القائمة
-- 2) حماية: لازم يفضل مدير نشط واحد على الأقل (ما ينفعش المدير يقفل على نفسه)

alter table public.profiles add column username text;
update public.profiles p set username = lower(split_part(u.email, '@', 1)) from auth.users u where u.id = p.id;
alter table public.profiles alter column username set not null;
create unique index profiles_username_key on public.profiles (username);

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), lower(split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- اسم الدخول ما يتغيرش من المنظومة (مربوط بحساب الدخول نفسه)
create or replace function private.keep_username()
returns trigger language plpgsql set search_path = ''
as $$ begin new.username := old.username; return new; end; $$;
create trigger profiles_keep_username before update on public.profiles
  for each row execute function private.keep_username();

create or replace function private.ensure_active_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where role = 'admin' and active) then
    raise exception 'يجب أن يبقى مدير نشط واحد على الأقل' using errcode = 'P0001', hint = 'last_admin';
  end if;
  return null;
end; $$;
create constraint trigger profiles_keep_admin after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function private.ensure_active_admin();
