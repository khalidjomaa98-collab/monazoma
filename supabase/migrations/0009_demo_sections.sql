-- منظومة المتابعة — البيانات التجريبية للأقسام الجديدة
-- الدوال القديمة اتنقلت لـ private، والدوال العامة بتناديها وبعدين تضيف/تمسح بيانات الأقسام الجديدة.

alter function public.load_demo_data() set schema private;
alter function public.clear_demo_data() set schema private;
revoke all on function private.load_demo_data() from public, anon, authenticated;
revoke all on function private.clear_demo_data() from public, anon, authenticated;

create or replace function public.clear_demo_data()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.commitments where demo;
  delete from public.spare_parts where demo;      -- الحركات بتتمسح معاها
  delete from public.equipment where demo;        -- الصيانة بتتمسح معاها
  perform private.clear_demo_data();              -- المشروعات (والمستندات والموازنة والحصر معاها) والشركات
end; $$;

create or replace function public.load_demo_data()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  pr record; mc uuid; sc uuid; i int; eq uuid; part uuid; prj uuid[];
  cats text[] := array['أعمال ترابية (حفر وردم)','طبقات الأساس','الرصف الأسفلتي','الأعمال الصناعية والعبّارات','العلامات والإشارات والدهانات','احتياطي ومصروفات عامة'];
  catp numeric[] := array[0.18, 0.22, 0.32, 0.12, 0.06, 0.10];
  wdesc text[] := array['حفر في تربة عادية','ردم بناتج الحفر مع الدمك','طبقة أساس مساعد سمك 25 سم','خلطة أسفلتية للطبقة الرابطة','خلطة أسفلتية للطبقة السطحية','بلدورات خرسانية سابقة الصب','دهانات وعلامات أرضية عاكسة'];
  wunit text[] := array['م³','م³','م²','طن','طن','م.ط','م²'];
  wprice numeric[] := array[45, 38, 95, 1450, 1650, 210, 120];
  wshare numeric[] := array[0.10, 0.08, 0.20, 0.25, 0.25, 0.07, 0.05];
  eqn text[] := array['لودر','جريدر','هراس اهتزازي','فنشر أسفلت','سيارة قلاب','حفار','هراس كاوتش','تانك مياه','لودر','جريدر','سيارة قلاب','هراس اهتزازي','موزع أسفلت','كومبريسور'];
  eqc text[] := array['معدات تحميل','معدات تسوية','معدات دمك','معدات رصف','معدات نقل','معدات حفر','معدات دمك','معدات خدمة','معدات تحميل','معدات تسوية','معدات نقل','معدات دمك','معدات رصف','معدات خدمة'];
  eqs text[] := array['working','working','maintenance','working','working','broken','working','idle','working','working','maintenance','working','working','idle'];
  pn text[] := array['فلتر زيت محرك','فلتر هواء','فلتر سولار','سير مروحة','زيت هيدروليك (لتر)','زيت محرك (لتر)','بطارية 12 فولت','طقم تيل فرامل','سكينة جريدر','خرطوم هيدروليك'];
  pu text[] := array['قطعة','قطعة','قطعة','قطعة','لتر','لتر','قطعة','طقم','قطعة','قطعة'];
  pq numeric[] := array[40, 25, 30, 12, 600, 400, 6, 8, 10, 15];
  pm numeric[] := array[15, 10, 10, 5, 200, 150, 4, 4, 6, 6];
begin
  if not private.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.projects where demo) then return; end if;
  perform private.load_demo_data();

  for pr in select p.*, row_number() over (order by p.code) as n from public.projects p where p.demo order by p.code loop
    prj := prj || pr.id;
    select company_id into mc from public.project_companies where project_id = pr.id and role = 'contractor' limit 1;
    select company_id into sc from public.project_companies where project_id = pr.id and role = 'subcontractor' limit 1;

    -- الموازنة
    for i in 1..6 loop
      insert into public.budget_items (project_id, category, description, amount, spent)
      values (pr.id, cats[i], 'بند موازنة تجريبي', round(pr.contract_value * catp[i], -3),
              round(pr.contract_value * catp[i] * least(1.08, pr.progress / 100 * (0.9 + ((i * 7 + pr.n) % 5) * 0.05)), -3));
    end loop;

    -- بيان الأعمال (الحصر) للمقاول الرئيسي
    for i in 1..7 loop
      insert into public.work_items (project_id, company_id, item_no, description, unit, contract_qty, executed_qty, unit_price)
      values (pr.id, mc, lpad(i::text, 2, '0'), wdesc[i], wunit[i],
              round(pr.contract_value * 0.62 * wshare[i] / wprice[i]),
              round(pr.contract_value * 0.62 * wshare[i] / wprice[i] * least(1, pr.progress / 100 * (0.85 + ((i * 3 + pr.n) % 4) * 0.08))),
              wprice[i]);
    end loop;

    -- المستندات (بيانات بدون ملفات مرفقة)
    insert into public.project_documents (project_id, category, ref_no, doc_date, title, company_id, notes) values
      (pr.id, 'boq', 'مق-' || pr.n || '/1', pr.start_date - 30, 'المقايسة التعاقدية للأعمال الرئيسية', mc, 'بيانات تجريبية — بدون ملف مرفق'),
      (pr.id, 'boq', 'مق-' || pr.n || '/2', pr.start_date - 20, 'مقايسة الأعمال الصناعية', sc, 'بيانات تجريبية — بدون ملف مرفق'),
      (pr.id, 'contract', 'ع-' || pr.n || '/1', pr.start_date - 15, 'عقد المقاول الرئيسي', mc, 'بيانات تجريبية — بدون ملف مرفق'),
      (pr.id, 'contract', 'ع-' || pr.n || '/2', pr.start_date - 10, 'عقد مقاول الباطن', sc, 'بيانات تجريبية — بدون ملف مرفق');
    if pr.status <> 'planned' then
      insert into public.project_documents (project_id, category, direction, ref_no, doc_date, title, company_id, notes) values
        (pr.id, 'certificate', 'out', 'ش ص-' || pr.n || '/1', least(current_date - 40, pr.start_date + 60), 'شهادة إنجاز أعمال المرحلة الأولى', mc, 'بيانات تجريبية'),
        (pr.id, 'certificate', 'in', 'ش و-' || pr.n || '/1', least(current_date - 20, pr.start_date + 90), 'شهادة مطابقة خامات الأسفلت', null, 'بيانات تجريبية'),
        (pr.id, 'minutes', null, 'م-' || pr.n || '/1', pr.start_date + 7, 'محضر تسليم الموقع للمقاول', mc, 'بيانات تجريبية'),
        (pr.id, 'minutes', null, 'م-' || pr.n || '/2', least(current_date - 30, pr.start_date + 45), 'محضر تنسيق مع جهات المرافق', null, 'بيانات تجريبية'),
        (pr.id, 'minutes', null, 'م-' || pr.n || '/3', current_date - 9, 'محضر اجتماع التنسيق الشهري', mc, 'بيانات تجريبية'),
        (pr.id, 'letter', 'in', 'خ و-' || pr.n || '/1', current_date - 25, 'خطاب المقاول بطلب مد مدة', mc, 'بيانات تجريبية'),
        (pr.id, 'letter', 'out', 'خ ص-' || pr.n || '/1', current_date - 18, 'الرد على طلب مد المدة', mc, 'بيانات تجريبية'),
        (pr.id, 'letter', 'out', 'خ ص-' || pr.n || '/2', current_date - 6, 'خطاب استعجال توريد الخامات', sc, 'بيانات تجريبية');
    end if;
  end loop;

  -- الالتزامات والمؤتمرات
  insert into public.commitments (kind, title, project_id, due_date, due_time, location, responsible, status, demo) values
    ('conference','المؤتمر الشهري لمتابعة مشروعات الطرق', null, current_date + 3, '10:00', 'قاعة الاجتماعات الرئيسية', 'قائد الفرع', 'open', true),
    ('meeting','اجتماع تنسيق مع المقاول الرئيسي', prj[1], current_date + 1, '12:00', 'موقع المشروع', 'مهندس المشروع', 'open', true),
    ('commitment','تسليم تقرير الموقف التنفيذي الأسبوعي', null, current_date - 2, null, '', 'مسؤول المتابعة', 'open', true),
    ('commitment','الرد على خطاب طلب مد المدة', prj[2], current_date - 5, null, '', 'الشؤون القانونية', 'open', true),
    ('commitment','اعتماد المستخلص الجاري رقم 7', prj[4], current_date + 6, null, '', 'لجنة المستخلصات', 'open', true),
    ('meeting','اجتماع لجنة استلام المرحلة الأولى', prj[3], current_date + 9, '09:30', 'موقع المشروع', 'لجنة الاستلام', 'open', true),
    ('conference','مؤتمر مراجعة الموقف المالي للربع الأخير', null, current_date + 15, '11:00', 'قاعة المؤتمرات', 'الشؤون المالية', 'open', true),
    ('commitment','توريد قطع غيار الجريدرات', null, current_date - 1, null, '', 'الشؤون الفنية', 'open', true),
    ('meeting','اجتماع التنسيق الشهري', prj[1], current_date - 9, '10:00', 'موقع المشروع', 'مهندس المشروع', 'done', true),
    ('commitment','تحويل مسار المرافق المعترضة', prj[5], current_date - 20, null, '', 'جهة المرافق', 'cancelled', true);

  -- الشؤون الفنية: المعدات (موزعة على المشروعات الجارية)
  for i in 1..array_length(eqn, 1) loop
    insert into public.equipment (code, name, category, plate_no, project_id, status, demo, notes)
    values ('مع-' || lpad(i::text, 3, '0'), eqn[i], eqc[i], 'ط ' || (1200 + i * 37),
            case when i in (8, 14) then null else prj[1 + ((i - 1) % 6)] end, eqs[i], true, 'بيانات تجريبية')
    returning id into eq;
    insert into public.maintenance (equipment_id, done_on, kind, description, cost, next_due) values
      (eq, current_date - 70 - i, 'periodic', 'صيانة دورية: تغيير زيت وفلاتر', 3500 + i * 120, current_date - 70 - i + 90),
      (eq, current_date - 20 - i, case when eqs[i] in ('broken','maintenance') then 'repair' else 'periodic' end,
           case when eqs[i] = 'broken' then 'عطل في المضخة الهيدروليكية — في انتظار قطعة غيار' when eqs[i] = 'maintenance' then 'إصلاح ناقل الحركة' else 'فحص عام وتشحيم' end,
           case when eqs[i] in ('broken','maintenance') then 18000 + i * 900 else 1200 + i * 50 end,
           case when i % 4 = 0 then current_date - 3 else current_date + 20 + i end);
  end loop;

  -- قطع الغيار وحركة المخزن
  for i in 1..array_length(pn, 1) loop
    insert into public.spare_parts (code, name, unit, qty, min_qty, warehouse, demo)
    values ('قغ-' || lpad(i::text, 3, '0'), pn[i], pu[i], pq[i], pm[i], case when i <= 6 then 'المخزن الرئيسي' else 'مخزن الموقع' end, true)
    returning id into part;
    select id into eq from public.equipment where demo order by code offset ((i - 1) % 14) limit 1;
    insert into public.part_movements (part_id, moved_on, qty, equipment_id, note)
    values (part, current_date - 12 - i, -round(pq[i] * case when i in (3, 7, 9) then 0.8 else 0.3 end), eq, 'صرف لصيانة المعدة');
  end loop;
end; $$;

revoke all on function public.load_demo_data() from public, anon;
revoke all on function public.clear_demo_data() from public, anon;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
