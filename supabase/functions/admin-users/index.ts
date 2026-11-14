// منظومة المتابعة — إدارة المستخدمين (للمدير فقط)
// العمليات اللي محتاجة مفتاح الخدمة (ما ينفعش يبقى في المتصفح):
//   create        إنشاء حساب: { username, name, password, role }
//   set_password  تعيين كلمة مرور جديدة لمستخدم: { id, password }
//   set_active    إيقاف/تفعيل حساب: { id, active }  — الإيقاف بيمنع الدخول نفسه كمان (ban)
// تعديل الاسم والصلاحية بيتم من المتصفح مباشرة (مسموح للمدير فقط بقواعد RLS).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const DOMAIN = "monazoma.local";
const ROLES = ["admin", "editor", "viewer"];
const USERNAME = /^[a-z][a-z0-9._-]{2,29}$/;
const MIN_PASSWORD = 8;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, status = 400) => reply({ error: code }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // مين اللي بيطلب؟ لازم يكون مدير نشط
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return fail("unauthorized", 401);
  const { data: me } = await admin.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) return fail("forbidden", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("bad_request"); }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  switch (body.action) {
    case "create": {
      const username = str(body.username).toLowerCase(), name = str(body.name), role = str(body.role) || "viewer";
      const password = typeof body.password === "string" ? body.password : "";
      if (!USERNAME.test(username)) return fail("bad_username");
      if (!name || name.length > 100) return fail("bad_name");
      if (password.length < MIN_PASSWORD) return fail("weak_password");
      if (!ROLES.includes(role)) return fail("bad_role");
      const { data, error } = await admin.auth.admin.createUser({
        email: `${username}@${DOMAIN}`, password, email_confirm: true, user_metadata: { name },
      });
      if (error) return fail(/already|exists|registered/i.test(error.message) ? "username_taken" : (/password/i.test(error.message) ? "weak_password" : "create_failed"));
      const { error: e2 } = await admin.from("profiles").update({ role, name }).eq("id", data.user.id);
      if (e2) return fail("create_failed", 500);
      return reply({ id: data.user.id });
    }

    case "set_password": {
      const id = str(body.id), password = typeof body.password === "string" ? body.password : "";
      if (!id) return fail("bad_request");
      if (password.length < MIN_PASSWORD) return fail("weak_password");
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return fail(/password/i.test(error.message) ? "weak_password" : "update_failed");
      return reply({ ok: true });
    }

    case "set_active": {
      const id = str(body.id), active = body.active === true;
      if (!id) return fail("bad_request");
      if (id === user.id && !active) return fail("cannot_disable_self");
      const { error } = await admin.from("profiles").update({ active }).eq("id", id);
      if (error) return fail(error.hint === "last_admin" || /مدير نشط/.test(error.message) ? "last_admin" : "update_failed");
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
      if (e2) return fail("update_failed", 500);
      return reply({ ok: true });
    }

    default:
      return fail("bad_request");
  }
});
