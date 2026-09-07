CREATE POLICY "Allow anonymous read on asset_categories" ON public.asset_categories FOR SELECT TO anon USING (true);
