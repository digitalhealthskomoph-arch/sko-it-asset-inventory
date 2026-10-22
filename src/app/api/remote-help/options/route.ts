import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, requireOfficeNetwork, UUID_RE } from '@/lib/api-auth';
import { ISSUE_TYPES } from '@/lib/tickets';

// Dropdown data for the SKO Help desktop app (office network only).
//   GET                      -> departments + issue types
//   GET ?department_id=<id>  -> personnel of that department
export async function GET(req: Request) {
  try {
    requireOfficeNetwork(req);
    const admin = getSupabaseAdmin();
    const departmentId = new URL(req.url).searchParams.get('department_id');

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

    const { data, error } = await admin.from('departments').select('id, name').order('name');
    if (error) throw error;
    return NextResponse.json({ departments: data ?? [], issueTypes: ISSUE_TYPES });
  } catch (err) {
    return errorResponse(err);
  }
}
