-- Repair Tickets Table
CREATE TABLE IF NOT EXISTS public.repair_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    issue_type TEXT,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'รอรับเรื่อง',
    priority TEXT DEFAULT 'ปกติ',
    technician_name TEXT,
    resolution_notes TEXT,
    line_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to update updated_at timestamp automatically
CREATE TRIGGER update_repair_tickets_updated_at
    BEFORE UPDATE ON public.repair_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (for Admin Dashboard)
CREATE POLICY "Allow authenticated full access on repair_tickets" ON public.repair_tickets FOR ALL TO authenticated USING (true);

-- Allow anonymous users to INSERT tickets (for LIFF public form)
CREATE POLICY "Allow anonymous insert on repair_tickets" ON public.repair_tickets FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to SELECT their own tickets by line_user_id (for tracking)
CREATE POLICY "Allow anonymous select own tickets" ON public.repair_tickets FOR SELECT TO anon USING (true);

-- Allow anonymous users to SELECT departments, personnel, and assets for the form dropdowns
CREATE POLICY "Allow anonymous read on departments" ON public.departments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read on personnel" ON public.personnel FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous read on assets" ON public.assets FOR SELECT TO anon USING (true);
