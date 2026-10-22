import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, UUID_RE } from '@/lib/api-auth';

// Dropdown data for the public LIFF repair form. Returns only the columns the form
// needs, so anonymous visitors never see IP/MAC/serial or other asset details.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('department_id');
    const personnelId = searchParams.get('personnel_id');
    const admin = getSupabaseAdmin();

    if (departmentId) {
      if (!UUID_RE.test(departmentId)) return NextResponse.json({ error: 'รหัสกลุ่มงานไม่ถูกต้อง' }, { status: 400 });
      const { data, error } = await admin
        .from('personnel')
        .select('id, first_name, last_name')
        .eq('department_id', departmentId)
        .order('first_name');
      if (error) throw error;
      return NextResponse.json({ personnel: data ?? [] });
    }

    if (personnelId) {
      if (!UUID_RE.test(personnelId)) return NextResponse.json({ error: 'รหัสบุคลากรไม่ถูกต้อง' }, { status: 400 });
      const { data, error } = await admin
        .from('assets')
        .select('id, asset_number, brand_model, category_id')
        .eq('personnel_id', personnelId);
      if (error) throw error;
      return NextResponse.json({ assets: data ?? [] });
    }

    return NextResponse.json({ error: 'ต้องระบุ department_id หรือ personnel_id' }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
