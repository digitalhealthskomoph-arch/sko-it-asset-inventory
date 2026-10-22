-- 05b_lockdown_policies.sql  (run SECOND — right after the new app code is live in production)
-- Removes anonymous access and restricts every table to staff listed in public.staff_users.
-- Requires 05a_staff_users.sql. Safe to re-run.

BEGIN;

-- 2. Remove anonymous access that exposed or allowed editing of data -------
DROP POLICY IF EXISTS "Allow anonymous insert on repair_tickets" ON public.repair_tickets;
DROP POLICY IF EXISTS "Allow anonymous select own tickets" ON public.repair_tickets;
DROP POLICY IF EXISTS "Allow anonymous evaluate on repair_tickets" ON public.repair_tickets;
DROP POLICY IF EXISTS "Allow anonymous read on personnel" ON public.personnel;
DROP POLICY IF EXISTS "Allow anonymous read on assets" ON public.assets;
-- Kept on purpose (LIFF form dropdowns, no sensitive columns):
--   "Allow anonymous read on departments", "Allow anonymous read on asset_categories"

-- 3. "Any logged-in user" -> "staff only" ----------------------------------
DROP POLICY IF EXISTS "Allow authenticated full access on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow authenticated full access on personnel" ON public.personnel;
DROP POLICY IF EXISTS "Allow authenticated full access on asset_categories" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow authenticated full access on assets" ON public.assets;
DROP POLICY IF EXISTS "Allow authenticated full access on repair_tickets" ON public.repair_tickets;

DROP POLICY IF EXISTS "Staff full access on departments" ON public.departments;
DROP POLICY IF EXISTS "Staff full access on personnel" ON public.personnel;
DROP POLICY IF EXISTS "Staff full access on asset_categories" ON public.asset_categories;
DROP POLICY IF EXISTS "Staff full access on assets" ON public.assets;
DROP POLICY IF EXISTS "Staff full access on repair_tickets" ON public.repair_tickets;

CREATE POLICY "Staff full access on departments" ON public.departments
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff full access on personnel" ON public.personnel
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff full access on asset_categories" ON public.asset_categories
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff full access on assets" ON public.assets
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "Staff full access on repair_tickets" ON public.repair_tickets
    FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMIT;

-- 4. Check for policies created outside this repo (run and review the output):
-- SELECT tablename, policyname, roles, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
--
-- To add a new staff account later:
-- INSERT INTO public.staff_users (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'new.staff@example.com';
