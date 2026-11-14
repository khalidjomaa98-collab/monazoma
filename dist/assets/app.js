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
  const opts = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(Array.isArray(v) ? v[0] : v)}</option>`).join("");

  function toast(msg, bad) {
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

  const loading = () => { view.innerHTML = `<div class="loading"><span></span>جارٍ التحميل…</div>`; };
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
        let v = form.elements[f.name].value;
        if (f.type === "number" || f.type === "date") v = v === "" ? null : (f.type === "number" ? Number(v) : v);
        else if (f.type !== "password") v = v.trim();
        out[f.name] = v;
      }
      busy(true); submit.textContent = "جارٍ الحفظ…";
      try { await onSubmit(out); dlg.close(); }
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

  function projectForm(p = {}, after) {
    openForm({
      title: p.id ? "تعديل بيانات المشروع" : "إضافة مشروع", fields: withOptions(PROJECT_FIELDS, p), data: p,
      submitLabel: p.id ? "حفظ التعديلات" : "إضافة المشروع",
      onSubmit: async v => {
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
        s ? [] : fetchAll(() => sb.from("projects").select("id,code,name,progress").order("code")),
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
    };
    el("progress").addEventListener("input", () => el("progress").dataset.touched = "1");
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
          <div class="st-meta">${condPill(r.condition)}${progress(r.progress)}${ctx.canEdit && !compact ? `<button class="icon-btn" data-action="edit-status" data-id="${r.id}" aria-label="تعديل الموقف">${svg(ICON.edit)}</button>` : ""}</div>
        </header>
        ${compact ? block("العوائق", r.obstacles, "obst") :
          block("الأعمال المنفذة", r.work_done) + block("المخطط للفترة القادمة", r.next_steps) + block("العوائق", r.obstacles, "obst") + block("ملاحظات", r.notes)}
      </article>`).join("")}</div>`;
  }

  /* ---------- الشاشات ---------- */
  async function dashboard() {
    const my = seq;
    crumb.innerHTML = `<b>الرئيسية</b> / لوحة التحكم`;
    view.replaceChildren($("#tpl-dashboard").content.cloneNode(true));
    $$("[data-needs-edit]", view).forEach(el => el.hidden = !ctx.canEdit);
    try {
      const [pc, cc, active, openN, needs, latest, perProject, reports] = await Promise.all([
        q(sb.from("projects").select("id", { count: "exact", head: true })),
        q(sb.from("companies").select("id", { count: "exact", head: true })),
        q(sb.from("projects").select("progress").eq("status", "active")),
        q(sb.from("extracts").select("id", { count: "exact", head: true }).in("status", EXT_OPEN)),
        q(sb.from("extracts").select("id", { count: "exact", head: true }).eq("status", "needs_completion")),
        q(sb.from("extracts_overview").select("*").order("submitted_on", { ascending: false }).order("created_at", { ascending: false }).limit(5)),
        q(sb.from("project_latest_status").select("project_id,project_status,condition,report_date")),
        q(sb.from("project_statuses_overview").select("*").order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(4)),
      ]);
      if (my !== seq) return;
      $('[data-stat="extracts"]', view).textContent = nf.format(openN);
      $('[data-stat-note="extracts"]', view).textContent = openN ? `${nf.format(openN - needs)} بانتظار المراجعة، ${nf.format(needs)} مطلوب استكمال` : "لا توجد مستخلصات تحت المتابعة";
      // المشروعات اللي محتاجة انتباه (كل مشروع يتعد مرة واحدة)
      const att = attention(perProject);
      const nAtt = att.size, total = needs + nAtt;
      const counts = { stopped: 0, delayed: 0, stale: 0 };
      att.forEach(why => counts[why]++);
      $('[data-stat="alerts"]', view).textContent = nf.format(total);
      $('[data-stat-note="alerts"]', view).textContent = total
        ? [needs && `${nf.format(needs)} مستخلص مطلوب استكماله`, counts.stopped && `${nf.format(counts.stopped)} مشروع متوقف`,
           counts.delayed && `${nf.format(counts.delayed)} متأخر`, counts.stale && `${nf.format(counts.stale)} بدون موقف حديث`].filter(Boolean).join("، ")
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

  async function projectsList() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / المشروعات`;
    loading();
    let rows;
    try { rows = await fetchAll(() => sb.from("projects_overview").select("*").order("code")); } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = projectsList.f ||= { text: "", status: "" };
    view.innerHTML = head("المشروعات", `مشروعات الطرق المسجلة وحالتها ونسبة الإنجاز.`, editBtn("add-project", "إضافة مشروع")) +
      `<section class="panel">
        <div class="filters">
          <label class="search">${svg(ICON.search)}<input type="search" id="q" placeholder="بحث برقم المشروع أو الاسم أو الموقع" value="${esc(f.text)}" /></label>
          <select id="st" aria-label="الحالة"><option value="">كل الحالات</option>${opts(STATUS, f.status)}</select>
          <span class="count" id="cnt"></span>
        </div>
        <div id="list"></div>
      </section>`;
    const draw = () => {
      const t = f.text.trim().toLowerCase();
      const list = rows.filter(r => (!f.status || r.status === f.status) && (!t || [r.code, r.name, r.location].some(x => (x || "").toLowerCase().includes(t))));
      $("#cnt").textContent = rows.length ? `${nf.format(list.length)} من ${nf.format(rows.length)}` : "";
      $("#list").innerHTML = !rows.length ? empty("proj", "لا توجد مشروعات مسجلة", ctx.canEdit ? "ابدأ بإضافة أول مشروع من زر «إضافة مشروع»." : "ستظهر المشروعات هنا بعد أن يضيفها المسؤول عن الإدخال.")
        : !list.length ? empty("search", "لا توجد نتائج", "غيّر كلمات البحث أو الحالة المختارة.")
        : `<table class="table cards"><thead><tr><th>رقم المشروع</th><th>المشروع</th><th>الحالة</th><th>الإنجاز</th><th>الشركات</th><th>الانتهاء المخطط</th></tr></thead><tbody>${list.map(r => `
          <tr class="row-link" data-href="#/projects/${r.id}" tabindex="0">
            <td data-label="رقم المشروع" class="mono">${esc(r.code)}</td>
            <td data-label="المشروع" class="title"><span class="company">${esc(r.name)}</span>${r.location ? `<span class="sub">${esc(r.location)}</span>` : ""}</td>
            <td data-label="الحالة">${pill(r.status)}</td>
            <td data-label="الإنجاز">${progress(r.progress)}</td>
            <td data-label="الشركات">${nf.format(r.companies_count)}</td>
            <td data-label="الانتهاء المخطط">${date(r.planned_end_date)}</td>
          </tr>`).join("")}</tbody></table>`;
    };
    $("#q").oninput = e => { f.text = e.target.value; draw(); };
    $("#st").onchange = e => { f.status = e.target.value; draw(); };
    draw();
  }

  async function projectDetail(id) {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/projects">المشروعات</a> / …`;
    loading();
    let p, links, exts, reps;
    try {
      [p, links, exts, reps] = await Promise.all([
        q(sb.from("projects").select("*").eq("id", id).maybeSingle()),
        q(sb.from("project_companies").select("*, companies(id,name,kind)").eq("project_id", id)),
        fetchAll(() => sb.from("extracts_overview").select("*").eq("project_id", id).order("submitted_on", { ascending: false }).order("number", { ascending: false }).order("id")),
        q(sb.from("project_statuses_overview").select("*").eq("project_id", id).order("report_date", { ascending: false }).order("created_at", { ascending: false }).limit(4)),
      ]);
    } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    if (!p) { view.innerHTML = `<div class="panel">${empty("proj", "المشروع غير موجود", "ربما حُذف. ارجع لقائمة المشروعات.")}</div>`; return; }
    links.sort((a, b) => a.companies.name.localeCompare(b.companies.name, "ar"));
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / <a href="#/projects">المشروعات</a> / <b>${esc(p.code)}</b>`;
    const total = links.reduce((s, l) => s + (Number(l.contract_value) || 0), 0);
    const approvedBy = {}; // صافي المستخلصات المعتمدة والمصروفة لكل شركة
    exts.filter(x => x.status === "approved" || x.status === "paid").forEach(x => approvedBy[x.company_id] = (approvedBy[x.company_id] || 0) + Number(x.net_amount));
    const approvedAll = Object.values(approvedBy).reduce((s, v) => s + v, 0);
    view.innerHTML = head(p.name, `<span class="mono">${esc(p.code)}</span>${p.location ? `، ${esc(p.location)}` : ""}`, `<a class="btn ghost" href="#/reports" data-action="project-report">تقرير المشروع</a>` + editBtn("edit-project", "تعديل البيانات", "edit", "btn ghost")) +
      `<section class="info panel">
        <div><span>الحالة</span>${pill(p.status)}</div>
        <div><span>نسبة الإنجاز</span>${progress(p.progress)}</div>
        <div><span>قيمة التعاقد</span><b>${money(p.contract_value)}</b></div>
        <div><span>تاريخ البدء</span><b>${date(p.start_date)}</b></div>
        <div><span>الانتهاء المخطط</span><b>${date(p.planned_end_date)}</b></div>
        <div><span>عدد الشركات</span><b>${nf.format(links.length)}</b></div>
        ${p.notes ? `<div class="wide"><span>ملاحظات</span><p>${esc(p.notes)}</p></div>` : ""}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>المواقف التنفيذية</h2><div class="head-actions">${reps.length > 3 ? `<a class="btn ghost sm" href="#/statuses" data-action="all-statuses">كل المواقف</a>` : ""}${editBtn("add-status-here", "تسجيل موقف", "plus", "btn ghost sm")}</div></div>
        ${reps.length ? statusCards(reps.slice(0, 3), { project: false }) : empty("stat", "لا توجد مواقف تنفيذية", ctx.canEdit ? "سجّل موقف المشروع من زر «تسجيل موقف»." : "لم يُسجَّل موقف لهذا المشروع بعد.")}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>الشركات المرتبطة بالمشروع</h2>${editBtn("link-company", "ربط شركة", "link", "btn ghost sm")}</div>
        ${!links.length ? empty("co", "لا توجد شركات مرتبطة", ctx.canEdit ? "اربط الشركات المنفذة والموردين من زر «ربط شركة»." : "لم تُربط شركات بهذا المشروع بعد.") :
        `<table class="table cards"><thead><tr><th>الشركة</th><th>الدور</th><th>نطاق الأعمال</th><th>قيمة التعاقد</th><th>المعتمد من المستخلصات</th>${ctx.canEdit ? "<th></th>" : ""}</tr></thead><tbody>${links.map((l, i) => `
          <tr>
            <td data-label="الشركة" class="title"><a class="company" href="#/companies/${l.company_id}">${esc(l.companies.name)}</a></td>
            <td data-label="الدور">${esc(KIND[l.role])}</td>
            <td data-label="نطاق الأعمال" class="scope">${esc(l.scope) || "—"}</td>
            <td data-label="قيمة التعاقد" class="num">${money(l.contract_value)}</td>
            <td data-label="المعتمد من المستخلصات" class="num">${approvedBy[l.company_id] ? money(approvedBy[l.company_id]) : "—"}${l.contract_value && approvedBy[l.company_id] ? `<span class="sub">${nf.format(Math.round(approvedBy[l.company_id] / l.contract_value * 100))}٪ من التعاقد</span>` : ""}</td>
            ${ctx.canEdit ? `<td class="act"><button class="icon-btn" data-action="edit-link" data-i="${i}" aria-label="تعديل الارتباط">${svg(ICON.edit)}</button></td>` : ""}
          </tr>`).join("")}</tbody>${links.length > 1 ? `<tfoot><tr><td colspan="3">الإجمالي</td><td class="num">${money(total)}</td><td class="num">${approvedAll ? money(approvedAll) : "—"}</td>${ctx.canEdit ? "<td></td>" : ""}</tr></tfoot>` : ""}</table>`}
      </section>
      <section class="panel">
        <div class="panel-head"><h2>مستخلصات المشروع</h2>${links.length ? editBtn("add-extract-here", "تسجيل مستخلص", "plus", "btn ghost sm") : ""}</div>
        ${exts.length ? extractsTable(exts, { project: false }) : empty("ext", "لا توجد مستخلصات", links.length ? (ctx.canEdit ? "سجّل مستخلصات الشركات من زر «تسجيل مستخلص»." : "لم تُسجَّل مستخلصات لهذا المشروع بعد.") : "اربط الشركات بالمشروع أولًا، ثم سجّل مستخلصاتها.")}
      </section>`;
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
      "project-report": () => { Object.assign(reportsPage.f ||= { status: "", estatus: "", from: "", to: "", mode: "latest", attention: false }, { type: "project", project: id }); location.hash = "#/reports"; },
      "edit-status": el => reportForm(reps.find(r => r.id === el.dataset.id)),
      "all-statuses": () => { (statusesPage.f ||= { show: "", project: "", cond: "" }).project = id; location.hash = "#/statuses"; },
    });
  }

  async function companiesList() {
    const my = seq;
    crumb.innerHTML = `<a href="#/">الرئيسية</a> / الشركات`;
    loading();
    let rows;
    try { rows = await fetchAll(() => sb.from("companies_overview").select("*").order("name").order("id")); } catch (e) { return my === seq && failed(e); }
    if (my !== seq) return;
    const f = companiesList.f ||= { text: "", kind: "" };
    view.innerHTML = head("الشركات", "الشركات المنفذة والمقاولون والموردون وعدد المشروعات المرتبطة بكل شركة.", editBtn("add-company", "إضافة شركة")) +
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
        : `<table class="table cards"><thead><tr><th>الشركة</th><th>التصنيف</th><th>السجل التجاري</th><th>الهاتف</th><th>المشروعات</th></tr></thead><tbody>${list.map(r => `
          <tr class="row-link" data-href="#/companies/${r.id}" tabindex="0">
            <td data-label="الشركة" class="title"><span class="company">${esc(r.name)}</span>${r.address ? `<span class="sub">${esc(r.address)}</span>` : ""}</td>
            <td data-label="التصنيف">${esc(KIND[r.kind])}</td>
            <td data-label="السجل التجاري" class="mono">${esc(r.commercial_register) || "—"}</td>
            <td data-label="الهاتف" class="mono" dir="ltr">${esc(r.phone) || "—"}</td>
            <td data-label="المشروعات">${nf.format(r.projects_count)}</td>
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
        <img src="assets/logo.png" alt="" /><div><b>منظومة المتابعة — كتيبة 91 طرق</b><h2>${esc(rep.title)}</h2>
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
      const rows = d.projects.filter(p => !f.status || p.status === f.status).map(p => ({
        code: p.code, name: p.name, location: p.location, status: STATUS[p.status]?.[0], progress: p.progress, contract: p.contract_value,
        companies: p.companies_count, approved: approved[p.id] || 0, open: open[p.id] || 0,
        last: latest[p.id]?.report_date, cond: latest[p.id]?.condition ? COND[latest[p.id].condition][0] : "", obst: latest[p.id]?.obstacles,
      }));
      const sum = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      return { title: "ملخص المشروعات", file: "projects-summary",
        meta: [`الحالة: ${f.status ? STATUS[f.status][0] : "الكل"}`, `عدد المشروعات: ${nf.format(rows.length)}`],
        sections: [{ sheet: "المشروعات", columns: [
          { key: "code", label: "رقم المشروع", w: 14 }, { key: "name", label: "المشروع", w: 32 }, { key: "location", label: "الموقع" },
          { key: "status", label: "الحالة", w: 14 }, { key: "progress", label: "الإنجاز", type: "pct" }, { key: "contract", label: "قيمة التعاقد (ج.م)", type: "money" },
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
    let users = [];
    if (ctx.isAdmin) {
      try { users = await q(sb.from("profiles").select("id,name,username,role,active,created_at").order("active", { ascending: false }).order("name")); }
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
      </section>` : ""}`;
    Object.assign(actions, {
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
    const [, sec = "", id] = (location.hash || "#/").split("/");
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
    if (sec === "projects") id ? projectDetail(id) : projectsList();
    else if (sec === "companies") id ? companyDetail(id) : companiesList();
    else if (sec === "extracts") id ? extractDetail(id) : extractsList();
    else if (sec === "settings") settings();
    else if (sec === "statuses") statusesPage();
    else if (sec === "reports") reportsPage();
    else if (SOON[sec]) soon(SOON[sec]);
    else dashboard();
    window.scrollTo(0, 0);
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
