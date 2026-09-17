-- Allow anonymous users to update tickets specifically for closing and evaluation
-- Note: The application now processes evaluations securely via the /api/tickets/evaluate backend route,
-- but this policy can also be enabled in Supabase SQL Editor if direct client-side updates are desired.

CREATE POLICY "Allow anonymous evaluate on repair_tickets"
ON public.repair_tickets
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
