-- منظومة المتابعة — المستخلصات وسجل متابعتها
-- كل مستخلص يخص شركة داخل مشروع (ارتباط في project_companies)، ورقمه مسلسل داخل هذا الارتباط.
-- الحالات: مقدَّم ← قيد المراجعة ← (مطلوب استكمال) ← معتمد ← مصروف · أو مرفوض
-- أي تغيير في الحالة يُسجَّل تلقائيًا في extract_events (من غيّر، ومتى، ومن أي حالة لأي حالة، والملاحظة).

create table public.extracts (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null,
  company_id       uuid not null,
  number           int  not null check (number > 0),
  kind             text not null default 'interim' check (kind in ('interim','final')),
  period_from      date,
  period_to        date,
  submitted_on     date not null default current_date,
  gross_amount     numeric(16,2) not null check (gross_amount >= 0),
  deductions       numeric(16,2) not null default 0 check (deductions >= 0),
  net_amount       numeric(16,2) generated always as (gross_amount - deductions) stored,
  status           text not null default 'submitted'
                   check (status in ('submitted','under_review','needs_completion','approved','paid','rejected')),
  approved_on      date,
  paid_on          date,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null,
  foreign key (project_id, company_id) references public.project_companies(project_id, company_id) on delete restrict,
  unique (project_id, company_id, number),
  check (deductions <= gross_amount),
  check (period_to is null or period_from is null or period_to >= period_from)
);
create index extracts_company_idx on public.extracts (company_id);
create index extracts_status_idx on public.extracts (status);
create index extracts_submitted_idx on public.extracts (submitted_on desc);

create table public.extract_events (
  id           bigint generated always as identity primary key,
  extract_id   uuid not null references public.extracts(id) on delete cascade,
  from_status  text,
  to_status    text not null,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index extract_events_extract_idx on public.extract_events (extract_id, created_at);

create trigger extracts_touch before update on public.extracts
  for each row execute function private.touch_updated_at();

-- تواريخ الاعتماد والصرف تتسجل تلقائيًا لو ما اتكتبتش
create or replace function private.extract_dates()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status in ('approved','paid') and new.approved_on is null then new.approved_on := current_date; end if;
  if new.status = 'paid' and new.paid_on is null then new.paid_on := current_date; end if;
  return new;
end; $$;
create trigger extracts_dates before insert or update on public.extracts
  for each row execute function private.extract_dates();

-- سجل الحالة: الملاحظة تيجي من متغير الجلسة app.status_note (بتتحط من دالة set_extract_status)
create or replace function private.log_extract_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.extract_events (extract_id, from_status, to_status, note, created_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            coalesce(nullif(current_setting('app.status_note', true), ''), ''), (select auth.uid()));
  end if;
  return new;
end; $$;
create trigger extracts_log after insert or update of status on public.extracts
  for each row execute function private.log_extract_status();

-- تغيير الحالة مع ملاحظة (بصلاحيات المستخدم نفسه — RLS بتتطبق)
create or replace function public.set_extract_status(p_id uuid, p_status text, p_note text default '')
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update public.extracts set status = p_status where id = p_id;
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
  perform set_config('app.status_note', '', true);
end; $$;
revoke all on function public.set_extract_status(uuid, text, text) from public, anon;
grant execute on function public.set_extract_status(uuid, text, text) to authenticated;

-- ---------- RLS ----------
alter table public.extracts enable row level security;
alter table public.extract_events enable row level security;

create policy "extracts_select" on public.extracts for select to authenticated using ((select private.is_active_user()));
create policy "extracts_insert" on public.extracts for insert to authenticated with check ((select private.can_edit()));
create policy "extracts_update" on public.extracts for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "extracts_delete" on public.extracts for delete to authenticated using ((select private.is_admin()));

-- السجل للقراءة فقط؛ الكتابة من الـ trigger وحده
create policy "extract_events_select" on public.extract_events for select to authenticated using ((select private.is_active_user()));

-- عرض للقوائم: المستخلص + اسم الشركة والمشروع
create view public.extracts_overview with (security_invoker = true) as
  select e.*, p.code as project_code, p.name as project_name, c.name as company_name
  from public.extracts e
  join public.projects p on p.id = e.project_id
  join public.companies c on c.id = e.company_id;
