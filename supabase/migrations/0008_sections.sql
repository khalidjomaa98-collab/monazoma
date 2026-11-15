-- منظومة المتابعة — تقسيم المنظومة: مستندات المشروع، الموازنة، الحصر، الالتزامات والمؤتمرات، الشؤون الفنية
-- الصلاحيات زي باقي المنظومة: القراءة لأي مستخدم نشط · الإضافة والتعديل لـ«مدير» و«إدخال وتعديل» · الحذف للمدير

-- ---------- مستندات المشروع (مقايسات، عقود، شهادات، محاضر، خطابات، فيديو، عروض) ----------
create table public.project_documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  category    text not null check (category in ('boq','contract','certificate','minutes','letter','video','presentation')),
  direction   text check (direction in ('in','out')),               -- صادر / وارد (للشهادات والخطابات)
  ref_no      text not null default '',
  doc_date    date not null default current_date,
  title       text not null check (length(trim(title)) > 0),
  company_id  uuid references public.companies(id) on delete set null,
  notes       text not null default '',
  file_path   text, file_name text, file_size bigint, file_type text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index project_documents_idx on public.project_documents (project_id, category, doc_date desc);

-- ---------- موازنة المشروع ----------
create table public.budget_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  category    text not null default '',          -- مثال: أعمال ترابية، رصف، أعمال صناعية…
  description text not null default '',
  amount      numeric(16,2) not null default 0 check (amount >= 0),   -- المعتمد في الموازنة
  spent       numeric(16,2) not null default 0 check (spent >= 0),    -- المنصرف الفعلي
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index budget_items_idx on public.budget_items (project_id);

-- ---------- بيان الأعمال (الحصر) ----------
create table public.work_items (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  item_no       text not null default '',
  description   text not null check (length(trim(description)) > 0),
  unit          text not null default '',
  contract_qty  numeric(16,3) not null default 0 check (contract_qty >= 0),
  executed_qty  numeric(16,3) not null default 0 check (executed_qty >= 0),
  unit_price    numeric(16,2) not null default 0 check (unit_price >= 0),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
create index work_items_idx on public.work_items (project_id, company_id);

-- ---------- الالتزامات والمؤتمرات ----------
create table public.commitments (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'commitment' check (kind in ('commitment','conference','meeting')),
  title       text not null check (length(trim(title)) > 0),
  project_id  uuid references public.projects(id) on delete set null,
  due_date    date not null,
  due_time    time,
  location    text not null default '',
  responsible text not null default '',
  status      text not null default 'open' check (status in ('open','done','cancelled')),
  notes       text not null default '',
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index commitments_due_idx on public.commitments (due_date);

-- ---------- الشؤون الفنية: المعدات والصيانة وقطع الغيار ----------
create table public.equipment (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(trim(code)) > 0),
  name        text not null check (length(trim(name)) > 0),
  category    text not null default '',
  plate_no    text not null default '',
  project_id  uuid references public.projects(id) on delete set null,   -- موقع المعدة الحالي
  status      text not null default 'working' check (status in ('working','maintenance','broken','idle')),
  notes       text not null default '',
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index equipment_project_idx on public.equipment (project_id);

create table public.maintenance (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  done_on       date not null default current_date,
  kind          text not null default 'periodic' check (kind in ('periodic','repair')),
  description   text not null default '',
  cost          numeric(14,2) not null default 0 check (cost >= 0),
  next_due      date,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
create index maintenance_eq_idx on public.maintenance (equipment_id, done_on desc);

create table public.spare_parts (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(trim(code)) > 0),
  name        text not null check (length(trim(name)) > 0),
  unit        text not null default 'قطعة',
  qty         numeric(14,2) not null default 0 check (qty >= 0),
  min_qty     numeric(14,2) not null default 0 check (min_qty >= 0),
  warehouse   text not null default 'المخزن الرئيسي',
  notes       text not null default '',
  demo        boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- حركة المخزن: كمية موجبة = وارد، سالبة = منصرف (والرصيد بيتحدّث تلقائيًا)
create table public.part_movements (
  id            uuid primary key default gen_random_uuid(),
  part_id       uuid not null references public.spare_parts(id) on delete cascade,
  moved_on      date not null default current_date,
  qty           numeric(14,2) not null check (qty <> 0),
  equipment_id  uuid references public.equipment(id) on delete set null,
  note          text not null default '',
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null
);
create index part_movements_idx on public.part_movements (part_id, moved_on desc);

create or replace function private.apply_part_movement()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op in ('UPDATE','DELETE') then update public.spare_parts set qty = qty - old.qty where id = old.part_id; end if;
  if tg_op in ('INSERT','UPDATE') then update public.spare_parts set qty = qty + new.qty where id = new.part_id; end if;
  return null;  -- الرصيد ما ينزلش تحت الصفر (check على spare_parts.qty بيرفض)
end; $$;
create trigger part_movements_apply after insert or update or delete on public.part_movements
  for each row execute function private.apply_part_movement();

-- تحديث updated_at
create trigger project_documents_touch before update on public.project_documents for each row execute function private.touch_updated_at();
create trigger budget_items_touch before update on public.budget_items for each row execute function private.touch_updated_at();
create trigger work_items_touch before update on public.work_items for each row execute function private.touch_updated_at();
create trigger commitments_touch before update on public.commitments for each row execute function private.touch_updated_at();
create trigger equipment_touch before update on public.equipment for each row execute function private.touch_updated_at();
create trigger maintenance_touch before update on public.maintenance for each row execute function private.touch_updated_at();
create trigger spare_parts_touch before update on public.spare_parts for each row execute function private.touch_updated_at();

-- ---------- RLS (نفس النمط لكل الجداول) ----------
do $$
declare t text;
begin
  foreach t in array array['project_documents','budget_items','work_items','commitments','equipment','maintenance','spare_parts','part_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_active_user()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_edit()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', t || '_delete', t);
  end loop;
end $$;

-- ---------- ملفات المستندات (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)   -- 50 ميجا للملف (حد الخطة المجانية)
on conflict (id) do nothing;

create policy "project_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and (select private.is_active_user()));
create policy "project_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (select private.can_edit()));
create policy "project_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and (select private.can_edit()));
create policy "project_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (select private.can_edit()));
