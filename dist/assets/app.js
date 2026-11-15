/* منظومة المتابعة — شاشات المنظومة (لوحة التحكم، المشروعات، الشركات، المستخلصات) */
(function () {
  const sb = monazoma.sb;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const view = $("#view"), crumb = $("#crumb"), dlg = $("#dlg"), toastEl = $("#toast");
  let ctx = null; // { profile, canEdit, isAdmin }
  let actions = {}; // أزرار الشاشة الحالية: data-action → دالة
  let seq = 0; // رقم الشاشة الحالية — الشاشة اللي اتحملت متأخر بعد التنقل ما تكتبش فوق الجديدة

  /* ---------- أدوات ---------- */
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    proj: '<path d="M4 21 9 3"/><path d="M20 21 15 3"/><path d="M12 5v2M12 11v2M12 17v2"/>',
    co: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 10h.01M15 10h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    back: '<path d="m9 18 6-6-6-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    ext: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    flow: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 4 4v5.5"/>',
    stat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  const nf = new Intl.NumberFormat("ar-EG");
  const money = v => v == null || v === "" ? "—" : nf.format(Number(v)) + " ج.م";
  const date = v => v ? new Date(v + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const STATUS = { planned: ["لم يبدأ", "gray"], active: ["جارٍ التنفيذ", "blue"], suspended: ["متوقف", "red"], completed: ["مكتمل", "green"] };
  const KIND = { contractor: "مقاول رئيسي", subcontractor: "مقاول باطن", supplier: "مورّد" };
  const pill = s => `<span class="pill ${STATUS[s]?.[1] || ""}">${esc(STATUS[s]?.[0] || s)}</span>`;
  const progress = v => `<div class="prog"><div class="progress"><i style="width:${Math.max(0, Math.min(100, Number(v) || 0))}%"></i></div><span>${nf.format(Number(v) || 0)}٪</span></div>`;
  // حالات المستخلص: [الاسم، اللون]، والانتقالات المسموحة من كل حالة
  const EXT_STATUS = {
    submitted: ["مقدَّم", "gray"], under_review: ["قيد المراجعة", "amber"], needs_completion: ["مطلوب استكمال", "red"],
    approved: ["معتمد", "blue"], paid: ["مصروف", "green"], rejected: ["مرفوض", "dark"],
  };
  const EXT_NEXT = {
    submitted: ["under_review", "rejected"], under_review: ["approved", "needs_completion", "rejected"],
    needs_completion: ["under_review"], approved: ["paid"], rejected: ["under_review"], paid: [],
  };
  const EXT_ACTION = { under_review: "بدء المراجعة", needs_completion: "طلب استكمال", approved: "اعتماد", paid: "تسجيل الصرف", rejected: "رفض" };
  const NOTE_REQUIRED = new Set(["needs_completion", "rejected"]);
  const EXT_OPEN = ["submitted", "under_review", "needs_completion"]; // تحت المتابعة
  const EXT_KIND = { interim: "جاري", final: "ختامي" };
  const extPill = s => `<span class="pill ${EXT_STATUS[s]?.[1] || ""}">${esc(EXT_STATUS[s]?.[0] || s)}</span>`;
  const extNo = e => `مستخلص ${EXT_KIND[e.kind] || ""} رقم ${nf.format(e.number)}`;
  // المواقف التنفيذية
  const COND = { on_track: ["منتظم", "green"], delayed: ["متأخر", "amber"], stopped: ["متوقف", "red"] };
  const condPill = c => c ? `<span class="pill ${COND[c]?.[1] || ""}">${esc(COND[c]?.[0] || c)}</span>` : `<span class="pill gray">لا يوجد موقف</span>`;
  const STALE_DAYS = 7; // المشروع الجاري اللي ما اتسجلوش موقف من أكتر من كده بيظهر كتنبيه
  const daysSince = d => d ? Math.floor((Date.now() - new Date(d + "T00:00:00")) / 864e5) : null;
  // الجدول الزمني: نسبة الوقت المنقضي من (البدء → الانتهاء المخطط) مقارنة بنسبة الإنجاز الفعلية
  // الانحراف = الإنجاز − الوقت المنقضي (بالنقاط). سالب = متأخر عن الجدول.
  const SCHED_WARN = 10; // تأخر أكبر من كده = «متأخر عن الجدول»
  // لو آخر موقف فيه «نسبة الإنجاز المخططة» بنقارن بيها (أدق)، وإلا بالوقت المنقضي (توزيع خطي)
  function schedule(p) {
    if (p.status === "completed" || p.status === "planned") return null;
    const s = p.start_date && new Date(p.start_date + "T00:00:00"), e = p.planned_end_date && new Date(p.planned_end_date + "T00:00:00");
    const elapsed = s && e && e > s ? Math.max(0, Math.min(100, (Date.now() - s) / (e - s) * 100)) : null;
    const hasPlan = p.latest_planned != null;
    if (!hasPlan && elapsed == null) return null;
    const target = hasPlan ? Number(p.latest_planned) : elapsed;
    const variance = Number(p.progress) - target;
    return { elapsed, target, basis: hasPlan ? "plan" : "time", variance, late: variance <= -SCHED_WARN, overdue: !!e && Date.now() > e && Number(p.progress) < 100 };
  }
  const schedPill = sc => !sc ? "—"
    : sc.overdue ? `<span class="pill red">تجاوز موعد الانتهاء</span>`
    : sc.late ? `<span class="pill amber">متأخر ${nf.format(Math.round(-sc.variance))} نقطة</span>`
    : `<span class="pill green">${sc.variance >= 0 ? "في الموعد" : `متأخر ${nf.format(Math.round(-sc.variance))} نقطة`}</span>`;
  const opts = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(Array.isArray(v) ? v[0] : v)}</option>`).join("");

  function toast(msg, bad) {
    if (!bad) snaps.clear(); // رسالة نجاح = حصل تعديل في البيانات
    toastEl.textContent = msg; toastEl.className = "show" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.className = "", 3200);
  }
  function errText(e) {
    if (!navigator.onLine) return "لا يوجد اتصال بالإنترنت.";
    const m = e?.message || "";
    if (e?.code === "23505") return m.includes("companies_name_key") ? "توجد شركة مسجلة بنفس الاسم." : m.includes("projects_code_key") ? "يوجد مشروع مسجل بنفس الرقم."
      : m.includes("extracts_") ? "يوجد مستخلص بنفس الرقم لهذه الشركة في هذا المشروع." : "هذه الشركة مرتبطة بالمشروع بالفعل.";
    if (e?.code === "23503") return m.includes("extracts") ? "لا يمكن الحذف: توجد مستخلصات مسجلة على هذا الارتباط. احذف المستخلصات أولًا."
      : "لا يمكن الحذف: الشركة مرتبطة بمشروعات. احذف الارتباط أولًا.";
    if (e?.code === "23514") return m.includes("extracts") ? "تحقق من القيم: الاستقطاعات لا تزيد عن قيمة الأعمال، ونهاية الفترة بعد بدايتها."
      : "تحقق من القيم المدخلة (النسب بين 0 و100، وتاريخ الانتهاء بعد البدء).";
    if (e?.userMsg) return e.userMsg;
    if (e?.code === "P0001" && m.includes("مدير نشط")) return "يجب أن يبقى مدير نشط واحد على الأقل في المنظومة.";
    if (e?.code === "42501" || e?.code === "PGRST301") return "ليس لديك صلاحية لهذا الإجراء.";
    return "تعذّر تنفيذ العملية، حاول مرة أخرى.";
  }
  async function q(promise) { const { data, error, count } = await promise; if (error) throw error; return count ?? data; }
  // Supabase بيرجّع 1000 صف كحد أقصى في الطلب الواحد — دي بتجيب الكل على دفعات (لازم ترتيب ثابت)
  async function fetchAll(build, page = 1000) {
    const out = [];
    for (let from = 0; ; from += page) {
      const rows = await q(build().range(from, from + page - 1));
      out.push(...rows);
      if (rows.length < page) return out;
    }
  }

  // ذاكرة الصفحات: آخر شكل لكل صفحة (حسب الرابط) بيظهر فورًا لما ترجعلها، والبيانات بتتحدّث في الخلفية.
  // أي حفظ/تعديل/حذف بيمسح الذاكرة عشان ما يظهرش رقم قديم.
  const snaps = new Map();
  const forget = () => snaps.clear();
  const loading = () => {
    const snap = snaps.get(location.hash || "#/");
    if (snap) { view.innerHTML = snap; view.classList.add("stale"); }
    else view.innerHTML = `<div class="loading"><span></span>جارٍ التحميل…</div>`;
  };
  const failed = e => { view.innerHTML = `<div class="panel"><div class="empty"><b>تعذّر تحميل البيانات</b><p>${esc(errText(e))}</p><button class="btn ghost" onclick="location.reload()">إعادة المحاولة</button></div></div>`; };
  const empty = (icon, title, text) => `<div class="empty"><span class="empty-ico">${svg(ICON[icon])}</span><b>${esc(title)}</b><p>${esc(text)}</p></div>`;
  const head = (title, sub, actions = "") => `<section class="head"><div><h1>${esc(title)}</h1>${sub ? `<p class="welcome">${sub}</p>` : ""}</div><div class="head-actions">${actions}</div></section>`;
  const editBtn = (action, label, icon = "plus", cls = "add") => ctx.canEdit ? `<button class="${cls}" data-action="${action}">${svg(ICON[icon])}<span>${esc(label)}</span></button>` : "";

  /* ---------- النوافذ (إضافة/تعديل) ---------- */
  function field(f, val) {
    const v = val ?? f.value ?? "";
    const auto = f.type === "password" ? (f.name === "current" ? "current-password" : "new-password") : (f.autocomplete || "");
    const attrs = `id="f-${f.name}" name="${f.name}"${auto ? ` autocomplete="${auto}"` : ""}${f.required ? " required" : ""}${f.min != null ? ` min="${f.min}"` : ""}${f.max != null ? ` max="${f.max}"` : ""}${f.step ? ` step="${f.step}"` : ""}${f.maxlength ? ` maxlength="${f.maxlength}"` : ""}`;
    let input;
    if (f.type === "select") input = `<select ${attrs}>${f.options}</select>`;
    else if (f.type === "textarea") input = `<textarea ${attrs} rows="3">${esc(v)}</textarea>`;
    else if (f.type === "file") input = `<input ${attrs} type="file"${f.accept ? ` accept="${f.accept}"` : ""} />`;
    else input = `<input ${attrs} type="${f.type || "text"}" value="${esc(v)}"${f.type === "number" ? ' inputmode="decimal"' : ""} />`;
    return `<label class="f${f.wide ? " wide" : ""}" for="f-${f.name}"><span>${esc(f.label)}${f.required ? ' <em>*</em>' : ""}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
  }
  function openForm({ title, fields, data = {}, submitLabel = "حفظ", onSubmit, danger }) {
    dlg.innerHTML = `<form method="dialog" class="dlg-form" novalidate>
      <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="إغلاق">${svg(ICON.x)}</button></header>
      <div class="fields">${fields.map(f => field(f, data[f.name])).join("")}</div>
      <p class="form-err" role="alert"></p>
      <footer>${danger ? `<button type="button" class="btn danger" data-danger>${svg(ICON.trash)}<span>${esc(danger.label)}</span></button>` : ""}<span class="sp"></span><button type="button" class="btn ghost" data-close>إلغاء</button><button type="submit" class="btn primary">${esc(submitLabel)}</button></footer>
    </form>`;
    const form = $("form", dlg), err = $(".form-err", dlg), submit = $("[type=submit]", dlg);
    $$("[data-close]", dlg).forEach(b => b.onclick = () => dlg.close());
    const busy = on => $$("button", dlg).forEach(b => b.disabled = on);
    if (danger) $("[data-danger]", dlg).onclick = async () => {
      if (!confirm(danger.confirm)) return;
      busy(true); err.textContent = "";
      try { await danger.run(); dlg.close(); } catch (e) { err.textContent = errText(e); } finally { busy(false); }
    };
    form.onsubmit = async ev => {
      ev.preventDefault(); err.textContent = "";
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const out = {};
      for (const f of fields) {
        if (f.type === "file") { out[f.name] = form.elements[f.name].files[0] || null; continue; }
        let v = form.elements[f.name].value;
        if (f.type === "number" || f.type === "date") v = v === "" ? null : (f.type === "number" ? Number(v) : v);
        else if (f.type !== "password") v = v.trim();
        out[f.name] = v;
      }
      busy(true); submit.textContent = fields.some(f => f.type === "file" && out[f.name]) ? "جارٍ رفع الملف…" : "جارٍ الحفظ…";
      try { await onSubmit(out); snaps.clear(); dlg.close(); }
      catch (e) { err.textContent = errText(e); }
      finally { busy(false); submit.textContent = submitLabel; }
    };
    dlg.showModal();
    setTimeout(() => $("input,select,textarea", dlg)?.focus(), 30);
    return form;
  }

  const PROJECT_FIELDS = [
    { name: "code", label: "رقم المشروع", required: true, maxlength: 40 },
    { name: "name", label: "اسم المشروع", required: true, maxlength: 200, wide: true },
    { name: "location", label: "الموقع / الطريق", maxlength: 200, wide: true },
    { name: "status", label: "الحالة", type: "select" },
    { name: "progress", label: "نسبة الإنجاز ٪", type: "number", min: 0, max: 100, step: "0.01", value: 0, hint: "تتحدّث تلقائيًا من آخر موقف تنفيذي مسجّل." },
    { name: "contract_value", label: "قيمة التعاقد (ج.م)", type: "number", min: 0, step: "0.01" },
    { name: "start_date", label: "تاريخ البدء", type: "date" },
    { name: "planned_end_date", label: "تاريخ الانتهاء المخطط", type: "date" },
    { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
  ];
  const COMPANY_FIELDS = [
    { name: "name", label: "اسم الشركة", required: true, maxlength: 200, wide: true },
    { name: "kind", label: "التصنيف", type: "select" },
    { name: "commercial_register", label: "رقم السجل التجاري", maxlength: 60 },
    { name: "phone", label: "هاتف الشركة", type: "tel", maxlength: 40 },
    { name: "address", label: "العنوان", maxlength: 300, wide: true },
    { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
  ];
  const withOptions = (fields, data) => fields.map(f =>
    f.name === "status" ? { ...f, options: opts(STATUS, data.status || "planned") } :
    f.name === "kind" ? { ...f, options: opts(KIND, data.kind || "contractor") } : f);

  async function projectForm(p = {}, after) {
    let users = [];
    try { users = await q(sb.from("profiles").select("id,name,username").eq("active", true).order("name")); } catch { /* الاختيار اختياري */ }
    const ownerField = { name: "owner_id", label: "مسؤول المتابعة", type: "select", wide: true,
      options: `<option value="">بدون</option>` + users.map(u => `<option value="${u.id}"${u.id === (p.id ? p.owner_id : ctx.profile.id) ? " selected" : ""}>${esc(u.name || u.username)}</option>`).join(""),
      hint: "الشخص المسؤول عن تحديث مواقف ومستخلصات المشروع." };
    const fields = withOptions(PROJECT_FIELDS, p);
    fields.splice(3, 0, ownerField);
    openForm({
      title: p.id ? "تعديل بيانات المشروع" : "إضافة مشروع", fields, data: p,
      submitLabel: p.id ? "حفظ التعديلات" : "إضافة المشروع",
      onSubmit: async v => {
        v.owner_id = v.owner_id || null;
        const row = await q(p.id ? sb.from("projects").update(v).eq("id", p.id).select().single() : sb.from("projects").insert(v).select().single());
        toast(p.id ? "تم حفظ التعديلات." : "تمت إضافة المشروع."); after ? after(row) : route();
      },
      danger: p.id && ctx.isAdmin ? { label: "حذف المشروع", confirm: `حذف المشروع «${p.name}» وكل ارتباطاته بالشركات؟ لا يمكن التراجع.`, run: async () => { await q(sb.from("projects").delete().eq("id", p.id)); toast("تم حذف المشروع."); location.hash = "#/projects"; } } : null,
    });
  }
  function companyForm(c = {}, after) {
    openForm({
      title: c.id ? "تعديل بيانات الشركة" : "إضافة شركة", fields: withOptions(COMPANY_FIELDS, c), data: c,
      submitLabel: c.id ? "حفظ التعديلات" : "إضافة الشركة",
      onSubmit: async v => {
        const row = await q(c.id ? sb.from("companies").update(v).eq("id", c.id).select().single() : sb.from("companies").insert(v).select().single());
        toast(c.id ? "تم حفظ التعديلات." : "تمت إضافة الشركة."); after ? after(row) : route();
      },
      danger: c.id && ctx.isAdmin ? { label: "حذف الشركة", confirm: `حذف الشركة «${c.name}»؟ لا يمكن التراجع.`, run: async () => { await q(sb.from("companies").delete().eq("id", c.id)); toast("تم حذف الشركة."); location.hash = "#/companies"; } } : null,
    });
  }
  function linkForm(projectId, link = null, companies = []) {
    const fields = [
      link ? null : { name: "company_id", label: "الشركة", type: "select", required: true, wide: true,
        options: `<option value="">اختر الشركة…</option>` + companies.map(c => `<option value="${c.id}">${esc(c.name)} — ${esc(KIND[c.kind])}</option>`).join("") },
      { name: "role", label: "دورها في المشروع", type: "select", options: opts(KIND, link?.role || "contractor") },
      { name: "contract_value", label: "قيمة تعاقدها (ج.م)", type: "number", min: 0, step: "0.01" },
      { name: "scope", label: "نطاق الأعمال", type: "textarea", wide: true, maxlength: 1000 },
    ].filter(Boolean);
    openForm({
      title: link ? `تعديل ارتباط ${link.companies.name}` : "ربط شركة بالمشروع", fields, data: link || {},
      submitLabel: link ? "حفظ" : "ربط الشركة",
      onSubmit: async v => {
        if (link) await q(sb.from("project_companies").update(v).eq("project_id", projectId).eq("company_id", link.company_id));
        else await q(sb.from("project_companies").insert({ ...v, project_id: projectId }));
        toast(link ? "تم حفظ التعديلات." : "تم ربط الشركة بالمشروع."); route();
      },
      danger: link ? { label: "إلغاء الربط", confirm: `إلغاء ربط «${link.companies.name}» بهذا المشروع؟`, run: async () => { await q(sb.from("project_companies").delete().eq("project_id", projectId).eq("company_id", link.company_id)); toast("تم إلغاء الربط."); route(); } } : null,
    });
  }

  /* ---------- المستخلصات: النوافذ ---------- */
  const EXTRACT_FIELDS = [
    { name: "number", label: "رقم المستخلص", type: "number", required: true, min: 1, step: "1" },
    { name: "kind", label: "النوع", type: "select" },
    { name: "submitted_on", label: "تاريخ التقديم", type: "date", required: true },
    { name: "period_from", label: "الفترة من", type: "date" },
    { name: "period_to", label: "الفترة إلى", type: "date" },
    { name: "gross_amount", label: "قيمة الأعمال (ج.م)", type: "number", required: true, min: 0, step: "0.01" },
    { name: "deductions", label: "الاستقطاعات (ج.م)", type: "number", min: 0, step: "0.01", value: 0, hint: "تأمينات، ضرائب، دفعات مقدمة، غرامات…" },
    { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
  ];
  const today = () => new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd بالتوقيت المحلي

  async function extractForm(e = null, preset = {}) {
    let links = [];
    if (!e) {
      try { links = await fetchAll(() => sb.from("project_companies").select("project_id,company_id,projects(code,name),companies(name)").order("project_id").order("company_id")); }
      catch (err) { toast(errText(err), true); return; }
      if (preset.project_id) links = links.filter(l => l.project_id === preset.project_id);
      if (preset.company_id) links = links.filter(l => l.company_id === preset.company_id);
      if (!links.length) { toast("لا توجد شركات مرتبطة بمشروعات. اربط الشركة بالمشروع أولًا من صفحة المشروع.", true); return; }
    }
    const projects = [...new Map(links.map(l => [l.project_id, l.projects])).entries()].sort((a, b) => a[1].code.localeCompare(b[1].code, "ar"));
    const fields = [
      ...(e ? [] : [
        { name: "project_id", label: "المشروع", type: "select", required: true, wide: true,
          options: (projects.length > 1 ? `<option value="">اختر المشروع…</option>` : "") + projects.map(([id, p]) => `<option value="${id}">${esc(p.code)} — ${esc(p.name)}</option>`).join("") },
        { name: "company_id", label: "الشركة", type: "select", required: true, wide: true, options: "" },
      ]),
      ...EXTRACT_FIELDS.map(f => f.name === "kind" ? { ...f, options: opts(EXT_KIND, e?.kind || "interim") } : f),
    ];
    const form = openForm({
      title: e ? `تعديل ${extNo(e)}` : "تسجيل مستخلص", fields,
      data: e || { submitted_on: today() },
      submitLabel: e ? "حفظ التعديلات" : "تسجيل المستخلص",
      onSubmit: async v => {
        const row = await q(e ? sb.from("extracts").update(v).eq("id", e.id).select().single() : sb.from("extracts").insert(v).select().single());
        toast(e ? "تم حفظ التعديلات." : "تم تسجيل المستخلص.");
        e ? route() : (location.hash = `#/extracts/${row.id}`);
      },
      danger: e && ctx.isAdmin ? { label: "حذف المستخلص", confirm: `حذف ${extNo(e)} وسجل متابعته؟ لا يمكن التراجع.`, run: async () => { await q(sb.from("extracts").delete().eq("id", e.id)); toast("تم حذف المستخلص."); location.hash = "#/extracts"; } } : null,
    });
    // الصافي يتحسب وانت بتكتب
    const el = n => form.elements[n];
    const hint = el("deductions").parentElement.querySelector("small");
    const baseHint = hint.textContent;
    const showNet = () => {
      const g = Number(el("gross_amount").value) || 0, d = Number(el("deductions").value) || 0;
      hint.textContent = el("gross_amount").value ? `الصافي المستحق: ${money(g - d)}` : baseHint;
      hint.classList.toggle("bad", d > g);
    };
    el("gross_amount").oninput = el("deductions").oninput = showNet; showNet();
    if (e) return;
    // اختيار المشروع يحدد الشركات، واختيار الشركة يقترح الرقم التالي
    let numberTouched = false; el("number").addEventListener("input", () => numberTouched = true);
    const fillCompanies = () => {
      const pid = el("project_id").value, list = links.filter(l => l.project_id === pid).sort((a, b) => a.companies.name.localeCompare(b.companies.name, "ar"));
      el("company_id").innerHTML = !pid ? `<option value="">اختر المشروع أولًا</option>`
        : (list.length > 1 ? `<option value="">اختر الشركة…</option>` : "") + list.map(l => `<option value="${l.company_id}">${esc(l.companies.name)}</option>`).join("");
      if (preset.company_id) el("company_id").value = preset.company_id;
      suggestNumber();
    };
    const suggestNumber = async () => {
      const pid = el("project_id").value, cid = el("company_id").value;
      if (!pid || !cid || numberTouched) return;
      try {
        const last = await q(sb.from("extracts").select("number").eq("project_id", pid).eq("company_id", cid).order("number", { ascending: false }).limit(1));
        if (!numberTouched && el("project_id").value === pid && el("company_id").value === cid) el("number").value = (last[0]?.number || 0) + 1;
      } catch { /* الاقتراح اختياري */ }
    };
    el("project_id").onchange = fillCompanies;
    el("company_id").onchange = suggestNumber;
    fillCompanies();
  }

  function statusForm(e, to) {
    const needNote = NOTE_REQUIRED.has(to);
    openForm({
      title: `${EXT_ACTION[to]} — ${extNo(e)}`,
      fields: [{ name: "note", label: needNote ? "السبب / المطلوب من الشركة" : "ملاحظة (اختياري)", type: "textarea", wide: true, required: needNote, maxlength: 1000 }],
      submitLabel: EXT_ACTION[to],
      onSubmit: async v => {
        await q(sb.rpc("set_extract_status", { p_id: e.id, p_status: to, p_note: v.note }));
        toast(`تم: ${EXT_ACTION[to]}.`); route();
      },
    });
  }

  // جدول مستخلصات (يُستخدم في القائمة وصفحة المشروع والشركة ولوحة التحكم)
  function extractsTable(rows, { project = true, company = true, total = true } = {}) {
    const counted = rows.filter(r => r.status !== "rejected"); // المرفوض لا يدخل الإجمالي
    const sum = counted.reduce((s, r) => s + Number(r.net_amount), 0);
    const totalLabel = counted.length < rows.length ? "إجمالي الصافي (بدون المرفوض)" : "إجمالي الصافي";
    return `<table class="table cards"><thead><tr><th>المستخلص</th>${company ? "<th>الشركة</th>" : ""}${project ? "<th>المشروع</th>" : ""}<th>الفترة</th><th>الصافي</th><th>الحالة</th></tr></thead><tbody>${rows.map(r => `
      <tr class="row-link" data-href="#/extracts/${r.id}" tabindex="0">
        <td data-label="المستخلص" class="title"><span class="company">${esc(EXT_KIND[r.kind])} رقم ${nf.format(r.number)}</span><span class="sub">قُدّم ${date(r.submitted_on)}</span></td>
        ${company ? `<td data-label="الشركة">${esc(r.company_name)}</td>` : ""}
        ${project ? `<td data-label="المشروع"><span class="mono">${esc(r.project_code)}</span><span class="sub">${esc(r.project_name)}</span></td>` : ""}
        <td data-label="الفترة">${r.period_from || r.period_to ? `${date(r.period_from)} ← ${date(r.period_to)}` : "—"}</td>
        <td data-label="الصافي" class="num">${money(r.net_amount)}</td>
        <td data-label="الحالة">${extPill(r.status)}</td>
      </tr>`).join("")}</tbody>${total && rows.length > 1 ? `<tfoot><tr><td colspan="${2 + company + project}">${totalLabel}</td><td class="num">${money(sum)}</td><td></td></tr></tfoot>` : ""}</table>`;
  }

  /* ---------- المواقف التنفيذية: النافذة والبطاقات ---------- */
  // سبب احتياج المشروع للانتباه: stopped (متوقف) · delayed (متأخر) · stale (جارٍ بدون موقف حديث). المكتمل ولم يبدأ مستبعدين.
  function attentionOf(r) {
    if (r.project_status === "completed" || r.project_status === "planned") return null;
    if (r.project_status === "suspended" || r.condition === "stopped") return "stopped";
    if (r.condition === "delayed") return "delayed";
    const d = daysSince(r.report_date);
    if (d === null || d > STALE_DAYS) return "stale";
    return null;
  }
  const attention = rows => new Map(rows.map(r => [r.project_id, attentionOf(r)]).filter(([, w]) => w));
  const WHY = { stopped: ["متوقف", "red"], delayed: ["متأخر", "amber"], stale: ["بدون موقف حديث", "gray"] };

  async function reportForm(s = null, preset = {}) {
    let projects = [], links = [];
    try {
      [projects, links] = await Promise.all([
        s ? [] : fetchAll(() => sb.from("projects").select("id,code,name,progress,start_date,planned_end_date").order("code")),
        fetchAll(() => sb.from("project_companies").select("project_id,company_id,companies(name)").order("project_id").order("company_id")),
      ]);
    } catch (err) { toast(errText(err), true); return; }
    if (!s) {
      if (preset.project_id) projects = projects.filter(p => p.id === preset.project_id);
      if (!projects.length) { toast("لا توجد مشروعات مسجلة. أضف المشروع أولًا.", true); return; }
    }
    const fields = [
      ...(s ? [] : [{ name: "project_id", label: "المشروع", type: "select", required: true, wide: true,
        options: (projects.length > 1 ? `<option value="">اختر المشروع…</option>` : "") + projects.map(p => `<option value="${p.id}">${esc(p.code)} — ${esc(p.name)}</option>`).join("") }]),
      { name: "company_id", label: "الشركة (اختياري)", type: "select", wide: true, options: "" },
      { name: "report_date", label: "تاريخ الموقف", type: "date", required: true },
      { name: "condition", label: "الوضع", type: "select", options: opts(COND, s?.condition || "on_track") },
      { name: "progress", label: "نسبة الإنجاز الفعلية ٪", type: "number", required: true, min: 0, max: 100, step: "0.01", hint: "تُحدِّث نسبة إنجاز المشروع تلقائيًا." },
      { name: "planned_progress", label: "نسبة الإنجاز المخططة ٪", type: "number", min: 0, max: 100, step: "0.01", hint: "حسب البرنامج الزمني في نفس التاريخ (اختياري — يُقارن بها الفعلي)." },
      { name: "work_done", label: "الأعمال المنفذة", type: "textarea", wide: true, maxlength: 3000 },
      { name: "next_steps", label: "الأعمال المخططة للفترة القادمة", type: "textarea", wide: true, maxlength: 3000 },
      { name: "obstacles", label: "العوائق والمشكلات", type: "textarea", wide: true, maxlength: 3000, hint: "مطلوبة إذا كان الوضع متأخرًا أو متوقفًا." },
      { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
    ];
    const form = openForm({
      title: s ? `تعديل موقف ${s.project_code} — ${date(s.report_date)}` : "تسجيل موقف تنفيذي", fields,
      data: s || { report_date: today() },
      submitLabel: s ? "حفظ التعديلات" : "تسجيل الموقف",
      onSubmit: async v => {
        v.company_id = v.company_id || null;
        await q(s ? sb.from("project_statuses").update(v).eq("id", s.id) : sb.from("project_statuses").insert(v));
        toast(s ? "تم حفظ التعديلات." : "تم تسجيل الموقف التنفيذي."); route();
      },
      danger: s && ctx.isAdmin ? { label: "حذف الموقف", confirm: `حذف موقف ${s.project_code} بتاريخ ${date(s.report_date)}؟`, run: async () => { await q(sb.from("project_statuses").delete().eq("id", s.id)); toast("تم حذف الموقف."); route(); } } : null,
    });
    const el = n => form.elements[n];
    const fillCompanies = () => {
      const pid = s ? s.project_id : el("project_id").value;
      const list = links.filter(l => l.project_id === pid).sort((a, b) => a.companies.name.localeCompare(b.companies.name, "ar"));
      el("company_id").innerHTML = `<option value="">المشروع ككل</option>` + list.map(l => `<option value="${l.company_id}">${esc(l.companies.name)}</option>`).join("");
      if (s?.company_id) el("company_id").value = s.company_id;
      // نسبة الإنجاز تبدأ من نسبة المشروع الحالية
      if (!s && !el("progress").dataset.touched) { const p = projects.find(x => x.id === pid); el("progress").value = p ? Number(p.progress) : ""; }
      if (!s && !el("planned_progress").dataset.touched) { const p = projects.find(x => x.id === pid); const sc = p && schedule({ ...p, status: "active", latest_planned: null }); el("planned_progress").value = sc?.elapsed != null ? Math.round(sc.elapsed) : ""; }
    };
    el("progress").addEventListener("input", () => el("progress").dataset.touched = "1");
    el("planned_progress").addEventListener("input", () => el("planned_progress").dataset.touched = "1");
    const cond = () => { el("obstacles").required = el("condition").value !== "on_track"; };
    el("condition").addEventListener("change", cond); cond();
    if (!s) el("project_id").onchange = fillCompanies;
    fillCompanies();
  }

  // بطاقات المواقف (القائمة الكاملة، صفحة المشروع، لوحة التحكم)
  function statusCards(rows, { project = true, compact = false } = {}) {
    const block = (label, text, cls = "") => text ? `<div class="st-block ${cls}"><span>${label}</span><p>${esc(text)}</p></div>` : "";
    return `<div class="st-list">${rows.map(r => `
      <article class="st-card ${r.condition}">
        <header>
          <div class="st-title">${project ? `<a class="company" href="#/projects/${r.project_id}"><span class="mono">${esc(r.project_code)}</span> ${esc(r.project_name)}</a>` : ""}
            <span class="sub">${date(r.report_date)}${r.company_name ? `، ${esc(r.company_name)}` : ""}</span></div>
          <div class="st-meta">${condPill(r.condition)}${progress(r.progress)}${r.planned_progress != null ? `<span class="st-plan" title="المخطط">المخطط ${nf.format(Number(r.planned_progress))}٪</span>` : ""}${ctx.canEdit && !compact ? `<button class="icon-btn" data-action="edit-status" data-id="${r.id}" aria-label="تعديل الموقف">${svg(ICON.edit)}</button>` : ""}</div>
        </header>
        ${compact ? block("العوائق", r.obstacles, "obst") :
          block("الأعمال المنفذة", r.work_done) + block("المخطط للفترة القادمة", r.next_steps) + block("العوائق", r.obstacles, "obst") + block("ملاحظات", r.notes)}
      </article>`).join("")}</div>`;
  }


  /* ---------- منحنى التقدم (S-curve): الفعلي مقابل المخطط ---------- */
  // محور واحد (٠–١٠٠٪) والزمن من الشمال لليمين (الرسوم البيانية ما بتتقلبش في الواجهات العربي).
  // الألوان متحقق منها لعمى الألوان: الفعلي أزرق متصل، المخطط ذهبي متقطع.
  const C_ACT = "#0a6fa8", C_PLAN = "#b8860b";
  function sCurve(p, reps) {
    const T = d => new Date(d + "T00:00:00").getTime();
    const pts = reps.slice().sort((a, b) => T(a.report_date) - T(b.report_date));
    const start = p.start_date ? T(p.start_date) : pts.length ? T(pts[0].report_date) : null;
    const endPlan = p.planned_end_date ? T(p.planned_end_date) : null;
    if (start == null || (!pts.length && !endPlan)) return null;
    const hasPlan = pts.some(r => r.planned_progress != null);
    const xs = [start, endPlan, Date.now(), ...pts.map(r => T(r.report_date))].filter(v => v != null);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1;
    const W = 720, H = 250, L = 40, R = 14, TOP = 12, B = 28;
    const X = v => L + (v - x0) / (x1 - x0) * (W - L - R), Y = v => TOP + (1 - v / 100) * (H - TOP - B);
    const actual = [{ t: start, v: 0 }, ...pts.map(r => ({ t: T(r.report_date), v: Number(r.progress), r }))];
    const planned = hasPlan ? [{ t: start, v: 0 }, ...pts.filter(r => r.planned_progress != null).map(r => ({ t: T(r.report_date), v: Number(r.planned_progress) }))]
      : endPlan ? [{ t: start, v: 0 }, { t: endPlan, v: 100 }] : [];
    const path = arr => arr.map((d, i) => `${i ? "L" : "M"}${X(d.t).toFixed(1)},${Y(d.v).toFixed(1)}`).join("");
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="sc-grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="sc-ax" text-anchor="end">${nf.format(v)}٪</text>`).join("");
    const months = Math.max(1, Math.round((x1 - x0) / 2.6e9)), step = Math.max(1, Math.ceil(months / 6));
    const ticks = []; { const d = new Date(x0); d.setDate(1); d.setMonth(d.getMonth() + 1);
      for (let i = 0; d.getTime() < x1; i++, d.setMonth(d.getMonth() + 1)) if (i % step === 0) ticks.push(d.getTime()); }
    const xt = ticks.map(v => `<text x="${X(v)}" y="${H - 8}" class="sc-ax" text-anchor="middle">${new Date(v).toLocaleDateString("ar-EG", { month: "short", year: "2-digit" })}</text>`).join("");
    const today = Date.now() <= x1 ? `<line x1="${X(Date.now())}" x2="${X(Date.now())}" y1="${TOP}" y2="${H - B}" class="sc-today"/><text x="${X(Date.now()) - 4}" y="${H - B - 6}" class="sc-ax" text-anchor="end">اليوم</text>` : "";
    const last = actual[actual.length - 1];
    const svg = `<svg viewBox="0 0 ${W} ${H}" class="sc-svg" role="img" aria-label="منحنى التقدم: الإنجاز الفعلي ${nf.format(last.v)}٪ مقابل المخطط">
      ${grid}${xt}${today}
      ${planned.length ? `<path d="${path(planned)}" fill="none" stroke="${C_PLAN}" stroke-width="2" stroke-dasharray="6 5" stroke-linejoin="round"/>` : ""}
      <path d="${path(actual)}" fill="none" stroke="${C_ACT}" stroke-width="2" stroke-linejoin="round"/>
      ${pts.length ? `<circle cx="${X(last.t)}" cy="${Y(last.v)}" r="4.5" fill="${C_ACT}" stroke="#fff" stroke-width="2"/>` : ""}
      <g class="sc-hover" visibility="hidden"><line class="sc-cross" y1="${TOP}" y2="${H - B}"/><circle class="sc-dot-a" r="4.5" fill="${C_ACT}" stroke="#fff" stroke-width="2"/><circle class="sc-dot-p" r="4.5" fill="${C_PLAN}" stroke="#fff" stroke-width="2"/></g>
      <rect class="sc-hit" x="${L}" y="${TOP}" width="${W - L - R}" height="${H - TOP - B}" fill="transparent"/>
    </svg>`;
    const planAt = tt => { // قيمة المخطط عند أي تاريخ (استيفاء خطي بين النقط)
      if (!planned.length) return null;
      for (let i = 1; i < planned.length; i++) if (tt <= planned[i].t) { const a = planned[i - 1], b = planned[i]; return a.v + (b.v - a.v) * (tt - a.t) / (b.t - a.t || 1); }
      return planned[planned.length - 1].v;
    };
    return { html: `<div class="sc-legend"><span><i style="background:${C_ACT}"></i>الإنجاز الفعلي</span><span><i class="dash" style="border-color:${C_PLAN}"></i>${hasPlan ? "المخطط (من المواقف)" : "المخطط (توزيع خطي على المدة)"}</span></div>
        <div class="sc-wrap" dir="ltr">${svg}<div class="sc-tip" dir="rtl" hidden></div></div>`,
      bind(root) {
        const svgEl = $(".sc-svg", root), tip = $(".sc-tip", root), g = $(".sc-hover", root);
        if (!svgEl || pts.length === 0) return;
        const move = ev => {
          const r = svgEl.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
          const tt = x0 + (px - L) / (W - L - R) * (x1 - x0);
          let best = actual[1], bd = Infinity;
          actual.slice(1).forEach(d => { const dd = Math.abs(d.t - tt); if (dd < bd) { bd = dd; best = d; } });
          const pv = best.r.planned_progress != null ? Number(best.r.planned_progress) : planAt(best.t);
          g.setAttribute("visibility", "visible");
          $(".sc-cross", g).setAttribute("x1", X(best.t)); $(".sc-cross", g).setAttribute("x2", X(best.t));
          $(".sc-dot-a", g).setAttribute("cx", X(best.t)); $(".sc-dot-a", g).setAttribute("cy", Y(best.v));
          const dp = $(".sc-dot-p", g); if (pv != null) { dp.setAttribute("cx", X(best.t)); dp.setAttribute("cy", Y(pv)); dp.style.display = ""; } else dp.style.display = "none";
          tip.hidden = false;
          tip.innerHTML = `<b>${date(best.r.report_date)}</b><span><i style="background:${C_ACT}"></i>الفعلي ${nf.format(best.v)}٪</span>${pv != null ? `<span><i class="dash" style="border-color:${C_PLAN}"></i>المخطط ${nf.format(Math.round(pv * 10) / 10)}٪</span>` : ""}${best.r.condition ? `<span>${esc(COND[best.r.condition][0])}</span>` : ""}`;
          const left = X(best.t) / W * r.width;
          tip.style.left = Math.min(Math.max(left - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth) + "px";
        };
        const hit = $(".sc-hit", root);
        hit.addEventListener("mousemove", move); hit.addEventListener("touchstart", move, { passive: true }); hit.addEventListener("touchmove", move, { passive: true });
        hit.addEventListener("mouseleave", () => { g.setAttribute("visibility", "hidden"); tip.hidden = true; });
      } };
  }

  /* ---------- الشاشات ---------- */
  async function dashboard() {
    const my = seq;
    crumb.innerHTML = `<b>الرئيسية</b> / لوحة التحكم`;
    // لو اللوحة اتفتحت قبل كده بتظهر نسختها الأخيرة لحد ما الأرقام الجديدة توصل (بدل ما تظهر أصفار)
    let mounted = false;
    const mount = () => { mounted = true; view.replaceChildren($("#tpl-dashboard").content.cloneNode(true)); $$("[data-needs-edit]", view).forEach(el => el.hidden = !ctx.canEdit); };
    if (snaps.has(location.hash || "#/")) loading(); else mount();
    try {
      const [pc, cc, active, openN, needs, latest, perProject, reports, lateC, brokenEq, parts] = await Promise.all([
        q(sb.from("projects").select("id", { count: "exact", head: true })),
        q(sb.from("companies").select("id", { count: "exact", head: true })),
        q(sb.from("projects").select("progress").eq("status", "active")),
        q(sb.from("extracts").select("id", { count: "exact", head: true }).in("status", EXT_OPEN)),
        q(sb.from("extracts").select("id", { count: "exact", head: true }).eq("status", "needs_completion")),
        q(sb.from("extracts_overview").select("*").order("submitted_on", { ascending: false }).order("created_at", { ascending: false }).limit(5)),
        q(sb.from("project_latest_status").select("project_id,project_status,condition,report_date")),
        q(sb.from("project_statuses_overview").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(4)),
        q(sb.from("commitments").select("id", { count: "exact", head: true }).eq("status", "open").lt("due_date", today())),
        q(sb.from("equipment").select("id", { count: "exact", head: true }).eq("status", "broken")),
        q(sb.from("spare_parts").select("qty,min_qty")),
      ]);
      const lowParts = parts.filter(x => Number(x.qty) < Number(x.min_qty)).length;
      if (my !== seq) return;
      if (!mounted) mount();
      demoBanner();
      $('[data-stat="extracts"]', view).textContent = nf.format(openN);
      $('[data-stat-note="extracts"]', view).textContent = openN ? `${nf.format(openN - needs)} بانتظار المراجعة، ${nf.format(needs)} مطلوب استكمال` : "لا توجد مستخلصات تحت المتابعة";
      // المشروعات اللي محتاجة انتباه (كل مشروع يتعد مرة واحدة)
      const att = attention(perProject);
      const nAtt = att.size, total = needs + nAtt + lateC + brokenEq + lowParts;
      const counts = { stopped: 0, delayed: 0, stale: 0 };
      att.forEach(why => counts[why]++);
      $('[data-stat="alerts"]', view).textContent = nf.format(total);
      $('[data-stat-note="alerts"]', view).textContent = total
        ? [needs && `${nf.format(needs)} مستخلص مطلوب استكماله`, counts.stopped && `${nf.format(counts.stopped)} مشروع متوقف`,
           counts.delayed && `${nf.format(counts.delayed)} متأخر`, counts.stale && `${nf.format(counts.stale)} بدون موقف حديث`, lateC && `${nf.format(lateC)} التزام متأخر`, brokenEq && `${nf.format(brokenEq)} معدة معطلة`, lowParts && `${nf.format(lowParts)} صنف تحت حد الطلب`].filter(Boolean).join("، ")
        : "لا توجد تنبيهات";
      if (latest.length) $("[data-latest-extracts]", view).innerHTML = extractsTable(latest, { project: false, total: false });
      if (reports.length) $("[data-latest-statuses]", view).innerHTML = statusCards(reports, { compact: true });
      $('[data-stat="projects"]', view).textContent = nf.format(pc);
      $('[data-stat-note="projects"]', view).textContent = pc ? `منها ${nf.format(active.length)} جارٍ التنفيذ` : "لم تُسجَّل مشروعات بعد";
      $('[data-stat="companies"]', view).textContent = nf.format(cc);
      $('[data-stat-note="companies"]', view).textContent = cc ? "شركات منفذة ومقاولون وموردون" : "لم تُسجَّل شركات بعد";
      if (active.length) {
        const avg = active.reduce((s, r) => s + Number(r.progress), 0) / active.length;
        $('[data-stat="progress"]', view).textContent = nf.format(Math.round(avg)) + "٪";
        $("[data-stat-bar]", view).style.width = avg + "%";
      }
    } catch (e) { if (my === seq) toast(errText(e), true); }
  }

  async function demoBanner() {
    try {
      const n = await q(sb.from("projects").select("id", { count: "exact", head: true }).eq("demo", true));
      if (!n || $(".demo-banner", view)) return;
      const b = document.createElement("div"); b.className = "demo-banner";
      b.innerHTML = `<b>بيانات تجريبية</b><span>المنظومة تعرض الآن ${nf.format(n)} مشروعات تجريبية للعرض.</span>${ctx.isAdmin ? `<a href="#/settings">إدارتها من الإعدادات</a>` : ""}`;
      view.prepend(b);
    } catch { /* اختياري */ }
  }

  async function projectsList() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / المشروعات`;
    loading();
    let rows;
    try { rows = await fetchAll(() => sb.from("projects_overview").select("*").order("code")); } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = projectsList.f ||= { text: "", status: "", owner: "" };
    const owners = [...new Map(rows.filter(r => r.owner_id).map(r => [r.owner_id, r.owner_name])).entries()].sort((a, b) => (a[1] || "").localeCompare(b[1] || "", "ar"));
    view.innerHTML = head("المشروعات", `مشروعات الطرق المسجلة وحالتها ونسبة الإنجاز.`, editBtn("add-project", "إضافة مشروع")) +
      `<section class="panel">
        <div class="filters">
          <label class="search">${svg(ICON.search)}<input type="search" id="q" placeholder="بحث برقم المشروع أو الاسم أو الموقع" value="${esc(f.text)}" /></label>
          <select id="st" aria-label="الحالة"><option value="">كل الحالات</option>${opts(STATUS, f.status)}</select>
          <select id="ow" aria-label="مسؤول المتابعة"><option value="">كل المسؤولين</option><option value="me"${f.owner === "me" ? " selected" : ""}>مشروعاتي</option><option value="none"${f.owner === "none" ? " selected" : ""}>بدون مسؤول</option>${owners.map(([id, n]) => `<option value="${id}"${f.owner === id ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>
          <span class="count" id="cnt"></span>
        </div>
        <div id="list"></div>
      </section>`;
    const draw = () => {
      const t = f.text.trim().toLowerCase();
      const okOwner = r => !f.owner || (f.owner === "me" ? r.owner_id === ctx.profile.id : f.owner === "none" ? !r.owner_id : r.owner_id === f.owner);
      const list = rows.filter(r => (!f.status || r.status === f.status) && okOwner(r) && (!t || [r.code, r.name, r.location].some(x => (x || "").toLowerCase().includes(t))));
      $("#cnt").textContent = rows.length ? `${nf.format(list.length)} من ${nf.format(rows.length)}` : "";
      $("#list").innerHTML = !rows.length ? empty("proj", "لا توجد مشروعات مسجلة", ctx.canEdit ? "ابدأ بإضافة أول مشروع من زر «إضافة مشروع»." : "ستظهر المشروعات هنا بعد أن يضيفها المسؤول عن الإدخال.")
        : !list.length ? empty("search", "لا توجد نتائج", "غيّر كلمات البحث أو الحالة المختارة.")
        : `<table class="table cards"><thead><tr><th>رقم المشروع</th><th>المشروع</th><th>الحالة</th><th>الإنجاز</th><th>الجدول الزمني</th><th>الشركات</th><th>الانتهاء المخطط</th></tr></thead><tbody>${list.map(r => `
          <tr class="row-link" data-href="#/projects/${r.id}" tabindex="0">
            <td data-label="رقم المشروع" class="mono">${esc(r.code)}</td>
            <td data-label="المشروع" class="title"><span class="company">${esc(r.name)}</span><span class="sub">${[r.location, r.owner_name && `المسؤول: ${r.owner_name}`].filter(Boolean).map(esc).join("، ")}</span></td>
            <td data-label="الحالة">${pill(r.status)}</td>
            <td data-label="الإنجاز">${progress(r.progress)}</td>
            <td data-label="الجدول الزمني">${schedPill(schedule(r))}</td>
            <td data-label="الشركات">${nf.format(r.companies_count)}</td>
            <td data-label="الانتهاء المخطط">${date(r.planned_end_date)}</td>
          </tr>`).join("")}</tbody></table>`;
    };
    $("#q").oninput = e => { f.text = e.target.value; draw(); };
    $("#st").onchange = e => { f.status = e.target.value; draw(); };
    $("#ow").onchange = e => { f.owner = e.target.value; draw(); };
    draw();
  }

  /* =====================================================================
     صفحة المشروع بالتبويبات + المستندات + الموازنة + الحصر + الموقف المالي
     ===================================================================== */
  const DOC_CATS = {
    boq: { label: "المقايسات", one: "مقايسة", accept: ".pdf,.xlsx,.xls,.doc,.docx,image/*" },
    contract: { label: "العقود", one: "عقد", accept: ".pdf,.doc,.docx,image/*" },
    certificate: { label: "الشهادات", one: "شهادة", accept: ".pdf,image/*", dir: true },
    minutes: { label: "محاضر التنسيق", one: "محضر", accept: ".pdf,.doc,.docx,image/*" },
    letter: { label: "الجوابات والخطابات", one: "خطاب", accept: ".pdf,.doc,.docx,image/*", dir: true },
    video: { label: "الفيديو", one: "فيديو", accept: "video/*", video: true },
    presentation: { label: "العرض التقديمي", one: "عرض تقديمي", accept: ".pdf,.ppt,.pptx" },
  };
  const DIR = { out: ["صادر", "blue"], in: ["وارد", "amber"] };
  const PTABS = [
    ["overview", "نظرة عامة"], ["status", "الموقف التنفيذي"], ["finance", "الموقف المالي"], ["budget", "الموازنة"],
    ["boq", "المقايسات"], ["contract", "العقود"], ["extracts", "المستخلصات"], ["works", "بيان الأعمال (الحصر)"],
    ["certificate", "الشهادات"], ["minutes", "محاضر التنسيق"], ["letter", "الجوابات والخطابات"],
    ["video", "الفيديو"], ["presentation", "العرض التقديمي"], ["equipment", "المعدات"],
  ];
  const fmtSize = b => !b ? "" : b > 1048576 ? `${nf.format(Math.round(b / 104857.6) / 10)} ميجا` : `${nf.format(Math.max(1, Math.round(b / 1024)))} ك.ب`;
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : null;

  // ملخص مالي لكل شركة في مشروع (من الربط والمستخلصات)
  function companyFinance(links, exts) {
    return links.map(l => {
      const mine = exts.filter(e => e.company_id === l.company_id && e.status !== "rejected");
      const sum = (arr, k) => arr.reduce((s, e) => s + Number(e[k] || 0), 0);
      const approved = mine.filter(e => e.status === "approved" || e.status === "paid");
      const paid = mine.filter(e => e.status === "paid");
      const open = mine.filter(e => EXT_OPEN.includes(e.status));
      const contract = Number(l.contract_value) || 0;
      return { l, contract, count: mine.length, gross: sum(mine, "gross_amount"), ded: sum(mine, "deductions"),
        approved: sum(approved, "net_amount"), paid: sum(paid, "net_amount"), open: sum(open, "net_amount"),
        remaining: contract ? contract - sum(approved, "gross_amount") : null };
    });
  }
  function financeTable(rows, { firstLabel = "الشركة", first = r => `<a class="company" href="#/companies/${r.l.company_id}">${esc(r.l.companies.name)}</a><span class="sub">${esc(KIND[r.l.role])}</span>` } = {}) {
    const tot = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    return `<div class="rep-wrap"><table class="table cards fin"><thead><tr><th>${firstLabel}</th><th>قيمة التعاقد</th><th>عدد المستخلصات</th><th>إجمالي الأعمال</th><th>الاستقطاعات</th><th>المعتمد (صافي)</th><th>المصروف</th><th>تحت المراجعة</th><th>المتبقي من التعاقد</th></tr></thead><tbody>${rows.map(r => `
      <tr><td data-label="${firstLabel}" class="title">${first(r)}</td>
        <td data-label="قيمة التعاقد" class="num">${money(r.contract || null)}</td>
        <td data-label="عدد المستخلصات">${nf.format(r.count)}</td>
        <td data-label="إجمالي الأعمال" class="num">${money(r.gross)}</td>
        <td data-label="الاستقطاعات" class="num">${money(r.ded)}</td>
        <td data-label="المعتمد (صافي)" class="num">${money(r.approved)}${r.contract ? `<span class="sub">${nf.format(pct(r.approved, r.contract))}٪ من التعاقد</span>` : ""}</td>
        <td data-label="المصروف" class="num">${money(r.paid)}</td>
        <td data-label="تحت المراجعة" class="num">${money(r.open)}</td>
        <td data-label="المتبقي من التعاقد" class="num">${r.remaining == null ? "—" : money(r.remaining)}</td></tr>`).join("")}</tbody>
      ${rows.length > 1 ? `<tfoot><tr><td class="title">الإجمالي</td><td data-label="قيمة التعاقد" class="num">${money(tot("contract"))}</td><td data-label="عدد المستخلصات">${nf.format(tot("count"))}</td><td data-label="إجمالي الأعمال" class="num">${money(tot("gross"))}</td><td data-label="الاستقطاعات" class="num">${money(tot("ded"))}</td><td data-label="المعتمد (صافي)" class="num">${money(tot("approved"))}</td><td data-label="المصروف" class="num">${money(tot("paid"))}</td><td data-label="تحت المراجعة" class="num">${money(tot("open"))}</td><td data-label="المتبقي من التعاقد" class="num">${money(rows.reduce((s, r) => s + (r.remaining || 0), 0))}</td></tr></tfoot>` : ""}</table></div>`;
  }

  // ---------- المستندات والملفات ----------
  const BUCKET = "project-files";
  const safeName = n => (n || "file").replace(/[^\w.\-]+/g, "_").slice(-80);
  async function signedUrl(path, download) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
    if (error) throw error;
    return data.signedUrl;
  }
  async function uploadFile(projectId, cat, file) {
    if (file.size > 50 * 1048576) throw Object.assign(new Error(), { userMsg: "حجم الملف أكبر من ٥٠ ميجا (الحد الأقصى حاليًا)." });
    const path = `${projectId}/${cat}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw Object.assign(error, { userMsg: "تعذّر رفع الملف. تأكد من الاتصال وحاول مرة أخرى." });
    return { file_path: path, file_name: file.name, file_size: file.size, file_type: file.type || "" };
  }
  function docForm(projectId, cat, links, d = null) {
    const C = DOC_CATS[cat];
    const fields = [
      { name: "title", label: `عنوان ${C.one}`, required: true, maxlength: 300, wide: true },
      ...(C.dir ? [{ name: "direction", label: "النوع", type: "select", options: opts(DIR, d?.direction || "out") }] : []),
      { name: "ref_no", label: "الرقم المرجعي", maxlength: 80 },
      { name: "doc_date", label: "التاريخ", type: "date", required: true },
      { name: "company_id", label: "الشركة (اختياري)", type: "select", options: `<option value="">—</option>` + links.map(l => `<option value="${l.company_id}"${l.company_id === d?.company_id ? " selected" : ""}>${esc(l.companies.name)}</option>`).join("") },
      { name: "file", label: d?.file_path ? `استبدال الملف (الحالي: ${d.file_name})` : "الملف", type: "file", accept: C.accept, wide: true, required: !d && C.video, hint: C.video ? "حتى ٥٠ ميجا. للفيديوهات الأكبر يُفضَّل ضغطها أولًا." : "حتى ٥٠ ميجا (اختياري)." },
      { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
    ];
    openForm({
      title: d ? `تعديل ${C.one}` : `إضافة ${C.one}`, fields, data: d || { doc_date: today() },
      submitLabel: d ? "حفظ" : "إضافة",
      onSubmit: async v => {
        const file = v.file; delete v.file;
        v.company_id = v.company_id || null;
        if (file) Object.assign(v, await uploadFile(projectId, cat, file));
        if (d) await q(sb.from("project_documents").update(v).eq("id", d.id));
        else await q(sb.from("project_documents").insert({ ...v, project_id: projectId, category: cat }));
        if (file && d?.file_path) sb.storage.from(BUCKET).remove([d.file_path]); // الملف القديم
        toast(d ? "تم حفظ التعديلات." : `تمت إضافة ${C.one}.`); route();
      },
      danger: d && ctx.isAdmin ? { label: "حذف", confirm: `حذف «${d.title}»${d.file_path ? " والملف المرفق" : ""}؟`, run: async () => {
        await q(sb.from("project_documents").delete().eq("id", d.id));
        if (d.file_path) await sb.storage.from(BUCKET).remove([d.file_path]);
        toast("تم الحذف."); route(); } } : null,
    });
  }
  function docsTab(projectId, cat, docs, links) {
    const C = DOC_CATS[cat];
    const rows = docs.filter(d => d.category === cat);
    const add = editBtn("add-doc", `إضافة ${C.one}`, "plus", "btn ghost sm");
    if (!rows.length) return `<section class="panel"><div class="panel-head"><h2>${C.label}</h2>${add}</div>${empty("ext", `لا توجد ${C.label}`, ctx.canEdit ? `أضف ${C.one} مع الملف من زر «إضافة ${C.one}».` : "لم يُسجَّل شيء بعد.")}</section>`;
    if (C.video) return `<section class="panel"><div class="panel-head"><h2>${C.label}</h2>${add}</div>
      <div class="vid-grid">${rows.map(d => `<article class="vid"><div class="vid-box" data-path="${esc(d.file_path || "")}">${d.file_path ? `<button class="vid-play" data-action="play-video" data-id="${d.id}" aria-label="تشغيل">▶</button>` : `<span class="muted">بدون ملف</span>`}</div>
        <div class="vid-meta"><b>${esc(d.title)}</b><span class="sub">${date(d.doc_date)}${d.file_size ? `، ${fmtSize(d.file_size)}` : ""}</span>
        ${ctx.canEdit ? `<button class="icon-btn" data-action="edit-doc" data-id="${d.id}" aria-label="تعديل">${svg(ICON.edit)}</button>` : ""}</div></article>`).join("")}</div></section>`;
    return `<section class="panel"><div class="panel-head"><h2>${C.label} <small class="muted">(${nf.format(rows.length)})</small></h2>${add}</div>
      <table class="table cards"><thead><tr><th>العنوان</th>${C.dir ? "<th>النوع</th>" : ""}<th>الرقم</th><th>التاريخ</th><th>الشركة</th><th>الملف</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${rows.map(d => `
        <tr><td data-label="العنوان" class="title"><span class="company">${esc(d.title)}</span>${d.notes ? `<span class="sub">${esc(d.notes)}</span>` : ""}</td>
          ${C.dir ? `<td data-label="النوع">${d.direction ? `<span class="pill ${DIR[d.direction][1]}">${DIR[d.direction][0]}</span>` : "—"}</td>` : ""}
          <td data-label="الرقم" class="mono">${esc(d.ref_no) || "—"}</td>
          <td data-label="التاريخ">${date(d.doc_date)}</td>
          <td data-label="الشركة">${esc(links.find(l => l.company_id === d.company_id)?.companies.name) || "—"}</td>
          <td data-label="الملف">${d.file_path ? `<button class="btn ghost sm" data-action="open-file" data-id="${d.id}">فتح</button><span class="sub">${fmtSize(d.file_size)}</span>` : `<span class="muted">بدون ملف</span>`}</td>
          ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="edit-doc" data-id="${d.id}" aria-label="تعديل">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody></table></section>`;
  }

  // ---------- الموازنة ----------
  function budgetForm(projectId, b = null) {
    openForm({
      title: b ? "تعديل بند الموازنة" : "إضافة بند موازنة",
      fields: [
        { name: "category", label: "البند", required: true, maxlength: 150, wide: true, hint: "مثال: أعمال ترابية، رصف، أعمال صناعية…" },
        { name: "description", label: "الوصف", maxlength: 300, wide: true },
        { name: "amount", label: "المعتمد في الموازنة (ج.م)", type: "number", required: true, min: 0, step: "0.01" },
        { name: "spent", label: "المنصرف الفعلي (ج.م)", type: "number", min: 0, step: "0.01", value: 0 },
        { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 1000 },
      ], data: b || {}, submitLabel: b ? "حفظ" : "إضافة",
      onSubmit: async v => {
        v.spent = v.spent ?? 0;
        await q(b ? sb.from("budget_items").update(v).eq("id", b.id) : sb.from("budget_items").insert({ ...v, project_id: projectId }));
        toast("تم الحفظ."); route();
      },
      danger: b && ctx.isAdmin ? { label: "حذف البند", confirm: `حذف بند «${b.category}»؟`, run: async () => { await q(sb.from("budget_items").delete().eq("id", b.id)); toast("تم الحذف."); route(); } } : null,
    });
  }
  function budgetTab(p, items) {
    const tA = items.reduce((s, b) => s + Number(b.amount), 0), tS = items.reduce((s, b) => s + Number(b.spent), 0);
    const bar = (a, b) => { const v = b ? Math.min(100, a / b * 100) : 0; return `<div class="prog"><div class="progress${a > b ? " over" : ""}"><i style="width:${v}%"></i></div><span>${b ? nf.format(Math.round(a / b * 100)) + "٪" : "—"}</span></div>`; };
    return `<section class="kpis">
        <div class="kpi"><span>قيمة التعاقد</span><b>${money(p.contract_value)}</b></div>
        <div class="kpi"><span>إجمالي الموازنة</span><b>${money(tA)}</b></div>
        <div class="kpi"><span>المنصرف</span><b>${money(tS)}</b>${bar(tS, tA)}</div>
        <div class="kpi"><span>المتبقي من الموازنة</span><b class="${tS > tA ? "neg" : ""}">${money(tA - tS)}</b></div>
      </section>
      <section class="panel"><div class="panel-head"><h2>بنود الموازنة</h2>${editBtn("add-budget", "إضافة بند", "plus", "btn ghost sm")}</div>
      ${!items.length ? empty("ext", "لا توجد بنود موازنة", "أضف بنود موازنة المشروع والمعتمد لكل بند.") :
      `<table class="table cards"><thead><tr><th>البند</th><th>المعتمد</th><th>المنصرف</th><th>نسبة الصرف</th><th>المتبقي</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${items.map(b => `
        <tr><td data-label="البند" class="title"><span class="company">${esc(b.category)}</span>${b.description ? `<span class="sub">${esc(b.description)}</span>` : ""}</td>
          <td data-label="المعتمد" class="num">${money(b.amount)}</td><td data-label="المنصرف" class="num">${money(b.spent)}</td>
          <td data-label="نسبة الصرف">${bar(Number(b.spent), Number(b.amount))}</td>
          <td data-label="المتبقي" class="num${Number(b.spent) > Number(b.amount) ? " neg" : ""}">${money(b.amount - b.spent)}</td>
          ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="edit-budget" data-id="${b.id}" aria-label="تعديل">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody>
        <tfoot><tr><td>الإجمالي</td><td class="num">${money(tA)}</td><td class="num">${money(tS)}</td><td></td><td class="num">${money(tA - tS)}</td>${ctx.canEdit ? "<td></td>" : ""}</tr></tfoot></table>`}</section>`;
  }

  // ---------- بيان الأعمال (الحصر) ----------
  function workForm(projectId, links, w = null) {
    openForm({
      title: w ? "تعديل بند أعمال" : "إضافة بند أعمال",
      fields: [
        { name: "item_no", label: "رقم البند", maxlength: 20 },
        { name: "company_id", label: "الشركة", type: "select", options: `<option value="">—</option>` + links.map(l => `<option value="${l.company_id}"${l.company_id === w?.company_id ? " selected" : ""}>${esc(l.companies.name)}</option>`).join("") },
        { name: "description", label: "بيان الأعمال", required: true, maxlength: 400, wide: true },
        { name: "unit", label: "الوحدة", maxlength: 20, hint: "م³، م²، طن، م.ط…" },
        { name: "unit_price", label: "سعر الوحدة (ج.م)", type: "number", min: 0, step: "0.01" },
        { name: "contract_qty", label: "الكمية التعاقدية", type: "number", min: 0, step: "0.001" },
        { name: "executed_qty", label: "الكمية المنفذة حتى تاريخه", type: "number", min: 0, step: "0.001" },
        { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 1000 },
      ], data: w || {}, submitLabel: w ? "حفظ" : "إضافة",
      onSubmit: async v => {
        v.company_id = v.company_id || null; ["unit_price", "contract_qty", "executed_qty"].forEach(k => v[k] = v[k] ?? 0);
        await q(w ? sb.from("work_items").update(v).eq("id", w.id) : sb.from("work_items").insert({ ...v, project_id: projectId }));
        toast("تم الحفظ."); route();
      },
      danger: w && ctx.isAdmin ? { label: "حذف البند", confirm: "حذف بند الأعمال؟", run: async () => { await q(sb.from("work_items").delete().eq("id", w.id)); toast("تم الحذف."); route(); } } : null,
    });
  }
  function worksTab(items, links, f) {
    const list = items.filter(w => !f.company || w.company_id === f.company);
    const cv = w => Number(w.contract_qty) * Number(w.unit_price), ev = w => Number(w.executed_qty) * Number(w.unit_price);
    const tC = list.reduce((s, w) => s + cv(w), 0), tE = list.reduce((s, w) => s + ev(w), 0);
    const qn = v => nf.format(Number(v));
    return `<section class="panel"><div class="panel-head"><h2>بيان الأعمال (الحصر)</h2><div class="head-actions">
        ${links.length ? `<select id="wco" aria-label="الشركة"><option value="">كل الشركات</option>${links.map(l => `<option value="${l.company_id}"${f.company === l.company_id ? " selected" : ""}>${esc(l.companies.name)}</option>`).join("")}</select>` : ""}
        ${editBtn("add-work", "إضافة بند", "plus", "btn ghost sm")}</div></div>
      ${!list.length ? empty("ext", "لا توجد بنود أعمال", "أضف بنود المقايسة بالكمية التعاقدية، وحدّث الكمية المنفذة.") :
      `<div class="rep-wrap"><table class="table cards"><thead><tr><th>م</th><th>بيان الأعمال</th><th>الوحدة</th><th>الكمية التعاقدية</th><th>المنفذ</th><th>نسبة التنفيذ</th><th>سعر الوحدة</th><th>قيمة المنفذ</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${list.map(w => `
        <tr><td data-label="م" class="mono">${esc(w.item_no) || "—"}</td>
          <td data-label="بيان الأعمال" class="title"><span class="company">${esc(w.description)}</span><span class="sub">${esc(links.find(l => l.company_id === w.company_id)?.companies.name || "")}</span></td>
          <td data-label="الوحدة">${esc(w.unit) || "—"}</td><td data-label="الكمية التعاقدية" class="num">${qn(w.contract_qty)}</td>
          <td data-label="المنفذ" class="num">${qn(w.executed_qty)}</td>
          <td data-label="نسبة التنفيذ">${progress(Number(w.contract_qty) ? Math.round(w.executed_qty / w.contract_qty * 100) : 0)}</td>
          <td data-label="سعر الوحدة" class="num">${money(w.unit_price)}</td><td data-label="قيمة المنفذ" class="num">${money(ev(w))}</td>
          ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="edit-work" data-id="${w.id}" aria-label="تعديل">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="5">الإجمالي (القيمة التعاقدية ${money(tC)})</td><td>${progress(tC ? Math.round(tE / tC * 100) : 0)}</td><td></td><td class="num">${money(tE)}</td>${ctx.canEdit ? "<td></td>" : ""}</tr></tfoot></table></div>`}</section>`;
  }

  // ---------- المعدات في المشروع ----------
  const EQ_STATUS = { working: ["تعمل", "green"], maintenance: ["في الصيانة", "amber"], broken: ["معطلة", "red"], idle: ["متوقفة/احتياطي", "gray"] };
  const eqPill = s => `<span class="pill ${EQ_STATUS[s]?.[1] || ""}">${esc(EQ_STATUS[s]?.[0] || s)}</span>`;
  function nextDuePill(d) {
    if (!d) return "—";
    const n = -daysSince(d);
    return n < 0 ? `<span class="pill red">متأخرة ${nf.format(-n)} يوم</span>` : n <= 7 ? `<span class="pill amber">${date(d)}</span>` : date(d);
  }

  async function projectDetail(id, tab = "overview") {
    const my = seq;
    if (!PTABS.some(t => t[0] === tab)) tab = "overview";
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/projects">المشروعات</a> / …`;
    loading();
    let p, links, exts, reps, extra = {};
    try {
      [p, links, exts, reps] = await Promise.all([
        q(sb.from("projects_overview").select("*").eq("id", id).maybeSingle()),
        q(sb.from("project_companies").select("*, companies(id,name,kind)").eq("project_id", id)),
        fetchAll(() => sb.from("extracts_overview").select("*").eq("project_id", id).order("submitted_on", { ascending: false }).order("number", { ascending: false }).order("id")),
        fetchAll(() => sb.from("project_statuses_overview").select("*").eq("project_id", id).order("report_date", { ascending: false }).order("created_at", { ascending: false }).order("id")),
      ]);
      if (DOC_CATS[tab]) extra.docs = await fetchAll(() => sb.from("project_documents").select("*").eq("project_id", id).eq("category", tab).order("doc_date", { ascending: false }).order("id"));
      if (tab === "budget") extra.budget = await fetchAll(() => sb.from("budget_items").select("*").eq("project_id", id).order("created_at").order("id"));
      if (tab === "works") extra.works = await fetchAll(() => sb.from("work_items").select("*").eq("project_id", id).order("item_no").order("id"));
      if (tab === "equipment") extra.eq = await fetchAll(() => sb.from("equipment").select("*, maintenance(done_on,next_due,kind,description)").eq("project_id", id).order("code"));
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    if (!p) { view.innerHTML = `<div class="panel">${empty("proj", "المشروع غير موجود", "ربما حُذف. ارجع لقائمة المشروعات.")}</div>`; return; }
    links.sort((a, b) => a.companies.name.localeCompare(b.companies.name, "ar"));
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/projects">المشروعات</a> / <b>${esc(p.code)}</b>`;
    const sc = schedule(p);
    const tabs = `<nav class="ptabs" aria-label="أقسام المشروع">${PTABS.map(([k, l]) => `<a href="#/projects/${id}/${k}"${k === tab ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
    const summary = `<div class="psum">${pill(p.status)}<span>الإنجاز ${progress(p.progress)}</span>${sc ? `<span>${schedPill(sc)}</span>` : ""}${p.owner_name ? `<span class="muted">المسؤول: ${esc(p.owner_name)}</span>` : ""}</div>`;
    let body = "", curve = null;
    const fin = companyFinance(links, exts);

    if (tab === "overview") {
      curve = sCurve(p, reps);
      const totC = links.reduce((s, l) => s + (Number(l.contract_value) || 0), 0);
      body = `<section class="info panel">
          <div><span>الحالة</span>${pill(p.status)}</div>
          <div><span>نسبة الإنجاز</span>${progress(p.progress)}</div>
          ${sc ? `${sc.basis === "plan" ? `<div><span>المخطط حسب آخر موقف</span>${progress(Math.round(sc.target))}</div>` : sc.elapsed != null ? `<div><span>الوقت المنقضي من المدة</span>${progress(Math.round(sc.elapsed))}</div>` : ""}<div><span>الجدول الزمني</span>${schedPill(sc)}</div>` : ""}
          <div><span>مسؤول المتابعة</span><b>${esc(p.owner_name) || "—"}</b></div>
          <div><span>قيمة التعاقد</span><b>${money(p.contract_value)}</b></div>
          <div><span>تاريخ البدء</span><b>${date(p.start_date)}</b></div>
          <div><span>الانتهاء المخطط</span><b>${date(p.planned_end_date)}</b></div>
          <div><span>المعتمد من المستخلصات</span><b>${money(fin.reduce((s, r) => s + r.approved, 0))}</b></div>
          ${p.notes ? `<div class="wide"><span>ملاحظات</span><p>${esc(p.notes)}</p></div>` : ""}
        </section>
        ${curve ? `<section class="panel"><div class="panel-head"><h2>منحنى التقدم</h2></div>${curve.html}</section>` : ""}
        <section class="panel">
          <div class="panel-head"><h2>الشركات المرتبطة بالمشروع</h2>${editBtn("link-company", "ربط شركة", "link", "btn ghost sm")}</div>
          ${!links.length ? empty("co", "لا توجد شركات مرتبطة", ctx.canEdit ? "اربط الشركات المنفذة والموردين من زر «ربط شركة»." : "لم تُربط شركات بهذا المشروع بعد.") :
          `<table class="table cards"><thead><tr><th>الشركة</th><th>الدور</th><th>نطاق الأعمال</th><th>قيمة التعاقد</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${links.map((l, i) => `
            <tr><td data-label="الشركة" class="title"><a class="company" href="#/companies/${l.company_id}">${esc(l.companies.name)}</a></td>
              <td data-label="الدور">${esc(KIND[l.role])}</td><td data-label="نطاق الأعمال" class="scope">${esc(l.scope) || "—"}</td>
              <td data-label="قيمة التعاقد" class="num">${money(l.contract_value)}</td>
              ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="edit-link" data-i="${i}" aria-label="تعديل الارتباط">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody>
            ${links.length > 1 ? `<tfoot><tr><td colspan="3">الإجمالي</td><td class="num">${money(totC)}</td>${ctx.canEdit ? "<td></td>" : ""}</tr></tfoot>` : ""}</table>`}
        </section>`;
    } else if (tab === "status") {
      const f = projectDetail.sf ||= { company: "" };
      if (f.pid !== id) { f.pid = id; f.company = ""; }
      const latestBy = links.map(l => ({ l, r: reps.find(r => r.company_id === l.company_id) }));
      const list = reps.filter(r => !f.company || (f.company === "general" ? !r.company_id : r.company_id === f.company));
      body = `<section class="panel"><div class="panel-head"><h2>آخر موقف لكل شركة</h2>${editBtn("add-status-here", "تسجيل موقف", "plus", "btn ghost sm")}</div>
          ${!links.length ? empty("co", "لا توجد شركات مرتبطة", "اربط الشركات أولًا من «نظرة عامة».") :
          `<table class="table cards"><thead><tr><th>الشركة</th><th>آخر موقف</th><th>الوضع</th><th>الإنجاز</th><th>العوائق</th></tr></thead><tbody>${latestBy.map(({ l, r }) => `
            <tr><td data-label="الشركة" class="title"><span class="company">${esc(l.companies.name)}</span><span class="sub">${esc(KIND[l.role])}</span></td>
              <td data-label="آخر موقف">${r ? date(r.report_date) : "—"}</td><td data-label="الوضع">${condPill(r?.condition)}</td>
              <td data-label="الإنجاز">${r ? progress(r.progress) : "—"}</td><td data-label="العوائق" class="scope">${esc(r?.obstacles) || "—"}</td></tr>`).join("")}</tbody></table>`}
          <p class="note">المواقف المسجلة على «المشروع ككل» تظهر في السجل أدناه. لتسجيل موقف شركة اختر الشركة في نموذج الموقف.</p>
        </section>
        <section class="panel"><div class="panel-head"><h2>سجل المواقف</h2>
          <select id="sco" aria-label="الشركة"><option value="">الكل</option><option value="general"${f.company === "general" ? " selected" : ""}>المشروع ككل</option>${links.map(l => `<option value="${l.company_id}"${f.company === l.company_id ? " selected" : ""}>${esc(l.companies.name)}</option>`).join("")}</select></div>
          ${list.length ? statusCards(list.slice(0, 30), { project: false }) + (list.length > 30 ? `<p class="note">معروض آخر ٣٠ موقفًا من ${nf.format(list.length)}. الكل في صفحة التقارير.</p>` : "") : empty("stat", "لا توجد مواقف", "سجّل الموقف من زر «تسجيل موقف».")}
        </section>`;
      Object.assign(actions, { _bind: () => { const s = $("#sco"); if (s) s.onchange = e => { f.company = e.target.value; route(); }; } });
    } else if (tab === "finance") {
      body = `<section class="panel"><div class="panel-head"><h2>الموقف المالي لكل شركة في المشروع</h2></div>
          ${links.length ? financeTable(fin) : empty("co", "لا توجد شركات مرتبطة", "اربط الشركات أولًا من «نظرة عامة».")}
          <p class="note">المعتمد = صافي المستخلصات المعتمدة والمصروفة. المتبقي من التعاقد = قيمة التعاقد − إجمالي أعمال المستخلصات المعتمدة. المستخلصات المرفوضة لا تُحتسب.</p></section>`;
    } else if (tab === "budget") {
      body = budgetTab(p, extra.budget);
    } else if (tab === "extracts") {
      body = `<section class="panel"><div class="panel-head"><h2>مستخلصات المشروع <small class="muted">(${nf.format(exts.length)})</small></h2>${links.length ? editBtn("add-extract-here", "تسجيل مستخلص", "plus", "btn ghost sm") : ""}</div>
        ${exts.length ? extractsTable(exts, { project: false }) : empty("ext", "لا توجد مستخلصات", links.length ? "سجّل مستخلصات الشركات من زر «تسجيل مستخلص»." : "اربط الشركات بالمشروع أولًا.")}</section>`;
    } else if (tab === "works") {
      const f = projectDetail.wf ||= { company: "" };
      if (f.pid !== id) { f.pid = id; f.company = ""; }
      body = worksTab(extra.works, links, f);
      Object.assign(actions, { _bind: () => { const s = $("#wco"); if (s) s.onchange = e => { f.company = e.target.value; route(); }; } });
    } else if (DOC_CATS[tab]) {
      body = docsTab(id, tab, extra.docs, links);
    } else if (tab === "equipment") {
      const eq = extra.eq;
      body = `<section class="panel"><div class="panel-head"><h2>المعدات بالمشروع <small class="muted">(${nf.format(eq.length)})</small></h2><a class="btn ghost sm" href="#/technical">الشؤون الفنية</a></div>
        ${!eq.length ? empty("tool", "لا توجد معدات بالمشروع", "تُسند المعدات للمشروع من صفحة الشؤون الفنية.") :
        `<table class="table cards"><thead><tr><th>المعدة</th><th>الكود</th><th>الحالة</th><th>آخر صيانة</th><th>الصيانة القادمة</th></tr></thead><tbody>${eq.map(e => {
          const m = (e.maintenance || []).sort((a, b) => b.done_on.localeCompare(a.done_on));
          return `<tr class="row-link" data-href="#/technical/eq/${e.id}" tabindex="0"><td data-label="المعدة" class="title"><span class="company">${esc(e.name)}</span><span class="sub">${esc(e.category)}</span></td>
            <td data-label="الكود" class="mono">${esc(e.code)}</td><td data-label="الحالة">${eqPill(e.status)}</td>
            <td data-label="آخر صيانة">${m[0] ? `${date(m[0].done_on)}<span class="sub">${esc(m[0].description)}</span>` : "—"}</td>
            <td data-label="الصيانة القادمة">${nextDuePill(m.map(x => x.next_due).filter(Boolean).sort()[0])}</td></tr>`; }).join("")}</tbody></table>`}</section>`;
    }

    view.innerHTML = head(p.name, `<span class="mono">${esc(p.code)}</span>${p.location ? `، ${esc(p.location)}` : ""}`, `<a class="btn ghost" href="#/reports" data-action="project-report">تقرير المشروع</a>` + editBtn("edit-project", "تعديل البيانات", "edit", "btn ghost")) + summary + tabs + body;
    if (curve) curve.bind(view);
    $(".ptabs a.on", view)?.scrollIntoView({ block: "nearest", inline: "center" });
    const docs = extra.docs || [];
    Object.assign(actions, {
      "edit-project": () => projectForm(p),
      "link-company": async () => {
        try {
          const all = await fetchAll(() => sb.from("companies").select("id,name,kind").order("name").order("id"));
          const linked = new Set(links.map(l => l.company_id));
          const free = all.filter(c => !linked.has(c.id));
          if (!free.length) { toast(all.length ? "كل الشركات المسجلة مرتبطة بهذا المشروع بالفعل." : "لا توجد شركات مسجلة. أضف الشركة أولًا من صفحة الشركات.", true); return; }
          linkForm(id, null, free);
        } catch (e) { toast(errText(e), true); }
      },
      "edit-link": el => linkForm(id, links[+el.dataset.i]),
      "add-extract-here": () => extractForm(null, { project_id: id }),
      "add-status-here": () => reportForm(null, { project_id: id }),
      "edit-status": el => reportForm(reps.find(r => r.id === el.dataset.id)),
      "project-report": () => { Object.assign(reportsPage.f ||= { status: "", estatus: "", from: "", to: "", mode: "latest", attention: false }, { type: "project", project: id }); location.hash = "#/reports"; },
      "add-doc": () => docForm(id, tab, links),
      "edit-doc": el => docForm(id, tab, links, docs.find(d => d.id === el.dataset.id)),
      "open-file": async el => {
        const d = docs.find(x => x.id === el.dataset.id);
        const w = window.open("", "_blank"); // لازم تتفتح مع الضغطة عشان المتصفح ما يمنعهاش
        try {
          // PDF والصور بتتعرض في المتصفح؛ باقي الأنواع (Word/Excel/PowerPoint) بتتنزل باسمها الأصلي
          const viewable = /pdf|^image\//.test(d.file_type || "");
          const url = await signedUrl(d.file_path, viewable ? undefined : d.file_name);
          if (w) w.location = url; else location.href = url;
        }
        catch (e) { w?.close(); toast("تعذّر فتح الملف.", true); }
      },
      "play-video": async el => {
        const d = docs.find(x => x.id === el.dataset.id), box = el.closest(".vid-box");
        el.disabled = true;
        try { const url = await signedUrl(d.file_path); box.innerHTML = `<video src="${esc(url)}" controls autoplay playsinline preload="metadata"></video>`; }
        catch { el.disabled = false; toast("تعذّر تشغيل الفيديو.", true); }
      },
      "add-budget": () => budgetForm(id),
      "edit-budget": el => budgetForm(id, extra.budget.find(b => b.id === el.dataset.id)),
      "add-work": () => workForm(id, links),
      "edit-work": el => workForm(id, links, extra.works.find(w => w.id === el.dataset.id)),
    });
    actions._bind?.();
  }

  /* =====================================================================
     الالتزامات والمؤتمرات
     ===================================================================== */
  const CKIND = { commitment: ["التزام", "blue"], conference: ["مؤتمر", "amber"], meeting: ["اجتماع", "gray"] };
  const CSTAT = { open: ["مفتوح", "blue"], done: ["تم", "green"], cancelled: ["ملغي", "dark"] };
  async function commitmentForm(c = null) {
    let projects = [];
    try { projects = await fetchAll(() => sb.from("projects").select("id,code,name").order("code")); } catch { /* اختياري */ }
    openForm({
      title: c ? "تعديل" : "إضافة التزام / مؤتمر",
      fields: [
        { name: "kind", label: "النوع", type: "select", options: opts(CKIND, c?.kind || "commitment") },
        { name: "status", label: "الحالة", type: "select", options: opts(CSTAT, c?.status || "open") },
        { name: "title", label: "الموضوع", required: true, maxlength: 300, wide: true },
        { name: "due_date", label: "التاريخ / الموعد النهائي", type: "date", required: true },
        { name: "due_time", label: "الساعة (اختياري)", type: "time" },
        { name: "project_id", label: "المشروع (اختياري)", type: "select", wide: true, options: `<option value="">عام — غير مرتبط بمشروع</option>` + projects.map(p => `<option value="${p.id}"${p.id === c?.project_id ? " selected" : ""}>${esc(p.code)} — ${esc(p.name)}</option>`).join("") },
        { name: "location", label: "المكان", maxlength: 200 },
        { name: "responsible", label: "المسؤول", maxlength: 200 },
        { name: "notes", label: "ملاحظات / مخرجات", type: "textarea", wide: true, maxlength: 3000 },
      ], data: c ? { ...c, due_time: c.due_time?.slice(0, 5) } : { due_date: today() }, submitLabel: c ? "حفظ" : "إضافة",
      onSubmit: async v => {
        v.project_id = v.project_id || null; v.due_time = v.due_time || null;
        await q(c ? sb.from("commitments").update(v).eq("id", c.id) : sb.from("commitments").insert(v));
        toast("تم الحفظ."); route();
      },
      danger: c && ctx.isAdmin ? { label: "حذف", confirm: `حذف «${c.title}»؟`, run: async () => { await q(sb.from("commitments").delete().eq("id", c.id)); toast("تم الحذف."); route(); } } : null,
    });
  }
  async function commitmentsPage() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / الالتزامات والمؤتمرات`;
    loading();
    let rows;
    try { rows = await fetchAll(() => sb.from("commitments").select("*, projects(code,name)").order("due_date").order("due_time").order("id")); }
    catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = commitmentsPage.f ||= { kind: "" };
    const t = today(), week = new Date(Date.now() + 7 * 864e5).toLocaleDateString("en-CA");
    const list = rows.filter(r => !f.kind || r.kind === f.kind);
    const groups = [
      ["متأخرة", "red", list.filter(r => r.status === "open" && r.due_date < t)],
      ["اليوم وخلال ٧ أيام", "amber", list.filter(r => r.status === "open" && r.due_date >= t && r.due_date <= week)],
      ["القادمة", "blue", list.filter(r => r.status === "open" && r.due_date > week)],
      ["منتهية / ملغاة", "gray", list.filter(r => r.status !== "open").reverse()],
    ];
    const card = r => `<article class="cm ${r.status === "open" && r.due_date < t ? "late" : r.status}">
        <div class="cm-date"><b>${new Date(r.due_date + "T00:00:00").toLocaleDateString("ar-EG", { day: "numeric" })}</b><span>${new Date(r.due_date + "T00:00:00").toLocaleDateString("ar-EG", { month: "short" })}</span>${r.due_time ? `<small>${esc(r.due_time.slice(0, 5))}</small>` : ""}</div>
        <div class="cm-body"><div><span class="pill ${CKIND[r.kind][1]}">${CKIND[r.kind][0]}</span>${r.status !== "open" ? ` <span class="pill ${CSTAT[r.status][1]}">${CSTAT[r.status][0]}</span>` : ""}</div>
          <b>${esc(r.title)}</b>
          <span class="sub">${[r.projects && `${r.projects.code} — ${r.projects.name}`, r.location, r.responsible && `المسؤول: ${r.responsible}`].filter(Boolean).map(esc).join("، ")}</span>
          ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}</div>
        ${ctx.canEdit ? `<div class="cm-act">${r.status === "open" ? `<button class="btn ghost sm" data-action="cm-done" data-id="${r.id}">تم</button>` : ""}<button class="icon-btn" data-action="cm-edit" data-id="${r.id}" aria-label="تعديل">${svg(ICON.edit)}</button></div>` : ""}
      </article>`;
    view.innerHTML = head("الالتزامات والمؤتمرات", "المواعيد والالتزامات والمؤتمرات والاجتماعات، مرتبة حسب الموعد.", editBtn("cm-add", "إضافة")) +
      `<section class="panel"><div class="filters"><select id="ck" aria-label="النوع"><option value="">كل الأنواع</option>${opts(CKIND, f.kind)}</select><span class="count">${nf.format(list.filter(r => r.status === "open").length)} مفتوح</span></div>
      ${!rows.length ? empty("stat", "لا توجد التزامات أو مؤتمرات", "أضفها من زر «إضافة».") :
        groups.filter(g => g[2].length).map(([title, color, items]) => `<h3 class="cm-h"><span class="pill ${color}">${nf.format(items.length)}</span> ${title}</h3><div class="cm-list">${items.map(card).join("")}</div>`).join("")}</section>`;
    $("#ck").onchange = e => { f.kind = e.target.value; route(); };
    Object.assign(actions, {
      "cm-add": () => commitmentForm(),
      "cm-edit": el => commitmentForm(rows.find(r => r.id === el.dataset.id)),
      "cm-done": async el => { el.disabled = true; try { await q(sb.from("commitments").update({ status: "done" }).eq("id", el.dataset.id)); toast("تم."); route(); } catch (e) { toast(errText(e), true); el.disabled = false; } },
    });
  }

  /* =====================================================================
     الشؤون الفنية: المعدات، الصيانة، قطع الغيار
     ===================================================================== */
  async function equipmentForm(e = null) {
    let projects = [];
    try { projects = await fetchAll(() => sb.from("projects").select("id,code,name").order("code")); } catch { /* اختياري */ }
    openForm({
      title: e ? "تعديل بيانات المعدة" : "إضافة معدة",
      fields: [
        { name: "code", label: "كود المعدة", required: true, maxlength: 40 },
        { name: "name", label: "المعدة", required: true, maxlength: 120, hint: "لودر، جريدر، هراس…" },
        { name: "category", label: "الفئة", maxlength: 80 },
        { name: "plate_no", label: "رقم اللوحة / الشاسيه", maxlength: 60 },
        { name: "project_id", label: "الموقع الحالي (المشروع)", type: "select", wide: true, options: `<option value="">بالمخازن / غير مخصصة</option>` + projects.map(p => `<option value="${p.id}"${p.id === e?.project_id ? " selected" : ""}>${esc(p.code)} — ${esc(p.name)}</option>`).join("") },
        { name: "status", label: "الحالة", type: "select", options: opts(EQ_STATUS, e?.status || "working") },
        { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 2000 },
      ], data: e || {}, submitLabel: e ? "حفظ" : "إضافة",
      onSubmit: async v => { v.project_id = v.project_id || null; await q(e ? sb.from("equipment").update(v).eq("id", e.id) : sb.from("equipment").insert(v)); toast("تم الحفظ."); route(); },
      danger: e && ctx.isAdmin ? { label: "حذف المعدة", confirm: `حذف المعدة «${e.name} ${e.code}» وسجل صيانتها؟`, run: async () => { await q(sb.from("equipment").delete().eq("id", e.id)); toast("تم الحذف."); location.hash = "#/technical"; } } : null,
    });
  }
  function maintenanceForm(eqId, m = null) {
    openForm({
      title: m ? "تعديل سجل صيانة" : "تسجيل صيانة",
      fields: [
        { name: "done_on", label: "تاريخ الصيانة", type: "date", required: true },
        { name: "kind", label: "النوع", type: "select", options: opts({ periodic: "دورية", repair: "إصلاح عطل" }, m?.kind || "periodic") },
        { name: "description", label: "الأعمال المنفذة", type: "textarea", wide: true, required: true, maxlength: 1000 },
        { name: "cost", label: "التكلفة (ج.م)", type: "number", min: 0, step: "0.01" },
        { name: "next_due", label: "موعد الصيانة القادمة", type: "date" },
      ], data: m || { done_on: today() }, submitLabel: m ? "حفظ" : "تسجيل",
      onSubmit: async v => { v.cost = v.cost ?? 0; await q(m ? sb.from("maintenance").update(v).eq("id", m.id) : sb.from("maintenance").insert({ ...v, equipment_id: eqId })); toast("تم الحفظ."); route(); },
      danger: m && ctx.isAdmin ? { label: "حذف", confirm: "حذف سجل الصيانة؟", run: async () => { await q(sb.from("maintenance").delete().eq("id", m.id)); toast("تم الحذف."); route(); } } : null,
    });
  }
  function partForm(pt = null) {
    openForm({
      title: pt ? "تعديل الصنف" : "إضافة صنف قطع غيار",
      fields: [
        { name: "code", label: "كود الصنف", required: true, maxlength: 40 },
        { name: "name", label: "اسم الصنف", required: true, maxlength: 150 },
        { name: "unit", label: "الوحدة", maxlength: 20, value: "قطعة" },
        { name: "min_qty", label: "حد إعادة الطلب", type: "number", min: 0, step: "0.01", hint: "يظهر تنبيه لو الرصيد أقل منه." },
        { name: "warehouse", label: "المخزن", maxlength: 100, value: "المخزن الرئيسي" },
        ...(pt ? [] : [{ name: "qty", label: "الرصيد الافتتاحي", type: "number", min: 0, step: "0.01" }]),
        { name: "notes", label: "ملاحظات", type: "textarea", wide: true, maxlength: 1000 },
      ], data: pt || {}, submitLabel: pt ? "حفظ" : "إضافة",
      onSubmit: async v => { v.min_qty = v.min_qty ?? 0; if (!pt) v.qty = v.qty ?? 0; await q(pt ? sb.from("spare_parts").update(v).eq("id", pt.id) : sb.from("spare_parts").insert(v)); toast("تم الحفظ."); route(); },
      danger: pt && ctx.isAdmin ? { label: "حذف الصنف", confirm: `حذف الصنف «${pt.name}» وحركته؟`, run: async () => { await q(sb.from("spare_parts").delete().eq("id", pt.id)); toast("تم الحذف."); route(); } } : null,
    });
  }
  function movementForm(pt, dir, equipment) {
    openForm({
      title: `${dir === "in" ? "وارد" : "صرف"}: ${pt.name}`,
      fields: [
        { name: "qty", label: `الكمية (${pt.unit})`, type: "number", required: true, min: 0.01, step: "0.01", hint: dir === "out" ? `الرصيد الحالي: ${nf.format(Number(pt.qty))}` : "" },
        { name: "moved_on", label: "التاريخ", type: "date", required: true },
        ...(dir === "out" ? [{ name: "equipment_id", label: "لصالح معدة (اختياري)", type: "select", wide: true, options: `<option value="">—</option>` + equipment.map(e => `<option value="${e.id}">${esc(e.code)} — ${esc(e.name)}</option>`).join("") }] : []),
        { name: "note", label: "ملاحظة", maxlength: 300, wide: true },
      ], data: { moved_on: today() }, submitLabel: dir === "in" ? "تسجيل الوارد" : "تسجيل الصرف",
      onSubmit: async v => {
        if (dir === "out" && v.qty > Number(pt.qty)) throw Object.assign(new Error(), { userMsg: "الكمية أكبر من الرصيد المتاح." });
        await q(sb.from("part_movements").insert({ part_id: pt.id, moved_on: v.moved_on, qty: dir === "in" ? v.qty : -v.qty, equipment_id: v.equipment_id || null, note: v.note }));
        toast(dir === "in" ? "تم تسجيل الوارد." : "تم تسجيل الصرف."); route();
      },
    });
  }
  const TTABS = [["equipment", "المعدات"], ["maintenance", "الصيانة"], ["parts", "مخازن قطع الغيار"]];
  async function technicalPage(sub = "equipment", eqId = null) {
    const my = seq;
    if (sub === "eq" && eqId) return equipmentDetail(eqId);
    if (!TTABS.some(t => t[0] === sub)) sub = "equipment";
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / الشؤون الفنية`;
    loading();
    let eq, maint, parts, moves;
    try {
      [eq, maint, parts, moves] = await Promise.all([
        fetchAll(() => sb.from("equipment").select("*, projects(code,name)").order("code")),
        fetchAll(() => sb.from("maintenance").select("*, equipment(code,name)").order("done_on", { ascending: false }).order("id")),
        fetchAll(() => sb.from("spare_parts").select("*").order("code")),
        sub === "parts" ? q(sb.from("part_movements").select("*, spare_parts(name,unit), equipment(code,name)").order("moved_on", { ascending: false }).order("created_at", { ascending: false }).limit(40)) : [],
      ]);
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    // آخر موعد قادم لكل معدة = من آخر سجل صيانة
    const lastM = {}; maint.forEach(m => { if (!lastM[m.equipment_id]) lastM[m.equipment_id] = m; });
    const due = id => lastM[id]?.next_due;
    const overdue = eq.filter(e => due(e.id) && due(e.id) < today()).length;
    const low = parts.filter(p => Number(p.qty) < Number(p.min_qty)).length;
    const cnt = s => eq.filter(e => e.status === s).length;
    const kpis = `<section class="kpis">
        <div class="kpi"><span>إجمالي المعدات</span><b>${nf.format(eq.length)}</b><small>${nf.format(cnt("working"))} تعمل</small></div>
        <div class="kpi"><span>في الصيانة / معطلة</span><b class="${cnt("broken") ? "neg" : ""}">${nf.format(cnt("maintenance") + cnt("broken"))}</b><small>${nf.format(cnt("broken"))} معطلة</small></div>
        <div class="kpi"><span>صيانات دورية متأخرة</span><b class="${overdue ? "neg" : ""}">${nf.format(overdue)}</b></div>
        <div class="kpi"><span>أصناف تحت حد الطلب</span><b class="${low ? "neg" : ""}">${nf.format(low)}</b><small>من ${nf.format(parts.length)} صنف</small></div>
      </section>`;
    const tabs = `<nav class="ptabs">${TTABS.map(([k, l]) => `<a href="#/technical/${k}"${k === sub ? ' class="on" aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
    let body = "";
    if (sub === "equipment") {
      const f = technicalPage.f ||= { project: "", status: "" };
      const projects = [...new Map(eq.filter(e => e.project_id).map(e => [e.project_id, e.projects])).entries()];
      const list = eq.filter(e => (!f.status || e.status === f.status) && (!f.project || (f.project === "none" ? !e.project_id : e.project_id === f.project)));
      body = `<section class="panel"><div class="panel-head"><h2>المعدات</h2>${editBtn("eq-add", "إضافة معدة", "plus", "btn ghost sm")}</div>
        <div class="filters"><select id="tp" aria-label="الموقع"><option value="">كل المواقع</option><option value="none"${f.project === "none" ? " selected" : ""}>بالمخازن / غير مخصصة</option>${projects.map(([id, p]) => `<option value="${id}"${f.project === id ? " selected" : ""}>${esc(p.code)} — ${esc(p.name)}</option>`).join("")}</select>
          <select id="ts" aria-label="الحالة"><option value="">كل الحالات</option>${opts(EQ_STATUS, f.status)}</select><span class="count">${nf.format(list.length)} من ${nf.format(eq.length)}</span></div>
        ${!list.length ? empty("tool", "لا توجد معدات", "أضف المعدات من زر «إضافة معدة».") :
        `<table class="table cards"><thead><tr><th>المعدة</th><th>الكود</th><th>اللوحة</th><th>الموقع</th><th>الحالة</th><th>الصيانة القادمة</th></tr></thead><tbody>${list.map(e => `
          <tr class="row-link" data-href="#/technical/eq/${e.id}" tabindex="0"><td data-label="المعدة" class="title"><span class="company">${esc(e.name)}</span><span class="sub">${esc(e.category)}</span></td>
            <td data-label="الكود" class="mono">${esc(e.code)}</td><td data-label="اللوحة" class="mono">${esc(e.plate_no) || "—"}</td>
            <td data-label="الموقع">${e.projects ? `<span class="mono">${esc(e.projects.code)}</span><span class="sub">${esc(e.projects.name)}</span>` : "بالمخازن"}</td>
            <td data-label="الحالة">${eqPill(e.status)}</td><td data-label="الصيانة القادمة">${nextDuePill(due(e.id))}</td></tr>`).join("")}</tbody></table>`}</section>`;
      Object.assign(actions, { _bind: () => { $("#tp").onchange = e => { f.project = e.target.value; route(); }; $("#ts").onchange = e => { f.status = e.target.value; route(); }; } });
    } else if (sub === "maintenance") {
      const upcoming = eq.filter(e => due(e.id)).map(e => ({ e, d: due(e.id) })).sort((a, b) => a.d.localeCompare(b.d));
      body = `<section class="panel"><div class="panel-head"><h2>مواعيد الصيانة القادمة</h2></div>
          ${!upcoming.length ? empty("tool", "لا توجد مواعيد", "تُسجَّل مع كل صيانة.") :
          `<table class="table cards"><thead><tr><th>المعدة</th><th>الموقع</th><th>الموعد</th></tr></thead><tbody>${upcoming.map(({ e, d }) => `
            <tr class="row-link" data-href="#/technical/eq/${e.id}" tabindex="0"><td data-label="المعدة" class="title"><span class="company">${esc(e.name)} <span class="mono">${esc(e.code)}</span></span></td>
              <td data-label="الموقع">${e.projects ? esc(e.projects.code) : "بالمخازن"}</td><td data-label="الموعد">${nextDuePill(d)}</td></tr>`).join("")}</tbody></table>`}</section>
        <section class="panel"><div class="panel-head"><h2>سجل الصيانة</h2></div>
          ${!maint.length ? empty("tool", "لا توجد سجلات صيانة", "سجّل الصيانة من صفحة المعدة.") :
          `<table class="table cards"><thead><tr><th>المعدة</th><th>التاريخ</th><th>النوع</th><th>الأعمال</th><th>التكلفة</th></tr></thead><tbody>${maint.slice(0, 60).map(m => `
            <tr class="row-link" data-href="#/technical/eq/${m.equipment_id}" tabindex="0"><td data-label="المعدة" class="title"><span class="company">${esc(m.equipment?.name)} <span class="mono">${esc(m.equipment?.code)}</span></span></td>
              <td data-label="التاريخ">${date(m.done_on)}</td><td data-label="النوع"><span class="pill ${m.kind === "repair" ? "amber" : "gray"}">${m.kind === "repair" ? "إصلاح" : "دورية"}</span></td>
              <td data-label="الأعمال" class="scope">${esc(m.description)}</td><td data-label="التكلفة" class="num">${money(m.cost)}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td colspan="4">إجمالي تكلفة الصيانة</td><td class="num">${money(maint.reduce((s, m) => s + Number(m.cost), 0))}</td></tr></tfoot></table>`}</section>`;
    } else {
      body = `<section class="panel"><div class="panel-head"><h2>أرصدة قطع الغيار</h2>${editBtn("pt-add", "إضافة صنف", "plus", "btn ghost sm")}</div>
          ${!parts.length ? empty("tool", "لا توجد أصناف", "أضف أصناف قطع الغيار وأرصدتها.") :
          `<table class="table cards"><thead><tr><th>الصنف</th><th>الكود</th><th>المخزن</th><th>الرصيد</th><th>حد الطلب</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${parts.map(pt => `
            <tr${Number(pt.qty) < Number(pt.min_qty) ? ' class="low"' : ""}><td data-label="الصنف" class="title"><span class="company">${esc(pt.name)}</span>${Number(pt.qty) < Number(pt.min_qty) ? `<span class="pill red">تحت حد الطلب</span>` : ""}</td>
              <td data-label="الكود" class="mono">${esc(pt.code)}</td><td data-label="المخزن">${esc(pt.warehouse)}</td>
              <td data-label="الرصيد" class="num"><b>${nf.format(Number(pt.qty))}</b> ${esc(pt.unit)}</td><td data-label="حد الطلب" class="num">${nf.format(Number(pt.min_qty))}</td>
              ${ctx.canEdit ? `<td class="act wide-act"><button class="btn ghost sm" data-action="pt-in" data-id="${pt.id}">وارد</button><button class="btn ghost sm" data-action="pt-out" data-id="${pt.id}">صرف</button><button class="icon-btn" data-action="pt-edit" data-id="${pt.id}" aria-label="تعديل">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody></table>`}</section>
        <section class="panel"><div class="panel-head"><h2>آخر حركات المخزن</h2></div>
          ${!moves.length ? empty("tool", "لا توجد حركات", "سجّل الوارد والصرف من أزرار الصنف.") :
          `<table class="table cards"><thead><tr><th>الصنف</th><th>التاريخ</th><th>الحركة</th><th>المعدة</th><th>ملاحظة</th></tr></thead><tbody>${moves.map(m => `
            <tr><td data-label="الصنف" class="title"><span class="company">${esc(m.spare_parts?.name)}</span></td><td data-label="التاريخ">${date(m.moved_on)}</td>
              <td data-label="الحركة"><span class="pill ${m.qty > 0 ? "green" : "amber"}">${m.qty > 0 ? "وارد" : "صرف"} ${nf.format(Math.abs(m.qty))} ${esc(m.spare_parts?.unit || "")}</span></td>
              <td data-label="المعدة">${m.equipment ? `${esc(m.equipment.name)} <span class="mono">${esc(m.equipment.code)}</span>` : "—"}</td><td data-label="ملاحظة">${esc(m.note) || "—"}</td></tr>`).join("")}</tbody></table>`}</section>`;
    }
    view.innerHTML = head("الشؤون الفنية", "موقف المعدات بكل مشروع، والصيانة، ومخازن قطع الغيار.") + kpis + tabs + body;
    Object.assign(actions, {
      "eq-add": () => equipmentForm(),
      "pt-add": () => partForm(),
      "pt-edit": el => partForm(parts.find(p => p.id === el.dataset.id)),
      "pt-in": el => movementForm(parts.find(p => p.id === el.dataset.id), "in", eq),
      "pt-out": el => movementForm(parts.find(p => p.id === el.dataset.id), "out", eq),
    });
    actions._bind?.();
  }
  async function equipmentDetail(id) {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/technical">الشؤون الفنية</a> / …`;
    loading();
    let e, maint, moves;
    try {
      [e, maint, moves] = await Promise.all([
        q(sb.from("equipment").select("*, projects(code,name)").eq("id", id).maybeSingle()),
        q(sb.from("maintenance").select("*").eq("equipment_id", id).order("done_on", { ascending: false })),
        q(sb.from("part_movements").select("*, spare_parts(name,unit)").eq("equipment_id", id).order("moved_on", { ascending: false })),
      ]);
    } catch (err) { return my === seq && failed(err); }
    if (my !== seq) return;
    if (!e) { view.innerHTML = `<div class="panel">${empty("tool", "المعدة غير موجودة", "ربما حُذفت.")}</div>`; return; }
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/technical">الشؤون الفنية</a> / <b>${esc(e.code)}</b>`;
    view.innerHTML = head(`${e.name} — ${e.code}`, esc(e.category), editBtn("eq-edit", "تعديل البيانات", "edit", "btn ghost")) +
      `<section class="info panel">
        <div><span>الحالة</span>${eqPill(e.status)}</div>
        <div><span>الموقع الحالي</span><b>${e.projects ? `<a href="#/projects/${e.project_id}/equipment">${esc(e.projects.code)} — ${esc(e.projects.name)}</a>` : "بالمخازن / غير مخصصة"}</b></div>
        <div><span>رقم اللوحة</span><b class="mono">${esc(e.plate_no) || "—"}</b></div>
        <div><span>الصيانة القادمة</span>${nextDuePill(maint[0]?.next_due)}</div>
        <div><span>تكلفة الصيانة الإجمالية</span><b>${money(maint.reduce((s, m) => s + Number(m.cost), 0))}</b></div>
        ${e.notes ? `<div class="wide"><span>ملاحظات</span><p>${esc(e.notes)}</p></div>` : ""}
      </section>
      <section class="panel"><div class="panel-head"><h2>سجل الصيانة</h2>${editBtn("m-add", "تسجيل صيانة", "plus", "btn ghost sm")}</div>
        ${!maint.length ? empty("tool", "لا توجد سجلات", "سجّل الصيانة من الزر.") :
        `<table class="table cards"><thead><tr><th>التاريخ</th><th>النوع</th><th>الأعمال</th><th>التكلفة</th><th>الصيانة القادمة</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${maint.map(m => `
          <tr><td data-label="التاريخ" class="title">${date(m.done_on)}</td><td data-label="النوع"><span class="pill ${m.kind === "repair" ? "amber" : "gray"}">${m.kind === "repair" ? "إصلاح" : "دورية"}</span></td>
            <td data-label="الأعمال" class="scope">${esc(m.description)}</td><td data-label="التكلفة" class="num">${money(m.cost)}</td><td data-label="الصيانة القادمة">${date(m.next_due)}</td>
            ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="m-edit" data-id="${m.id}" aria-label="تعديل">${svg(ICON.edit)}</button></td>` : ""}</tr>`).join("")}</tbody></table>`}</section>
      <section class="panel"><div class="panel-head"><h2>قطع الغيار المنصرفة للمعدة</h2></div>
        ${!moves.length ? empty("tool", "لا توجد", "تُسجَّل من مخازن قطع الغيار ← صرف.") :
        `<table class="table cards"><thead><tr><th>الصنف</th><th>التاريخ</th><th>الكمية</th><th>ملاحظة</th></tr></thead><tbody>${moves.map(m => `
          <tr><td data-label="الصنف" class="title">${esc(m.spare_parts?.name)}</td><td data-label="التاريخ">${date(m.moved_on)}</td><td data-label="الكمية">${nf.format(Math.abs(m.qty))} ${esc(m.spare_parts?.unit || "")}</td><td data-label="ملاحظة">${esc(m.note) || "—"}</td></tr>`).join("")}</tbody></table>`}</section>`;
    Object.assign(actions, {
      "eq-edit": () => equipmentForm(e),
      "m-add": () => maintenanceForm(id),
      "m-edit": el => maintenanceForm(id, maint.find(m => m.id === el.dataset.id)),
    });
  }

  async function companiesList() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / الشركات`;
    loading();
    let rows;
    let links = [], exts = [];
    try {
      [rows, links, exts] = await Promise.all([
        fetchAll(() => sb.from("companies_overview").select("*").order("name").order("id")),
        fetchAll(() => sb.from("project_companies").select("company_id,contract_value").order("project_id").order("company_id")),
        fetchAll(() => sb.from("extracts").select("company_id,status,net_amount").neq("status", "rejected").order("id")),
      ]);
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const fin = {};
    const F = id => fin[id] ||= { contract: 0, approved: 0, paid: 0 };
    links.forEach(l => F(l.company_id).contract += Number(l.contract_value) || 0);
    exts.forEach(e => { if (e.status === "approved" || e.status === "paid") F(e.company_id).approved += Number(e.net_amount); if (e.status === "paid") F(e.company_id).paid += Number(e.net_amount); });
    const f = companiesList.f ||= { text: "", kind: "" };
    view.innerHTML = head("الشركات", "الشركات المنفذة والمقاولون والموردون، وموقفها المالي المجمّع من كل المشروعات.", editBtn("add-company", "إضافة شركة")) +
      `<section class="panel">
        <div class="filters">
          <label class="search">${svg(ICON.search)}<input type="search" id="q" placeholder="بحث باسم الشركة أو السجل التجاري" value="${esc(f.text)}" /></label>
          <select id="kd" aria-label="التصنيف"><option value="">كل التصنيفات</option>${opts(KIND, f.kind)}</select>
          <span class="count" id="cnt"></span>
        </div>
        <div id="list"></div>
      </section>`;
    const draw = () => {
      const t = f.text.trim().toLowerCase();
      const list = rows.filter(r => (!f.kind || r.kind === f.kind) && (!t || [r.name, r.commercial_register].some(x => (x || "").toLowerCase().includes(t))));
      $("#cnt").textContent = rows.length ? `${nf.format(list.length)} من ${nf.format(rows.length)}` : "";
      $("#list").innerHTML = !rows.length ? empty("co", "لا توجد شركات مسجلة", ctx.canEdit ? "أضف الشركات المنفذة والموردين من زر «إضافة شركة»." : "ستظهر الشركات هنا بعد أن يضيفها المسؤول عن الإدخال.")
        : !list.length ? empty("search", "لا توجد نتائج", "غيّر كلمات البحث أو التصنيف المختار.")
        : `<table class="table cards"><thead><tr><th>الشركة</th><th>التصنيف</th><th>المشروعات</th><th>إجمالي التعاقدات</th><th>المعتمد</th><th>المصروف</th></tr></thead><tbody>${list.map(r => `
          <tr class="row-link" data-href="#/companies/${r.id}" tabindex="0">
            <td data-label="الشركة" class="title"><span class="company">${esc(r.name)}</span>${r.address ? `<span class="sub">${esc(r.address)}</span>` : ""}</td>
            <td data-label="التصنيف">${esc(KIND[r.kind])}</td>
            <td data-label="المشروعات">${nf.format(r.projects_count)}</td>
            <td data-label="إجمالي التعاقدات" class="num">${fin[r.id]?.contract ? money(fin[r.id].contract) : "—"}</td>
            <td data-label="المعتمد" class="num">${fin[r.id]?.approved ? money(fin[r.id].approved) : "—"}</td>
            <td data-label="المصروف" class="num">${fin[r.id]?.paid ? money(fin[r.id].paid) : "—"}</td>
          </tr>`).join("")}</tbody></table>`;
    };
    $("#q").oninput = e => { f.text = e.target.value; draw(); };
    $("#kd").onchange = e => { f.kind = e.target.value; draw(); };
    draw();
  }

  async function companyDetail(id) {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/companies">الشركات</a> / …`;
    loading();
    let c, links, exts;
    try {
      [c, links, exts] = await Promise.all([
        q(sb.from("companies").select("*").eq("id", id).maybeSingle()),
        q(sb.from("project_companies").select("*, projects(id,code,name,status,progress)").eq("company_id", id)),
        fetchAll(() => sb.from("extracts_overview").select("*").eq("company_id", id).order("submitted_on", { ascending: false }).order("number", { ascending: false }).order("id")),
      ]);
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    if (!c) { view.innerHTML = `<div class="panel">${empty("co", "الشركة غير موجودة", "ربما حُذفت. ارجع لقائمة الشركات.")}</div>`; return; }
    links.sort((a, b) => a.projects.code.localeCompare(b.projects.code, "ar"));
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/companies">الشركات</a> / <b>${esc(c.name)}</b>`;
    view.innerHTML = head(c.name, esc(KIND[c.kind]), editBtn("edit-company", "تعديل البيانات", "edit", "btn ghost")) +
      `<section class="info panel">
        <div><span>التصنيف</span><b>${esc(KIND[c.kind])}</b></div>
        <div><span>السجل التجاري</span><b class="mono">${esc(c.commercial_register) || "—"}</b></div>
        <div><span>الهاتف</span><b class="mono" dir="ltr">${esc(c.phone) || "—"}</b></div>
        <div><span>عدد المشروعات</span><b>${nf.format(links.length)}</b></div>
        ${c.address ? `<div class="wide"><span>العنوان</span><p>${esc(c.address)}</p></div>` : ""}
        ${c.notes ? `<div class="wide"><span>ملاحظات</span><p>${esc(c.notes)}</p></div>` : ""}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>الموقف المالي المجمّع (كل المشروعات مع الكتيبة)</h2></div>
        ${links.length ? financeTable(links.map(l => companyFinance([{ ...l, companies: { name: c.name } }], exts.filter(x => x.project_id === l.project_id))[0]), { firstLabel: "المشروع", first: r => `<a class="company" href="#/projects/${r.l.project_id}/finance">${esc(r.l.projects.name)}</a><span class="sub mono">${esc(r.l.projects.code)}، ${esc(KIND[r.l.role])}</span>` }) : empty("proj", "غير مرتبطة بأي مشروع", "يتم الربط من صفحة المشروع.")}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>المشروعات التي تعمل بها الشركة</h2></div>
        ${!links.length ? empty("proj", "غير مرتبطة بأي مشروع", "يتم الربط من صفحة المشروع ← «ربط شركة».") :
        `<table class="table cards"><thead><tr><th>المشروع</th><th>الدور</th><th>الحالة</th><th>الإنجاز</th><th>قيمة التعاقد</th></tr></thead><tbody>${links.map(l => `
          <tr class="row-link" data-href="#/projects/${l.project_id}" tabindex="0">
            <td data-label="المشروع" class="title"><span class="company">${esc(l.projects.name)}</span><span class="sub mono">${esc(l.projects.code)}</span></td>
            <td data-label="الدور">${esc(KIND[l.role])}</td>
            <td data-label="الحالة">${pill(l.projects.status)}</td>
            <td data-label="الإنجاز">${progress(l.projects.progress)}</td>
            <td data-label="قيمة التعاقد">${money(l.contract_value)}</td>
          </tr>`).join("")}</tbody></table>`}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>مستخلصات الشركة</h2>${links.length ? editBtn("add-extract-here", "تسجيل مستخلص", "plus", "btn ghost sm") : ""}</div>
        ${exts.length ? extractsTable(exts, { company: false }) : empty("ext", "لا توجد مستخلصات", "لم تُسجَّل مستخلصات لهذه الشركة بعد.")}
      </section>`;
    Object.assign(actions, { "edit-company": () => companyForm(c), "add-extract-here": () => extractForm(null, { company_id: id }) });
  }

  async function extractsList() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / المستخلصات`;
    loading();
    let rows;
    try { rows = await fetchAll(() => sb.from("extracts_overview").select("*").order("submitted_on", { ascending: false }).order("created_at", { ascending: false }).order("id")); }
    catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = extractsList.f ||= { text: "", status: "open", project: "" };
    const projects = [...new Map(rows.map(r => [r.project_id, r])).values()].sort((a, b) => a.project_code.localeCompare(b.project_code, "ar"));
    if (f.project && !projects.some(p => p.project_id === f.project)) f.project = "";
    view.innerHTML = head("المستخلصات", "مستخلصات الشركات في كل المشروعات وحالة مراجعتها.", editBtn("add-extract", "تسجيل مستخلص")) +
      `<section class="panel">
        <div class="filters">
          <label class="search">${svg(ICON.search)}<input type="search" id="q" placeholder="بحث باسم الشركة أو المشروع أو رقم المستخلص" value="${esc(f.text)}" /></label>
          <select id="st" aria-label="الحالة">
            <option value="">كل الحالات</option><option value="open"${f.status === "open" ? " selected" : ""}>تحت المتابعة</option>${opts(EXT_STATUS, f.status)}
          </select>
          <select id="pj" aria-label="المشروع"><option value="">كل المشروعات</option>${projects.map(p => `<option value="${p.project_id}"${p.project_id === f.project ? " selected" : ""}>${esc(p.project_code)} — ${esc(p.project_name)}</option>`).join("")}</select>
          <span class="count" id="cnt"></span>
        </div>
        <div id="list"></div>
      </section>`;
    const draw = () => {
      const t = f.text.trim().toLowerCase();
      const okStatus = r => !f.status || (f.status === "open" ? EXT_OPEN.includes(r.status) : r.status === f.status);
      const list = rows.filter(r => okStatus(r) && (!f.project || r.project_id === f.project)
        && (!t || [r.company_name, r.project_name, r.project_code, String(r.number)].some(x => (x || "").toLowerCase().includes(t))));
      $("#cnt").textContent = rows.length ? `${nf.format(list.length)} من ${nf.format(rows.length)}` : "";
      $("#list").innerHTML = !rows.length ? empty("ext", "لا توجد مستخلصات مسجلة", ctx.canEdit ? "سجّل أول مستخلص من زر «تسجيل مستخلص». يجب أن تكون الشركة مرتبطة بالمشروع أولًا." : "ستظهر المستخلصات هنا بعد تسجيلها.")
        : !list.length ? empty("search", "لا توجد نتائج", f.status === "open" ? "لا توجد مستخلصات تحت المتابعة. اختر «كل الحالات» لعرض الباقي." : "غيّر البحث أو الفلاتر المختارة.")
        : extractsTable(list);
    };
    $("#q").oninput = e => { f.text = e.target.value; draw(); };
    $("#st").onchange = e => { f.status = e.target.value; draw(); };
    $("#pj").onchange = e => { f.project = e.target.value; draw(); };
    draw();
  }

  async function extractDetail(id) {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/extracts">المستخلصات</a> / …`;
    loading();
    let e, events, names = {};
    try {
      [e, events] = await Promise.all([
        q(sb.from("extracts_overview").select("*").eq("id", id).maybeSingle()),
        q(sb.from("extract_events").select("*").eq("extract_id", id).order("created_at", { ascending: false })),
      ]);
      const ids = [...new Set(events.map(v => v.created_by).filter(Boolean))];
      if (ids.length) (await q(sb.from("profiles").select("id,name").in("id", ids))).forEach(p => names[p.id] = p.name);
    } catch (err) { return my === seq && failed(err); }
    if (my !== seq) return;
    if (!e) { view.innerHTML = `<div class="panel">${empty("ext", "المستخلص غير موجود", "ربما حُذف. ارجع لقائمة المستخلصات.")}</div>`; return; }
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/extracts">المستخلصات</a> / <b>${esc(e.company_name)} — مستخلص ${nf.format(e.number)}</b>`;
    const next = ctx.canEdit ? EXT_NEXT[e.status] : [];
    const stepBtns = next.map(s => `<button class="btn ${s === "rejected" || s === "needs_completion" ? "ghost" : "primary"}" data-action="status" data-to="${s}">${esc(EXT_ACTION[s])}</button>`).join("");
    const time = v => new Date(v).toLocaleString("ar-EG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
    view.innerHTML = head(extNo(e), `<a href="#/companies/${e.company_id}">${esc(e.company_name)}</a>، <a href="#/projects/${e.project_id}"><span class="mono">${esc(e.project_code)}</span> ${esc(e.project_name)}</a>`, editBtn("edit-extract", "تعديل البيانات", "edit", "btn ghost")) +
      `<section class="info panel">
        <div><span>الحالة</span>${extPill(e.status)}</div>
        <div><span>تاريخ التقديم</span><b>${date(e.submitted_on)}</b></div>
        <div><span>الفترة</span><b>${e.period_from || e.period_to ? `${date(e.period_from)} ← ${date(e.period_to)}` : "—"}</b></div>
        <div><span>قيمة الأعمال</span><b class="num">${money(e.gross_amount)}</b></div>
        <div><span>الاستقطاعات</span><b class="num">${money(e.deductions)}</b></div>
        <div><span>الصافي المستحق</span><b class="num strong">${money(e.net_amount)}</b></div>
        ${e.approved_on ? `<div><span>تاريخ الاعتماد</span><b>${date(e.approved_on)}</b></div>` : ""}
        ${e.paid_on ? `<div><span>تاريخ الصرف</span><b>${date(e.paid_on)}</b></div>` : ""}
        ${e.notes ? `<div class="wide"><span>ملاحظات</span><p>${esc(e.notes)}</p></div>` : ""}
      </section>
      ${stepBtns ? `<section class="panel steps"><div class="panel-head"><h2>الإجراء التالي</h2></div><div class="step-btns">${stepBtns}</div></section>` : ""}
      <section class="panel">
        <div class="panel-head"><h2>سجل المتابعة</h2></div>
        <ol class="timeline">${events.map(v => `
          <li><span class="dot ${EXT_STATUS[v.to_status]?.[1] || ""}"></span>
            <div><b>${v.from_status ? `${esc(EXT_STATUS[v.from_status]?.[0])} ← ` : "تسجيل المستخلص: "}${esc(EXT_STATUS[v.to_status]?.[0] || v.to_status)}</b>
            ${v.note ? `<p>${esc(v.note)}</p>` : ""}
            <time>${time(v.created_at)}${names[v.created_by] ? `، ${esc(names[v.created_by])}` : ""}</time></div></li>`).join("")}
        </ol>
      </section>`;
    Object.assign(actions, {
      "edit-extract": () => extractForm(e),
      status: el => statusForm(e, el.dataset.to),
    });
  }

  async function statusesPage() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / المواقف التنفيذية`;
    loading();
    let latest, rows;
    try {
      [latest, rows] = await Promise.all([
        q(sb.from("project_latest_status").select("*").order("project_code")),
        q(sb.from("project_statuses_overview").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(300)),
      ]);
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = statusesPage.f ||= { show: "attention", project: "", cond: "" };
    latest.forEach(r => r.why = attentionOf(r));
    const order = { stopped: 0, delayed: 1, stale: 2 };
    latest.sort((a, b) => (order[a.why] ?? 9) - (order[b.why] ?? 9) || a.project_code.localeCompare(b.project_code, "ar"));
    const nAtt = latest.filter(r => r.why).length;
    if (!nAtt && f.show === "attention") f.show = "";
    view.innerHTML = head("المواقف التنفيذية", "آخر موقف لكل مشروع، وسجل المواقف المسجلة.", editBtn("add-status", "تسجيل موقف تنفيذي")) +
      `<section class="panel">
        <div class="panel-head"><h2>آخر موقف لكل مشروع</h2>
          <select id="show" aria-label="عرض"><option value="">كل المشروعات (${nf.format(latest.length)})</option><option value="attention"${f.show ? " selected" : ""}>تحتاج انتباه (${nf.format(nAtt)})</option></select></div>
        <div id="latest"></div>
        <p class="note">«بدون موقف حديث»: مشروع جارٍ التنفيذ لم يُسجَّل له موقف منذ أكثر من ${nf.format(STALE_DAYS)} أيام.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>سجل المواقف</h2></div>
        <div class="filters">
          <select id="pj" aria-label="المشروع"><option value="">كل المشروعات</option>${latest.slice().sort((a, b) => a.project_code.localeCompare(b.project_code, "ar")).map(p => `<option value="${p.project_id}"${p.project_id === f.project ? " selected" : ""}>${esc(p.project_code)} — ${esc(p.project_name)}</option>`).join("")}</select>
          <select id="cd" aria-label="الوضع"><option value="">كل الأوضاع</option>${opts(COND, f.cond)}</select>
          <span class="count" id="cnt"></span>
        </div>
        <div id="log"></div>
      </section>`;
    const drawLatest = () => {
      const list = latest.filter(r => !f.show || r.why);
      $("#latest").innerHTML = !latest.length ? empty("proj", "لا توجد مشروعات", "أضف المشروعات أولًا من صفحة المشروعات.")
        : !list.length ? empty("stat", "لا توجد مشروعات تحتاج انتباه", "كل المشروعات الجارية لها مواقف حديثة ومنتظمة.")
        : `<table class="table cards"><thead><tr><th>المشروع</th><th>آخر موقف</th><th>الوضع</th><th>الإنجاز</th><th>تنبيه</th></tr></thead><tbody>${list.map(r => {
          const d = daysSince(r.report_date);
          return `<tr class="row-link" data-href="#/projects/${r.project_id}" tabindex="0">
            <td data-label="المشروع" class="title"><span class="company"><span class="mono">${esc(r.project_code)}</span> ${esc(r.project_name)}</span><span class="sub">${pill(r.project_status)}</span></td>
            <td data-label="آخر موقف">${r.report_date ? `${date(r.report_date)}<span class="sub">${d === 0 ? "اليوم" : d === 1 ? "أمس" : `منذ ${nf.format(d)} يوم`}</span>` : "—"}</td>
            <td data-label="الوضع">${condPill(r.condition)}</td>
            <td data-label="الإنجاز">${progress(r.project_progress)}</td>
            <td data-label="تنبيه">${r.why ? `<span class="pill ${WHY[r.why][1]}">${WHY[r.why][0]}</span>` : "—"}</td>
          </tr>`; }).join("")}</tbody></table>`;
    };
    const drawLog = () => {
      const list = rows.filter(r => (!f.project || r.project_id === f.project) && (!f.cond || r.condition === f.cond));
      $("#cnt").textContent = rows.length ? `${nf.format(list.length)} موقف` : "";
      $("#log").innerHTML = !rows.length ? empty("stat", "لا توجد مواقف مسجلة", ctx.canEdit ? "سجّل أول موقف من زر «تسجيل موقف تنفيذي»." : "ستظهر المواقف هنا بعد تسجيلها.")
        : !list.length ? empty("search", "لا توجد نتائج", "غيّر المشروع أو الوضع المختار.") : statusCards(list);
    };
    $("#show").onchange = e => { f.show = e.target.value; drawLatest(); };
    $("#pj").onchange = e => { f.project = e.target.value; drawLog(); };
    $("#cd").onchange = e => { f.cond = e.target.value; drawLog(); };
    drawLatest(); drawLog();
    Object.assign(actions, { "edit-status": el => reportForm(rows.find(r => r.id === el.dataset.id)) });
  }

  /* ---------- التقارير ---------- */
  // التقرير = { title, file, meta: [سطور الفلاتر], sections: [{ title, kv: [[عنوان، قيمة]], columns: [{key,label,type,w}], rows, totals }] }
  // نفس التقرير بيتعرض في الصفحة وبيتطبع وبيتصدّر Excel.
  const fmtCell = (v, t) => v == null || v === "" ? "—"
    : t === "money" ? nf.format(Number(v)) : t === "pct" ? nf.format(Math.round(Number(v) * 10) / 10) + "٪"
    : t === "date" ? date(v) : t === "num" ? nf.format(Number(v)) : esc(v);
  function renderReport(rep) {
    return `<div class="rep-head">
        <img src="assets/logo-128.png" width="52" height="52" alt="" /><div><b>منظومة المتابعة — كتيبة 91 طرق</b><h2>${esc(rep.title)}</h2>
        <p>${rep.meta.map(esc).join("، ")}</p></div>
      </div>${rep.sections.map(s => `
      <div class="rep-sec">${s.title ? `<h3>${esc(s.title)}</h3>` : ""}
        ${s.kv ? `<dl class="rep-kv">${s.kv.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
        ${s.columns ? (s.rows.length ? `<div class="rep-wrap"><table class="table rep"><thead><tr>${s.columns.map(c => `<th class="t-${c.type || "text"}">${esc(c.label)}</th>`).join("")}</tr></thead>
          <tbody>${s.rows.map(r => `<tr>${s.columns.map(c => `<td class="t-${c.type || "text"}">${fmtCell(r[c.key], c.type)}</td>`).join("")}</tr>`).join("")}</tbody>
          ${s.totals ? `<tfoot><tr>${s.columns.map((c, i) => `<td class="t-${c.type || "text"}">${i === 0 ? "الإجمالي" : s.totals[c.key] != null ? fmtCell(s.totals[c.key], c.type) : ""}</td>`).join("")}</tr></tfoot>` : ""}
        </table></div>` : `<p class="rep-empty">${esc(s.empty || "لا توجد بيانات مطابقة.")}</p>`) : ""}
      </div>`).join("")}`;
  }

  let excelP = null;
  const loadExcel = () => excelP ||= new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "lib/exceljs.min.js";
    s.onload = () => res(window.ExcelJS); s.onerror = () => { excelP = null; rej(new Error("excel_load")); };
    document.head.appendChild(s);
  });
  async function exportExcel(rep) {
    const ExcelJS = await loadExcel();
    const wb = new ExcelJS.Workbook(); wb.creator = "منظومة المتابعة"; wb.created = new Date();
    const NAVY = "FF08263D", LINE = { style: "thin", color: { argb: "FFD8E0E1" } };
    const toDate = v => { const [y, m, d] = String(v).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const used = new Set();
    rep.sections.forEach((s, si) => {
      let name = (s.sheet || s.title || rep.title).replace(/[\\/*?:[\]]/g, " ").slice(0, 31);
      while (used.has(name)) name = name.slice(0, 28) + " " + (si + 1); used.add(name);
      const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true }] });
      const width = Math.max(s.columns?.length || 2, 2);
      const title = ws.addRow([rep.title + (s.title && rep.sections.length > 1 ? ` — ${s.title}` : "")]);
      title.font = { bold: true, size: 14, color: { argb: NAVY } }; ws.mergeCells(title.number, 1, title.number, width);
      const meta = ws.addRow([rep.meta.join("  |  ")]); meta.font = { size: 10, color: { argb: "FF6F8591" } }; ws.mergeCells(meta.number, 1, meta.number, width);
      ws.addRow([]);
      if (s.kv) {
        s.kv.forEach(([k, v]) => { const r = ws.addRow([k, v]); r.getCell(1).font = { bold: true }; r.getCell(2).alignment = { wrapText: true, vertical: "top" }; });
        ws.getColumn(1).width = 22; ws.getColumn(2).width = 50;
        if (s.columns) ws.addRow([]);
      }
      if (!s.columns) return;
      const hdr = ws.addRow(s.columns.map(c => c.label));
      hdr.eachCell(c => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; c.border = { bottom: LINE }; });
      hdr.height = 22;
      ws.views = [{ rightToLeft: true, state: "frozen", ySplit: hdr.number }];
      const cellVal = (v, t) => v == null || v === "" ? null : t === "money" || t === "num" ? Number(v) : t === "pct" ? Number(v) / 100 : t === "date" ? toDate(v) : String(v);
      const fmt = { money: "#,##0.00", num: "#,##0", pct: "0.0%", date: "yyyy-mm-dd" };
      const style = row => s.columns.forEach((c, i) => { const cell = row.getCell(i + 1); if (fmt[c.type]) cell.numFmt = fmt[c.type]; cell.alignment = { vertical: "top", wrapText: c.type === "long", horizontal: c.type && c.type !== "long" ? "center" : "right" }; cell.border = { bottom: LINE }; });
      s.rows.forEach(r => style(ws.addRow(s.columns.map(c => cellVal(r[c.key], c.type)))));
      if (s.totals) {
        const t = ws.addRow(s.columns.map((c, i) => i === 0 ? "الإجمالي" : cellVal(s.totals[c.key], c.type)));
        style(t); t.font = { bold: true }; t.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F6" } });
      }
      if (s.rows.length) ws.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: hdr.number + s.rows.length, column: s.columns.length } };
      s.columns.forEach((c, i) => ws.getColumn(i + 1).width = c.w || ({ money: 16, pct: 10, date: 13, num: 10, long: 45 }[c.type] || 22));
    });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    // اسم الملف إنجليزي: بعض المتصفحات بترفض الأسماء العربي في التنزيل
    a.download = `monazoma-${rep.file}-${today()}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // بُناة التقارير (البيانات بتتحمل مرة واحدة عند فتح الصفحة)
  const REPORTS = {
    projects: { label: "ملخص المشروعات", build(d, f) {
      const approved = {}, open = {};
      d.extracts.forEach(e => {
        if (e.status === "approved" || e.status === "paid") approved[e.project_id] = (approved[e.project_id] || 0) + Number(e.net_amount);
        if (EXT_OPEN.includes(e.status)) open[e.project_id] = (open[e.project_id] || 0) + 1;
      });
      const latest = Object.fromEntries(d.latest.map(l => [l.project_id, l]));
      const rows = d.projects.filter(p => !f.status || p.status === f.status).map(p => ({ p, sc: schedule(p) })).map(({ p, sc }) => ({
        code: p.code, name: p.name, location: p.location, status: STATUS[p.status]?.[0], progress: p.progress, contract: p.contract_value,
        elapsed: sc?.elapsed, variance: sc ? Math.round(sc.variance) : null,
        companies: p.companies_count, approved: approved[p.id] || 0, open: open[p.id] || 0,
        last: latest[p.id]?.report_date, cond: latest[p.id]?.condition ? COND[latest[p.id].condition][0] : "", obst: latest[p.id]?.obstacles,
      }));
      const sum = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      return { title: "ملخص المشروعات", file: "projects-summary",
        meta: [`الحالة: ${f.status ? STATUS[f.status][0] : "الكل"}`, `عدد المشروعات: ${nf.format(rows.length)}`],
        sections: [{ sheet: "المشروعات", columns: [
          { key: "code", label: "رقم المشروع", w: 14 }, { key: "name", label: "المشروع", w: 32 }, { key: "location", label: "الموقع" },
          { key: "status", label: "الحالة", w: 14 }, { key: "progress", label: "الإنجاز", type: "pct" },
          { key: "elapsed", label: "الوقت المنقضي", type: "pct", w: 12 }, { key: "variance", label: "الانحراف عن الجدول (نقطة)", type: "num", w: 14 },
          { key: "contract", label: "قيمة التعاقد (ج.م)", type: "money" },
          { key: "companies", label: "الشركات", type: "num" }, { key: "approved", label: "المعتمد من المستخلصات (ج.م)", type: "money", w: 20 },
          { key: "open", label: "مستخلصات تحت المتابعة", type: "num", w: 14 }, { key: "last", label: "آخر موقف", type: "date" },
          { key: "cond", label: "الوضع", w: 10 }, { key: "obst", label: "العوائق", type: "long" }],
          rows, totals: rows.length > 1 ? { contract: sum("contract"), companies: sum("companies"), approved: sum("approved"), open: sum("open") } : null,
          empty: "لا توجد مشروعات مطابقة." }] };
    } },

    extracts: { label: "المستخلصات", build(d, f) {
      const rows = d.extracts.filter(e => (!f.project || e.project_id === f.project)
        && (!f.estatus || (f.estatus === "open" ? EXT_OPEN.includes(e.status) : e.status === f.estatus))
        && (!f.from || e.submitted_on >= f.from) && (!f.to || e.submitted_on <= f.to))
        .sort((a, b) => a.project_code.localeCompare(b.project_code, "ar") || a.company_name.localeCompare(b.company_name, "ar") || a.number - b.number)
        .map(e => ({ project: `${e.project_code} — ${e.project_name}`, company: e.company_name, no: e.number, kind: EXT_KIND[e.kind],
          submitted: e.submitted_on, from: e.period_from, to: e.period_to, gross: e.gross_amount, ded: e.deductions, net: e.net_amount,
          status: EXT_STATUS[e.status][0], approved: e.approved_on, paid: e.paid_on, _rej: e.status === "rejected" }));
      const counted = rows.filter(r => !r._rej), sum = k => counted.reduce((s, r) => s + Number(r[k]), 0);
      const pj = d.projects.find(p => p.id === f.project);
      return { title: "تقرير المستخلصات", file: "extracts",
        meta: [`المشروع: ${pj ? `${pj.code} — ${pj.name}` : "الكل"}`, `الحالة: ${f.estatus === "open" ? "تحت المتابعة" : f.estatus ? EXT_STATUS[f.estatus][0] : "الكل"}`,
          `تاريخ التقديم: ${f.from ? date(f.from) : "البداية"} إلى ${f.to ? date(f.to) : "اليوم"}`, `عدد المستخلصات: ${nf.format(rows.length)}`,
          ...(counted.length < rows.length ? ["الإجماليات بدون المرفوض"] : [])],
        sections: [{ sheet: "المستخلصات", columns: [
          { key: "project", label: "المشروع", w: 30 }, { key: "company", label: "الشركة", w: 26 }, { key: "no", label: "رقم", type: "num", w: 7 },
          { key: "kind", label: "النوع", w: 8 }, { key: "submitted", label: "تاريخ التقديم", type: "date" }, { key: "from", label: "الفترة من", type: "date" },
          { key: "to", label: "الفترة إلى", type: "date" }, { key: "gross", label: "قيمة الأعمال (ج.م)", type: "money" }, { key: "ded", label: "الاستقطاعات (ج.م)", type: "money" },
          { key: "net", label: "الصافي (ج.م)", type: "money" }, { key: "status", label: "الحالة", w: 14 }, { key: "approved", label: "تاريخ الاعتماد", type: "date" },
          { key: "paid", label: "تاريخ الصرف", type: "date" }],
          rows, totals: rows.length > 1 ? { gross: sum("gross"), ded: sum("ded"), net: sum("net") } : null, empty: "لا توجد مستخلصات مطابقة." }] };
    } },

    statuses: { label: "المواقف التنفيذية", build(d, f) {
      const pj = d.projects.find(p => p.id === f.project);
      const base = { meta: [`المشروع: ${pj ? `${pj.code} — ${pj.name}` : "الكل"}`] };
      const COLS = [{ key: "project", label: "المشروع", w: 28 }, { key: "date", label: "تاريخ الموقف", type: "date" }, { key: "cond", label: "الوضع", w: 10 },
        { key: "progress", label: "الإنجاز", type: "pct" }];
      if (f.mode !== "log") {
        const rows = d.latest.filter(l => !f.project || l.project_id === f.project).map(l => ({ ...l, why: attentionOf(l) }))
          .filter(l => !f.attention || l.why).sort((a, b) => a.project_code.localeCompare(b.project_code, "ar"))
          .map(l => ({ project: `${l.project_code} — ${l.project_name}`, pstatus: STATUS[l.project_status]?.[0], date: l.report_date, cond: l.condition ? COND[l.condition][0] : "لا يوجد موقف",
            progress: l.project_progress, alert: l.why ? WHY[l.why][0] : "", obst: l.obstacles }));
        return { ...base, title: "آخر موقف تنفيذي لكل مشروع", file: "latest-statuses",
          meta: [...base.meta, f.attention ? "المشروعات التي تحتاج انتباه فقط" : "كل المشروعات", `عدد المشروعات: ${nf.format(rows.length)}`],
          sections: [{ sheet: "آخر موقف", columns: [COLS[0], { key: "pstatus", label: "حالة المشروع", w: 14 }, ...COLS.slice(1), { key: "alert", label: "تنبيه", w: 16 }, { key: "obst", label: "العوائق", type: "long" }],
            rows, empty: "لا توجد مشروعات مطابقة." }] };
      }
      const rows = d.statuses.filter(s => (!f.project || s.project_id === f.project) && (!f.from || s.report_date >= f.from) && (!f.to || s.report_date <= f.to))
        .map(s => ({ project: `${s.project_code} — ${s.project_name}`, company: s.company_name, date: s.report_date, cond: COND[s.condition][0], progress: s.progress,
          done: s.work_done, next: s.next_steps, obst: s.obstacles, notes: s.notes }));
      return { ...base, title: "سجل المواقف التنفيذية", file: "statuses-log",
        meta: [...base.meta, `الفترة: ${f.from ? date(f.from) : "البداية"} إلى ${f.to ? date(f.to) : "اليوم"}`, `عدد المواقف: ${nf.format(rows.length)}`],
        sections: [{ sheet: "سجل المواقف", columns: [COLS[0], { key: "company", label: "الشركة", w: 20 }, ...COLS.slice(1),
          { key: "done", label: "الأعمال المنفذة", type: "long" }, { key: "next", label: "المخطط", type: "long" }, { key: "obst", label: "العوائق", type: "long" }, { key: "notes", label: "ملاحظات", type: "long", w: 30 }],
          rows, empty: "لا توجد مواقف في هذه الفترة." }] };
    } },

    project: { label: "تقرير مشروع", build(d, f) {
      const p = d.projects.find(x => x.id === f.project);
      if (!p) return { title: "تقرير مشروع", file: "project", meta: ["اختر المشروع من القائمة"], sections: [] };
      const links = d.links.filter(l => l.project_id === p.id), exts = d.extracts.filter(e => e.project_id === p.id), reps = d.statuses.filter(s => s.project_id === p.id);
      const approvedBy = {};
      exts.filter(e => e.status === "approved" || e.status === "paid").forEach(e => approvedBy[e.company_id] = (approvedBy[e.company_id] || 0) + Number(e.net_amount));
      const companies = links.map(l => ({ name: l.companies.name, role: KIND[l.role], scope: l.scope, contract: l.contract_value, approved: approvedBy[l.company_id] || 0,
        pct: l.contract_value && approvedBy[l.company_id] ? approvedBy[l.company_id] / l.contract_value * 100 : null })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
      const cnt = exts.filter(e => e.status !== "rejected"), sumE = k => cnt.reduce((s, e) => s + Number(e[k]), 0);
      const extRows = exts.slice().sort((a, b) => a.company_name.localeCompare(b.company_name, "ar") || a.number - b.number)
        .map(e => ({ company: e.company_name, no: e.number, kind: EXT_KIND[e.kind], submitted: e.submitted_on, gross: e.gross_amount, ded: e.deductions, net: e.net_amount, status: EXT_STATUS[e.status][0] }));
      const latest = reps[0];
      return { title: `تقرير مشروع ${p.code}`, file: `project-${p.code.replace(/[^A-Za-z0-9_-]+/g, "") || "report"}`, meta: [p.name, `حتى ${date(today())}`],
        sections: [
          { title: "بيانات المشروع", sheet: "بيانات المشروع", kv: [["رقم المشروع", p.code], ["اسم المشروع", p.name], ["الموقع", p.location || "—"],
            ["الحالة", STATUS[p.status][0]], ["نسبة الإنجاز", `${nf.format(Number(p.progress))}٪`], ["قيمة التعاقد", money(p.contract_value)],
            ["تاريخ البدء", date(p.start_date)], ["الانتهاء المخطط", date(p.planned_end_date)], ["عدد الشركات", nf.format(links.length)],
            ["المعتمد من المستخلصات", money(Object.values(approvedBy).reduce((s, v) => s + v, 0))],
            ["آخر موقف تنفيذي", latest ? `${date(latest.report_date)} — ${COND[latest.condition][0]}` : "لا يوجد"], ...(latest?.obstacles ? [["العوائق الحالية", latest.obstacles]] : [])] },
          { title: "الشركات", sheet: "الشركات", columns: [{ key: "name", label: "الشركة", w: 28 }, { key: "role", label: "الدور", w: 14 }, { key: "scope", label: "نطاق الأعمال", type: "long" },
            { key: "contract", label: "قيمة التعاقد (ج.م)", type: "money" }, { key: "approved", label: "المعتمد (ج.م)", type: "money" }, { key: "pct", label: "من التعاقد", type: "pct" }],
            rows: companies, totals: companies.length > 1 ? { contract: companies.reduce((s, c) => s + (Number(c.contract) || 0), 0), approved: companies.reduce((s, c) => s + c.approved, 0) } : null,
            empty: "لا توجد شركات مرتبطة بالمشروع." },
          { title: "المستخلصات", sheet: "المستخلصات", columns: [{ key: "company", label: "الشركة", w: 26 }, { key: "no", label: "رقم", type: "num", w: 7 }, { key: "kind", label: "النوع", w: 8 },
            { key: "submitted", label: "تاريخ التقديم", type: "date" }, { key: "gross", label: "قيمة الأعمال (ج.م)", type: "money" }, { key: "ded", label: "الاستقطاعات (ج.م)", type: "money" },
            { key: "net", label: "الصافي (ج.م)", type: "money" }, { key: "status", label: "الحالة", w: 14 }],
            rows: extRows, totals: extRows.length > 1 ? { gross: sumE("gross_amount"), ded: sumE("deductions"), net: sumE("net_amount") } : null, empty: "لا توجد مستخلصات." },
          { title: "آخر المواقف التنفيذية", sheet: "المواقف", columns: [{ key: "date", label: "التاريخ", type: "date" }, { key: "cond", label: "الوضع", w: 10 }, { key: "progress", label: "الإنجاز", type: "pct" },
            { key: "done", label: "الأعمال المنفذة", type: "long" }, { key: "obst", label: "العوائق", type: "long" }],
            rows: reps.slice(0, 10).map(s => ({ date: s.report_date, cond: COND[s.condition][0], progress: s.progress, done: s.work_done, obst: s.obstacles })), empty: "لا توجد مواقف مسجلة." },
        ] };
    } },
  };

  async function reportsPage() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / التقارير`;
    loading();
    let d;
    try {
      const [projects, extracts, latest, statuses, links] = await Promise.all([
        fetchAll(() => sb.from("projects_overview").select("*").order("code")),
        fetchAll(() => sb.from("extracts_overview").select("*").order("submitted_on", { ascending: false }).order("id")),
        fetchAll(() => sb.from("project_latest_status").select("*").order("project_code")),
        fetchAll(() => sb.from("project_statuses_overview").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: false }).order("id")),
        fetchAll(() => sb.from("project_companies").select("*, companies(name)").order("project_id").order("company_id")),
      ]);
      d = { projects, extracts, latest, statuses, links };
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = reportsPage.f ||= { type: "projects", status: "", project: "", estatus: "", from: "", to: "", mode: "latest", attention: false };
    const pjOpts = (all = true) => (all ? `<option value="">كل المشروعات</option>` : `<option value="">اختر المشروع…</option>`) + d.projects.map(p => `<option value="${p.id}"${p.id === f.project ? " selected" : ""}>${esc(p.code)} — ${esc(p.name)}</option>`).join("");
    const FILTERS = {
      projects: () => `<select data-f="status" aria-label="الحالة"><option value="">كل الحالات</option>${opts(STATUS, f.status)}</select>`,
      extracts: () => `<select data-f="project" aria-label="المشروع">${pjOpts()}</select>
        <select data-f="estatus" aria-label="الحالة"><option value="">كل الحالات</option><option value="open"${f.estatus === "open" ? " selected" : ""}>تحت المتابعة</option>${opts(EXT_STATUS, f.estatus)}</select>
        <label class="dt">من <input type="date" data-f="from" value="${f.from}" /></label><label class="dt">إلى <input type="date" data-f="to" value="${f.to}" /></label>`,
      statuses: () => `<select data-f="mode" aria-label="نوع التقرير"><option value="latest">آخر موقف لكل مشروع</option><option value="log"${f.mode === "log" ? " selected" : ""}>سجل المواقف في فترة</option></select>
        <select data-f="project" aria-label="المشروع">${pjOpts()}</select>
        ${f.mode === "log" ? `<label class="dt">من <input type="date" data-f="from" value="${f.from}" /></label><label class="dt">إلى <input type="date" data-f="to" value="${f.to}" /></label>`
          : `<label class="chk"><input type="checkbox" data-f="attention"${f.attention ? " checked" : ""} /> التي تحتاج انتباه فقط</label>`}`,
      project: () => `<select data-f="project" aria-label="المشروع">${pjOpts(false)}</select>`,
    };
    view.innerHTML = head("التقارير", "تقارير جاهزة للطباعة والتصدير إلى Excel من بيانات المنظومة الحالية.") +
      `<section class="panel no-print">
        <div class="rep-tabs" role="tablist">${Object.entries(REPORTS).map(([k, r]) => `<button role="tab" class="${k === f.type ? "on" : ""}" aria-selected="${k === f.type}" data-type="${k}">${esc(r.label)}</button>`).join("")}</div>
        <div class="filters" id="rf"></div>
        <div class="rep-actions"><button class="btn primary" data-action="rep-excel">${svg(ICON.ext)}<span>تصدير Excel</span></button><button class="btn ghost" data-action="rep-print">طباعة</button></div>
      </section>
      <section class="panel rep-out" id="rout"></section>`;
    let rep;
    const draw = () => {
      $("#rf").innerHTML = FILTERS[f.type]();
      rep = REPORTS[f.type].build(d, f);
      $("#rout").innerHTML = renderReport(rep);
      $$("[data-action^=rep-]").forEach(b => b.disabled = !rep.sections.length);
    };
    $(".rep-tabs").onclick = e => { const b = e.target.closest("[data-type]"); if (!b) return; f.type = b.dataset.type; $$(".rep-tabs button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); draw(); };
    $("#rf").onchange = e => { const el = e.target.closest("[data-f]"); if (!el) return; f[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; draw(); };
    draw();
    Object.assign(actions, {
      "rep-print": () => window.print(),
      "rep-excel": async el => {
        el.disabled = true; const label = $("span", el).textContent; $("span", el).textContent = "جارٍ التجهيز…";
        try { await exportExcel(rep); toast("تم تنزيل ملف Excel."); }
        catch { toast("تعذّر تجهيز ملف Excel. تأكد من الاتصال وحاول مرة أخرى.", true); }
        finally { el.disabled = false; $("span", el).textContent = label; }
      },
    });
  }

  /* ---------- العرض المضغوط (إعداد لكل جهاز) ---------- */
  const DENSE_KEY = "monazoma-dense";
  const isDense = () => { try { return localStorage.getItem(DENSE_KEY) === "1"; } catch { return false; } };
  const setDense = on => { document.documentElement.classList.toggle("dense", on); try { on ? localStorage.setItem(DENSE_KEY, "1") : localStorage.removeItem(DENSE_KEY); } catch { /* اختياري */ } };
  setDense(isDense());

  /* ---------- الإعدادات: حسابي + إدارة المستخدمين ---------- */
  const ROLE = { admin: ["مدير المنظومة", "blue"], editor: ["إدخال وتعديل", "amber"], viewer: ["اطلاع فقط", "gray"] };
  const ROLE_HINT = "المدير: كل شيء + إدارة المستخدمين والحذف. إدخال وتعديل: الإضافة والتعديل وتغيير حالات المستخلصات. اطلاع فقط: مشاهدة بدون تعديل.";
  const MIN_PASSWORD = 8;
  const USER_ERR = {
    bad_username: "اسم المستخدم: حروف إنجليزية صغيرة وأرقام فقط، يبدأ بحرف، من ٣ إلى ٣٠ حرفًا (مسموح . _ -).",
    bad_name: "اكتب الاسم الذي سيظهر في المنظومة.",
    weak_password: `كلمة المرور يجب ألا تقل عن ${nf.format(MIN_PASSWORD)} أحرف.`,
    username_taken: "اسم المستخدم هذا مستخدم بالفعل. اختر اسمًا آخر.",
    cannot_disable_self: "لا يمكنك إيقاف حسابك أنت.",
    last_admin: "يجب أن يبقى مدير نشط واحد على الأقل في المنظومة.",
    forbidden: "هذا الإجراء للمدير فقط.",
    unauthorized: "انتهت الجلسة. سجّل الدخول من جديد.",
  };
  async function adminCall(body) {
    const { data, error } = await sb.functions.invoke("admin-users", { body });
    if (!error) return data;
    let code = "";
    try { code = (await error.context.json()).error; } catch { /* رد غير متوقع */ }
    throw Object.assign(new Error(code || "function_failed"), { userMsg: USER_ERR[code] || "تعذّر تنفيذ العملية، حاول مرة أخرى." });
  }
  const passwordFields = (withCurrent) => [
    ...(withCurrent ? [{ name: "current", label: "كلمة المرور الحالية", type: "password", required: true, wide: true }] : []),
    { name: "password", label: "كلمة المرور الجديدة", type: "password", required: true, wide: true, hint: `${nf.format(MIN_PASSWORD)} أحرف على الأقل.` },
    { name: "confirm", label: "تأكيد كلمة المرور", type: "password", required: true, wide: true },
  ];
  const checkPasswords = v => {
    if (v.password.length < MIN_PASSWORD) throw Object.assign(new Error(), { userMsg: USER_ERR.weak_password });
    if (v.password !== v.confirm) throw Object.assign(new Error(), { userMsg: "كلمتا المرور غير متطابقتين." });
  };

  function myPasswordForm() {
    openForm({
      title: "تغيير كلمة المرور", fields: passwordFields(true), submitLabel: "تغيير كلمة المرور",
      onSubmit: async v => {
        checkPasswords(v);
        const { data: { user } } = await sb.auth.getUser();
        const { error: e1 } = await sb.auth.signInWithPassword({ email: user.email, password: v.current });
        if (e1) throw Object.assign(new Error(), { userMsg: "كلمة المرور الحالية غير صحيحة." });
        const { error: e2 } = await sb.auth.updateUser({ password: v.password });
        if (e2) throw Object.assign(e2, { userMsg: /different|same/i.test(e2.message) ? "اختر كلمة مرور مختلفة عن الحالية." : /weak|short|least/i.test(e2.message) ? USER_ERR.weak_password : undefined });
        toast("تم تغيير كلمة المرور.");
      },
    });
  }

  function addUserForm() {
    openForm({
      title: "إضافة مستخدم",
      fields: [
        { name: "name", label: "الاسم الظاهر", required: true, maxlength: 100, wide: true, hint: "مثال: م. أحمد علي — يظهر في القائمة وسجل المتابعة." },
        { name: "username", label: "اسم المستخدم (للدخول)", required: true, maxlength: 30, autocomplete: "off", hint: "حروف إنجليزية صغيرة وأرقام، مثل ahmed أو eng.ali" },
        { name: "role", label: "الصلاحية", type: "select", options: opts(ROLE, "viewer"), hint: ROLE_HINT },
        ...passwordFields(false),
      ],
      submitLabel: "إنشاء الحساب",
      onSubmit: async v => {
        v.username = v.username.toLowerCase();
        if (!/^[a-z][a-z0-9._-]{2,29}$/.test(v.username)) throw Object.assign(new Error(), { userMsg: USER_ERR.bad_username });
        checkPasswords(v);
        await adminCall({ action: "create", username: v.username, name: v.name, role: v.role, password: v.password });
        toast(`تم إنشاء حساب «${v.name}». اسم الدخول: ${v.username}`); route();
      },
    });
  }

  function editUserForm(u) {
    const self = u.id === ctx.profile.id;
    const form = openForm({
      title: `تعديل: ${u.name || u.username}`,
      fields: [
        { name: "name", label: "الاسم الظاهر", required: true, maxlength: 100, wide: true },
        { name: "role", label: "الصلاحية", type: "select", options: opts(ROLE, u.role), wide: true, hint: ROLE_HINT },
      ],
      data: u, submitLabel: "حفظ",
      onSubmit: async v => {
        await q(sb.from("profiles").update(v).eq("id", u.id));
        if (self && v.role !== u.role) { toast("تم تغيير صلاحيتك. سيُعاد تحميل الصفحة."); setTimeout(() => location.reload(), 1200); return; }
        toast("تم حفظ التعديلات."); route();
      },
    });
    // أزرار إضافية: كلمة مرور جديدة + إيقاف/تفعيل
    const extra = document.createElement("div");
    extra.className = "user-extra";
    extra.innerHTML = `<button type="button" class="btn ghost sm" data-x="pw">تعيين كلمة مرور جديدة</button>` +
      (self ? "" : `<button type="button" class="btn ${u.active ? "danger" : "ghost"} sm" data-x="active">${u.active ? "إيقاف الحساب" : "إعادة تفعيل الحساب"}</button>`);
    $(".fields", form).after(extra);
    $('[data-x="pw"]', extra).onclick = () => openForm({
      title: `كلمة مرور جديدة: ${u.name || u.username}`, fields: passwordFields(false), submitLabel: "تعيين كلمة المرور",
      onSubmit: async v => { checkPasswords(v); await adminCall({ action: "set_password", id: u.id, password: v.password }); toast("تم تعيين كلمة المرور الجديدة. أبلغ المستخدم بها."); route(); },
    });
    const act = $('[data-x="active"]', extra);
    if (act) act.onclick = async () => {
      if (u.active && !confirm(`إيقاف حساب «${u.name || u.username}»؟ لن يستطيع الدخول حتى تعيد تفعيله. بياناته وسجله يبقيان كما هما.`)) return;
      act.disabled = true;
      try { await adminCall({ action: "set_active", id: u.id, active: !u.active }); dlg.close(); toast(u.active ? "تم إيقاف الحساب." : "تم تفعيل الحساب."); route(); }
      catch (e) { $(".form-err", form).textContent = errText(e); act.disabled = false; }
    };
  }

  async function settings() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / الإعدادات`;
    loading();
    let users = [], demoCount = 0;
    if (ctx.isAdmin) {
      try {
        [users, demoCount] = await Promise.all([
          q(sb.from("profiles").select("id,name,username,role,active,created_at").order("active", { ascending: false }).order("name")),
          q(sb.from("projects").select("id", { count: "exact", head: true }).eq("demo", true)),
        ]);
      }
      catch (e) { return my === seq && failed(e); }
    }
    if (my !== seq) return;
    const me = ctx.profile;
    view.innerHTML = head("الإعدادات", ctx.isAdmin ? "حسابك وإدارة مستخدمي المنظومة." : "بيانات حسابك.") +
      `<section class="panel">
        <div class="panel-head"><h2>حسابي</h2><button class="btn ghost sm" data-action="my-password">تغيير كلمة المرور</button></div>
        <div class="info flat">
          <div><span>الاسم</span><b>${esc(me.name) || "—"}</b></div>
          <div><span>اسم المستخدم</span><b class="mono" dir="ltr">${esc(me.username)}</b></div>
          <div><span>الصلاحية</span><span class="pill ${ROLE[me.role]?.[1]}">${esc(ROLE[me.role]?.[0])}</span></div>
        </div>
      </section>
      ${ctx.isAdmin ? `<section class="panel">
        <div class="panel-head"><h2>المستخدمون</h2><button class="btn primary sm" data-action="add-user">${svg(ICON.plus)}<span>إضافة مستخدم</span></button></div>
        <table class="table cards"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody>${users.map((u, i) => `
          <tr class="${u.active ? "" : "inactive"}">
            <td data-label="الاسم" class="title"><span class="company">${esc(u.name) || "—"}</span>${u.id === me.id ? `<span class="sub">أنت</span>` : ""}</td>
            <td data-label="اسم المستخدم" class="mono" dir="ltr">${esc(u.username)}</td>
            <td data-label="الصلاحية"><span class="pill ${ROLE[u.role]?.[1]}">${esc(ROLE[u.role]?.[0])}</span></td>
            <td data-label="الحالة">${u.active ? `<span class="pill green">نشط</span>` : `<span class="pill red">موقوف</span>`}</td>
            <td class="act"><button class="icon-btn" data-action="edit-user" data-i="${i}" aria-label="تعديل المستخدم">${svg(ICON.edit)}</button></td>
          </tr>`).join("")}</tbody></table>
        <p class="note">يدخل المستخدم باسم المستخدم وكلمة المرور التي تحددها له، ويستطيع تغيير كلمة المرور بنفسه من صفحة الإعدادات. الحساب الموقوف لا يستطيع الدخول، ويبقى اسمه في سجل المتابعة.</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>البيانات التجريبية</h2></div>
        <p class="note" style="margin-top:0">${demoCount ? `المنظومة فيها الآن <b>${nf.format(demoCount)}</b> مشروعات تجريبية (أكوادها تبدأ بـ «تج-») مع شركاتها ومستخلصاتها ومواقفها. امسحها قبل إدخال البيانات الحقيقية — المسح لا يلمس أي بيانات أخرى.` : "تحميل ٨ مشروعات تجريبية بحالات مختلفة مع شركات ومستخلصات ومواقف تنفيذية، للعرض والتجربة. يمكن مسحها كلها بضغطة."}</p>
        <div class="step-btns">${demoCount ? `<button class="btn danger" data-action="demo-clear">مسح البيانات التجريبية</button>` : `<button class="btn primary" data-action="demo-load">تحميل البيانات التجريبية</button>`}</div>
      </section>` : ""}
      <section class="panel">
        <div class="panel-head"><h2>طريقة العرض</h2></div>
        <label class="chk-row"><input type="checkbox" id="dense"${isDense() ? " checked" : ""} /> عرض مضغوط للجداول (صفوف أكثر في الشاشة)</label>
      </section>`;
    $("#dense").onchange = e => setDense(e.target.checked);
    Object.assign(actions, {
      "demo-load": async el => { el.disabled = true; el.textContent = "جارٍ التحميل…"; try { await q(sb.rpc("load_demo_data")); await q(sb.rpc("load_demo_sections")); toast("تم تحميل البيانات التجريبية."); location.hash = "#/"; } catch (e) { toast(errText(e), true); el.disabled = false; } },
      "demo-clear": async el => { if (!confirm("مسح كل البيانات التجريبية (المشروعات «تج-» وشركاتها ومستخلصاتها ومواقفها)؟")) return; el.disabled = true; el.textContent = "جارٍ المسح…"; try { await q(sb.rpc("clear_demo_sections")); await q(sb.rpc("clear_demo_data")); toast("تم مسح البيانات التجريبية."); route(); } catch (e) { toast(errText(e), true); el.disabled = false; } },
      "my-password": myPasswordForm,
      "add-user": addUserForm,
      "edit-user": el => editUserForm(users[+el.dataset.i]),
    });
  }

  function soon(title) {
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / ${esc(title)}`;
    view.innerHTML = head(title, "") + `<section class="panel">${empty("tool", "هذه الشاشة لم تُبنَ بعد", "ستتاح في مرحلة قادمة من المنظومة.")}</section>`;
  }

  /* ---------- التوجيه ---------- */
  const SOON = {};
  function route() {
    const [, sec = "", id, sub] = (location.hash || "#/").split("/");
    seq++;
    actions = {
      "add-project": () => projectForm(),
      "add-company": () => companyForm(),
      "add-extract": () => extractForm(),
      "add-status": () => reportForm(),
    };
    $$(".nav a").forEach(a => {
      const on = a.getAttribute("href") === "#/" + sec;
      a.classList.toggle("active", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
      if (on && matchMedia("(max-width:700px)").matches) a.scrollIntoView({ block: "nearest", inline: "center" });
    });
    const key = location.hash || "#/", my = seq;
    const done = Promise.resolve(
      sec === "projects" ? (id ? projectDetail(id, sub) : projectsList())
      : sec === "companies" ? (id ? companyDetail(id) : companiesList())
      : sec === "extracts" ? (id ? extractDetail(id) : extractsList())
      : sec === "settings" ? settings()
      : sec === "statuses" ? statusesPage()
      : sec === "reports" ? reportsPage()
      : sec === "commitments" ? commitmentsPage()
      : sec === "technical" ? technicalPage(id, sub)
      : SOON[sec] ? soon(SOON[sec]) : dashboard());
    done.finally(() => {
      if (my !== seq) return;
      view.classList.remove("stale");
      if (!view.querySelector(".loading")) snaps.set(key, view.innerHTML);
    });
    if (!(sec === "projects" && id && route.lastKey === `${sec}/${id}`)) window.scrollTo(0, 0);
    route.lastKey = `${sec}/${id}`;
  }

  view.addEventListener("click", e => {
    const a = e.target.closest("[data-action]");
    if (a) { e.preventDefault(); actions[a.dataset.action]?.(a); return; }
    const r = e.target.closest("tr[data-href]");
    if (r && !e.target.closest("a,button")) location.hash = r.dataset.href;
  });
  view.addEventListener("keydown", e => {
    const r = e.target.closest?.("tr[data-href]");
    if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.hash = r.dataset.href; }
  });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

  monazoma.guard().then(r => {
    if (!r) return;
    ctx = { profile: r.profile, canEdit: ["admin", "editor"].includes(r.profile.role), isAdmin: r.profile.role === "admin" };
    window.addEventListener("hashchange", route);
    route();
  });
})();
