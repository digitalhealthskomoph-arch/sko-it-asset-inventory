-- 05a_staff_users.sql  (run FIRST — safe while the old app version is still live)
-- Creates the staff allow-list used by the new app code. Changes no existing policy.
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

COMMIT;

-- Review the list: remove anyone who is not IT staff before running 05b.
-- SELECT * FROM public.staff_users;
-- DELETE FROM public.staff_users WHERE email = 'unknown@example.com';
