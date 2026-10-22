-- 06_remote_help.sql
-- Remote help requests sent by the desktop app "SKO Help" (tools/sko-help) and an audit log
-- of remote actions. Requires 05a_staff_users.sql (public.is_staff()). Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.remote_help_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.repair_tickets(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,

    -- What the app reported about the computer
    hostname TEXT,
    windows_user TEXT,
    ip_address TEXT,
    mac_addresses TEXT[],
    serial_number TEXT,
    os_name TEXT,
    match_method TEXT,                    -- 'mac' | 'serial' | null (not matched to an asset)

    -- Windows Remote Assistance invitation; wiped when the request expires or is closed
    invitation_file TEXT,                 -- base64 of the .msrcincident file
    invitation_password TEXT,

    status TEXT NOT NULL DEFAULT 'waiting',   -- 'waiting' | 'in_progress' | 'closed' | 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    opened_by TEXT,                       -- staff email that first downloaded the invitation
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS remote_help_requests_status_idx ON public.remote_help_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS remote_help_requests_asset_idx ON public.remote_help_requests (asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.remote_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.remote_help_requests(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    ticket_id UUID REFERENCES public.repair_tickets(id) ON DELETE SET NULL,
    staff_user_id UUID,
    staff_email TEXT,
    action TEXT NOT NULL,                 -- 'OPEN_INVITATION' | 'LINK_ASSET' | 'CLOSE'
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS remote_action_logs_asset_idx ON public.remote_action_logs (asset_id, created_at DESC);

-- Only staff can see these tables; the app writes through the server API (service role).
ALTER TABLE public.remote_help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read remote_help_requests" ON public.remote_help_requests;
CREATE POLICY "Staff read remote_help_requests" ON public.remote_help_requests
    FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff read remote_action_logs" ON public.remote_action_logs;
CREATE POLICY "Staff read remote_action_logs" ON public.remote_action_logs
    FOR SELECT TO authenticated USING (public.is_staff());

COMMIT;
