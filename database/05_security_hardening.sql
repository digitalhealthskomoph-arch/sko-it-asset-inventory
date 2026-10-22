-- 05_security_hardening.sql
-- Locks the database down to staff accounts listed in public.staff_users.
-- Anonymous (LIFF) visitors keep read access to departments/asset_categories only;
-- everything else the LIFF pages need now goes through server API routes.
--
-- Run once in the Supabase SQL Editor AFTER deploying the matching app code.
-- Safe to re-run.

BEGIN;

-- 1. Staff allow-list -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Every account that exists today is assumed to be IT staff.
-- Review the list afterwards: SELECT * FROM public.staff_users;
INSERT INTO public.staff_users (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_users WHERE user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DROP POLICY IF EXISTS "Staff can read staff_users" ON public.staff_users;
CREATE POLICY "Staff can read staff_users" ON public.staff_users
    FOR SELECT TO authenticated USING (public.is_staff());

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
