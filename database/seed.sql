-- IT Asset Inventory (Sakaeo PHO)
-- Seed Data

-- Clear existing data (optional, for testing)
-- DELETE FROM public.assets;
-- DELETE FROM public.personnel;
-- DELETE FROM public.departments;
-- DELETE FROM public.asset_categories;

-- Insert Departments
INSERT INTO public.departments (name) VALUES
('ผู้บริหาร'),
('บริหารทรัพยากรบุคคล'),
('พัฒนาทรัพยากรบุคคล'),
('กลุ่มกฎหมาย'),
('พัฒนายุทธศาสตร์สาธารณสุข'),
('สุขภาพดิจิทัล'),
('คุ้มครองผู้บริโภค'),
('พัฒนาคุณภาพและรูปแบบบริการ'),
('ควบคุมโรคติดต่อ'),
('ประกันสุขภาพ'),
('ส่งเสริมสุขภาพ'),
('ทันตสาธารณสุข'),
('พัสดุ'),
('การเงินบัญชี'),
('ยานพาหนะ'),
('ช่างโยธา'),
('ธุรการ'),
('อนามัยสิ่งแวดล้อมและอาชีวอนามัย'),
('ควบคุมโรคไม่ติดต่อ'),
('กลุ่มงานปฐมภูมิและเครือข่ายสุขภาพ'),
('การแพทย์แผนไทยและการแพทย์ทางเลือก'),
('เลขานุการและอำนวยการ')
ON CONFLICT DO NOTHING;

-- Personnel (staff names) are personal data and are not stored in git.
-- Load them from database/seed_personnel.local.sql (git-ignored) or import via the dashboard.

-- Insert Asset Categories
INSERT INTO public.asset_categories (name, is_personal) VALUES
('Computer (PC)', true),
('Notebook/Laptop', true),
('Monitor', true),
('UPS', true),
('Printer', false),
('Scanner', false),
('Server', false),
('Network Switch', false),
('Access Point', false),
('Tablet/iPad', true)
ON CONFLICT DO NOTHING;
