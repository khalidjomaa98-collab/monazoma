-- أي مستخدم نشط يشوف أسماء وصلاحيات زملائه (لعرض «مين غيّر الحالة» في سجل المستخلصات).
-- التعديل والحذف ما زالا للمدير فقط.
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_active_user()));
