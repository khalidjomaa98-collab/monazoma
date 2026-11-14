-- منظومة المتابعة — مسؤول المتابعة لكل مشروع، نسبة الإنجاز المخططة في المواقف، والبيانات التجريبية للعرض

alter table public.projects
  add column owner_id uuid references public.profiles(id) on delete set null,
  add column demo boolean not null default false;
alter table public.companies add column demo boolean not null default false;
alter table public.project_statuses add column planned_progress numeric(5,2) check (planned_progress between 0 and 100);
create index projects_owner_idx on public.projects (owner_id);

-- العروض بتتعاد عشان تشمل الأعمدة الجديدة
drop view public.projects_overview;
create view public.projects_overview with (security_invoker = true) as
  select p.*,
    (select count(*) from public.project_companies pc where pc.project_id = p.id)::int as companies_count,
    o.name as owner_name,
    l.planned_progress as latest_planned, l.report_date as latest_report_date
  from public.projects p
  left join public.profiles o on o.id = p.owner_id
  left join lateral (select s.planned_progress, s.report_date from public.project_statuses s
                     where s.project_id = p.id order by s.report_date desc, s.created_at desc limit 1) l on true;

drop view public.project_statuses_overview;
create view public.project_statuses_overview with (security_invoker = true) as
  select s.*, p.code as project_code, p.name as project_name, p.status as project_status, c.name as company_name
  from public.project_statuses s
  join public.projects p on p.id = s.project_id
  left join public.companies c on c.id = s.company_id;

drop view public.project_latest_status;
create view public.project_latest_status with (security_invoker = true) as
  select p.id as project_id, p.code as project_code, p.name as project_name, p.status as project_status, p.progress as project_progress,
         p.owner_id, o.name as owner_name,
         l.id as status_id, l.report_date, l.condition, l.progress, l.planned_progress, l.obstacles, l.company_name
  from public.projects p
  left join public.profiles o on o.id = p.owner_id
  left join lateral (
    select s.id, s.report_date, s.condition, s.progress, s.planned_progress, s.obstacles, c.name as company_name
    from public.project_statuses s left join public.companies c on c.id = s.company_id
    where s.project_id = p.id order by s.report_date desc, s.created_at desc limit 1
  ) l on true;

-- ---------- البيانات التجريبية (للمدير فقط) ----------
-- كل الصفوف التجريبية عليها demo = true، والمسح بيشيلها هي بس.
create or replace function public.clear_demo_data()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.extracts where project_id in (select id from public.projects where demo);
  delete from public.projects where demo;
  delete from public.companies c where c.demo and not exists (select 1 from public.project_companies pc where pc.company_id = c.id);
end; $$;

create or replace function public.load_demo_data()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  co uuid[] := '{}'; cid uuid; pid uuid; pr record; i int; j int; m int; nco int;
  d date; t numeric; plan numeric; act numeric; prev numeric; cond text; obst text; tot_days int;
  link_val numeric; months int; st text; sub date; gross numeric;
  cnames text[] := array['مقاول تجريبي (أ)','مقاول تجريبي (ب)','مقاول تجريبي (ج)','مقاول تجريبي (د)','مقاول باطن تجريبي (هـ)','مقاول باطن تجريبي (و)','مقاول باطن تجريبي (ز)','مورّد أسفلت تجريبي','مورّد ركام تجريبي','مورّد معدات تجريبي','مورّد خرسانة تجريبي','مقاول علامات وإشارات تجريبي'];
  ckinds text[] := array['contractor','contractor','contractor','contractor','subcontractor','subcontractor','subcontractor','supplier','supplier','supplier','supplier','subcontractor'];
  roles text[] := array['contractor','subcontractor','supplier','supplier'];
  scopes text[] := array['الأعمال الرئيسية: الحفر والردم وطبقات الأساس والرصف','الأعمال الصناعية والعبّارات','توريد الخلطة الأسفلتية','توريد الركام والسن'];
  shares numeric[] := array[0.62, 0.18, 0.12, 0.08];
  done_txt text[] := array['استكمال أعمال الحفر والتسوية','تنفيذ طبقة الأساس المساعد','فرد طبقة الأساس ودمكها','تنفيذ الطبقة الرابطة','تنفيذ الطبقة السطحية','أعمال العبّارات والأعمال الصناعية','تركيب البلدورات والأرصفة','أعمال الدهانات والعلامات الأرضية'];
  obst_txt text[] := array['تأخر توريد الخلطة الأسفلتية من المورد','نقص في المعدات بالموقع (هراسات)','وجود مرافق غير موقعة على المسار تحتاج تحويل','تأخر صرف المستخلص السابق للمقاول','ظروف جوية أوقفت الرصف عدة أيام'];
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.projects where demo) then return; end if;
  for i in 1..array_length(cnames, 1) loop
    insert into public.companies (name, kind, demo, notes) values (cnames[i], ckinds[i], true, 'بيانات تجريبية للعرض') returning id into cid;
    co := co || cid;
  end loop;
  nco := array_length(co, 1);

  for pr in select * from (values
    (1,'تج-01','ازدواج الطريق الإقليمي – القطاع الأول','من الكيلو 0 إلى الكيلو 35','active',    48000000, date '2025-09-01', date '2027-02-28', 0.97, true),
    (2,'تج-02','رفع كفاءة طريق الخدمة الشرقي','بطول 18 كم','active',                          12500000, date '2026-01-15', date '2026-12-31', 0.72, true),
    (3,'تج-03','إنشاء محور الربط الصناعي','من التقاطع الرئيسي حتى المنطقة الصناعية','active', 63000000, date '2025-06-01', date '2027-06-30', 1.04, false),
    (4,'تج-04','تطوير مدخل المدينة الجديدة','المدخل الشمالي','active',                         8700000, date '2026-04-01', date '2026-11-30', 0.80, false),
    (5,'تج-05','صيانة الطريق الصحراوي – الكيلو 40 إلى 90','صيانة شاملة ورصف','suspended',     21000000, date '2025-11-01', date '2026-10-31', 0.70, true),
    (6,'تج-06','إنشاء كوبري تقاطع المحور','أعمال الكوبري والمطالع','active',                   35000000, date '2025-03-01', date '2026-09-30', 0.93, false),
    (7,'تج-07','رصف الطرق الداخلية – المنطقة الثالثة','شبكة طرق داخلية بطول 9 كم','completed', 6400000, date '2025-02-01', date '2025-12-31', 1.00, false),
    (8,'تج-08','توسعة الطريق الدائري – الجزء الجنوبي','حارة إضافية في كل اتجاه','planned',     29000000, date '2027-01-01', date '2027-12-31', 1.00, true)
  ) v(n, code, name, loc, status, val, s, e, factor, mine) loop
    insert into public.projects (code, name, location, status, contract_value, start_date, planned_end_date, demo, owner_id, notes)
    values (pr.code, pr.name, pr.loc, pr.status, pr.val, pr.s, pr.e, true, case when pr.mine then (select auth.uid()) end, 'مشروع تجريبي للعرض')
    returning id into pid;

    -- الشركات: 4 شركات لكل مشروع (مقاول رئيسي، مقاول باطن، موردين)
    for j in 1..4 loop
      cid := case j when 1 then co[((pr.n - 1) % 4) + 1] when 2 then co[5 + ((pr.n - 1) % 3)] when 3 then co[8 + ((pr.n - 1) % 4)] else co[8 + (pr.n % 4)] end;
      insert into public.project_companies (project_id, company_id, role, scope, contract_value)
      values (pid, cid, roles[j], scopes[j], round(pr.val * shares[j], -3)) on conflict do nothing;
    end loop;

    continue when pr.status = 'planned';

    -- المواقف: كل أسبوعين من البدء لحد النهاية أو النهاردة. المخطط منحنى S، والفعلي = المخطط × معامل المشروع
    tot_days := pr.e - pr.s; prev := 0; i := 0;
    d := pr.s + 14;
    while d <= least(current_date - 2, pr.e + case when pr.status = 'completed' then 0 else 120 end) loop
      i := i + 1;
      t := least(1, (d - pr.s)::numeric / tot_days);
      plan := round(100 * (3 * t * t - 2 * t * t * t), 1);
      act := least(100, greatest(prev, round(plan * pr.factor + ((i * 7 + pr.n * 3) % 5 - 2) * 0.6, 1)));
      if pr.status = 'completed' and d + 14 > pr.e then act := 100; end if;
      if pr.status = 'suspended' and d > current_date - 75 then act := prev; end if;  -- متوقف من حوالي شهرين ونص
      cond := case when pr.status = 'suspended' and d > current_date - 75 then 'stopped' when act < plan - 8 then 'delayed' else 'on_track' end;
      obst := case when cond = 'stopped' then 'توقف الأعمال لحين صرف المستحقات المتأخرة وتسوية أوامر التغيير'
                   when cond = 'delayed' then obst_txt[((i + pr.n) % 5) + 1] else '' end;
      insert into public.project_statuses (project_id, company_id, report_date, condition, progress, planned_progress, work_done, next_steps, obstacles)
      values (pid, null, d, cond, act, plan, done_txt[least(8, 1 + floor(act / 12.5)::int)], done_txt[least(8, 2 + floor(act / 12.5)::int)], obst);
      prev := act;
      d := d + 14;
    end loop;

    -- المستخلصات: شهرية للمقاول الرئيسي ومقاول الباطن
    months := least((least(current_date, pr.e) - pr.s) / 30, 16);
    for j in 1..2 loop
      cid := case j when 1 then co[((pr.n - 1) % 4) + 1] else co[5 + ((pr.n - 1) % 3)] end;
      link_val := pr.val * shares[j];
      for m in 1..months loop
        sub := pr.s + m * 30 + 5;
        exit when sub > current_date;
        gross := round(link_val * (0.03 + ((m * 13 + pr.n * 7 + j) % 5) * 0.006), -2);
        st := case when m <= months - 2 then 'paid' when m = months - 1 then 'approved'
                   when (pr.n + j) % 3 = 0 then 'needs_completion' else 'under_review' end;
        if pr.status = 'suspended' and m = months then st := 'needs_completion'; end if;
        if pr.status = 'completed' then st := 'paid'; end if;
        insert into public.extracts (project_id, company_id, number, kind, period_from, period_to, submitted_on, gross_amount, deductions, status, approved_on, paid_on, notes)
        values (pid, cid, m, case when pr.status = 'completed' and m = months then 'final' else 'interim' end,
                pr.s + (m - 1) * 30, pr.s + m * 30 - 1, sub, gross, round(gross * 0.1, -2), st,
                case when st in ('approved','paid') then sub + 12 end, case when st = 'paid' then sub + 28 end,
                case when st = 'needs_completion' then 'مطلوب إرفاق محاضر الاستلام وكشوف الحصر' else '' end);
      end loop;
    end loop;
  end loop;
end; $$;

revoke all on function public.load_demo_data() from public, anon;
revoke all on function public.clear_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
