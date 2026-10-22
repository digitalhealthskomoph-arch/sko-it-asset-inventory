import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, requireStaff } from '@/lib/api-auth';
import { runProcurementSync } from '@/lib/procurement-sync';

export async function POST(req: NextRequest) {
  try {
    await requireStaff(req);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ Excel ที่อัปโหลด' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (จำกัด 10MB)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: 'ไม่พบแผ่นงาน (Sheet) ในไฟล์ Excel' }, { status: 400 });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const excelRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    if (!excelRows || excelRows.length === 0) {
      return NextResponse.json({ error: 'ไฟล์ Excel ไม่มีข้อมูล' }, { status: 400 });
    }

    const summary = await runProcurementSync(excelRows, getSupabaseAdmin());

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    return errorResponse(error, 'เกิดข้อผิดพลาดในการซิงค์ข้อมูลพัสดุ');
  }
}
