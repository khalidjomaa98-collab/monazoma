-- منظومة المتابعة — المواقف التنفيذية
-- كل موقف = تقرير بتاريخ عن مشروع: الوضع (منتظم/متأخر/متوقف)، نسبة الإنجاز الفعلية، المنفذ، المخطط، العوائق.
-- نسبة إنجاز المشروع (projects.progress) بتتحدّث تلقائيًا من آخر موقف مسجّل.

create table public.project_statuses (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  report_date   date not null default current_date,
  condition     text not null default 'on_track' check (condition in ('on_track','delayed','stopped')),
  progress      numeric(5,2) not null check (progress between 0 and 100),
  work_done     text not null default '',
  next_steps    text not null default '',
  obstacles     text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
create index project_statuses_project_idx on public.project_statuses (project_id, report_date desc, created_at desc);
create index project_statuses_date_idx on public.project_statuses (report_date desc);
create index project_statuses_company_idx on public.project_statuses (company_id);

create trigger project_statuses_touch before update on public.project_statuses
  for each row execute function private.touch_updated_at();

-- مزامنة نسبة إنجاز المشروع مع آخر موقف
create or replace function private.sync_project_progress()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare pid uuid; latest numeric;
begin
  for pid in select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.project_id end,
      case when tg_op <> 'DELETE' then new.project_id end]) x where x is not null loop
    select s.progress into latest from public.project_statuses s
      where s.project_id = pid order by s.report_date desc, s.created_at desc limit 1;
    if latest is not null then
      update public.projects set progress = latest where id = pid and progress is distinct from latest;
    end if;
  end loop;
  return null;
end; $$;
create trigger project_statuses_sync after insert or update or delete on public.project_statuses
  for each row execute function private.sync_project_progress();

alter table public.project_statuses enable row level security;
create policy "ps_select" on public.project_statuses for select to authenticated using ((select private.is_active_user()));
create policy "ps_insert" on public.project_statuses for insert to authenticated with check ((select private.can_edit()));
create policy "ps_update" on public.project_statuses for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "ps_delete" on public.project_statuses for delete to authenticated using ((select private.is_admin()));

-- كل المواقف مع أسماء المشروع والشركة
create view public.project_statuses_overview with (security_invoker = true) as
  select s.*, p.code as project_code, p.name as project_name, p.status as project_status, c.name as company_name
  from public.project_statuses s
  join public.projects p on p.id = s.project_id
  left join public.companies c on c.id = s.company_id;

-- آخر موقف لكل مشروع (المشروعات اللي مالهاش موقف بتظهر برضه)
create view public.project_latest_status with (security_invoker = true) as
  select p.id as project_id, p.code as project_code, p.name as project_name, p.status as project_status, p.progress as project_progress,
         l.id as status_id, l.report_date, l.condition, l.progress, l.obstacles, l.company_name
  from public.projects p
  left join lateral (
    select s.id, s.report_date, s.condition, s.progress, s.obstacles, c.name as company_name
    from public.project_statuses s left join public.companies c on c.id = s.company_id
    where s.project_id = p.id order by s.report_date desc, s.created_at desc limit 1
  ) l on true;
