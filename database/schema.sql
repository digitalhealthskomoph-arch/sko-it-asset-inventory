-- IT Asset Inventory (Sakaeo PHO)
-- Supabase PostgreSQL Schema

-- 1. Departments (กลุ่มงาน/ฝ่าย)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Personnel (บุคลากร)
CREATE TABLE IF NOT EXISTS public.personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    position TEXT,
    room_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Asset Categories (หมวดหมู่ครุภัณฑ์)
CREATE TABLE IF NOT EXISTS public.asset_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    is_personal BOOLEAN DEFAULT false, -- If true, it usually belongs to a specific person (e.g. PC, Monitor)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Assets (พัสดุครุภัณฑ์)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identity
    asset_number TEXT,
    gf_number TEXT,
    asset_name TEXT, -- Added for Cyber Security Act
    category_id UUID REFERENCES public.asset_categories(id) ON DELETE SET NULL,
    asset_group TEXT, -- Added for Cyber Security Act (e.g., Hardware, Network)
    brand_model TEXT,
    serial_number TEXT, -- Added for Cyber Security Act
    
    -- Ownership & Location
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    personnel_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
    location_details TEXT,
    
    -- Procurement Data
    acquisition_date DATE,
    acquisition_method TEXT,
    budget_type TEXT,
    purchase_price NUMERIC,
    vendor TEXT,
    po_number TEXT,
    warranty_end_date DATE,
    service_life TEXT,
    
    -- Technical Specs
    cpu TEXT,
    ram_gb TEXT,
    storage_type TEXT,
    storage_size_gb TEXT,
    os TEXT,
    
    -- Network & Cyber Security Act Requirements
    ip_address TEXT,
    mac_address TEXT,
    is_network_approved BOOLEAN DEFAULT false,
    connected_components TEXT, -- (devices, applications, OS, networks connected)
    
    -- Survey & Status
    photo_url TEXT,
    status TEXT DEFAULT 'ใช้งาน'::text,
    problem_description TEXT,
    last_check_date DATE,
    proposed_action TEXT,
    est_cost NUMERIC,
    notes TEXT,
    updated_by TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
-- Currently designed for internal IT use, we can enable RLS and allow authenticated users full access
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all authenticated users (since it's only for IT)
CREATE POLICY "Allow authenticated full access on departments" ON public.departments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on personnel" ON public.personnel FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on asset_categories" ON public.asset_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access on assets" ON public.assets FOR ALL TO authenticated USING (true);
