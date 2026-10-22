import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, lineUserFromRequest, UUID_RE } from '@/lib/api-auth';
import { notifyTechnicianGroup } from '@/lib/line-notify';
import { publicUrlForKey } from '@/lib/r2';

// Columns a requester may see about a ticket (no line_user_id, no internal ids of other rows).
const PUBLIC_TICKET_COLUMNS =
  'id, ticket_number, issue_type, description, status, technician_name, resolution_notes, rating, feedback, created_at, closed_at, personnel (first_name, last_name), assets (asset_number, brand_model)';

const TICKET_NUMBER_RE = /^IT-\d{6,10}$/;
// Must match the <option> values in src/app/liff/repair/page.tsx
const ISSUE_TYPES = ['Hardware', 'Software', 'Network', 'Plan-D', 'ช่วยดึงข้อมูล', 'Other'];

function normalizeTicketNumber(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  const withPrefix = value.startsWith('IT-') ? value : `IT-${value}`;
  return TICKET_NUMBER_RE.test(withPrefix) ? withPrefix : null;
}

/**
 * GET /api/liff/tickets
 *   ?id=<uuid>                 one ticket (the UUID in the LINE link acts as the access key)
 *   ?numbers=IT-1,IT-2         exact ticket numbers (max 15) saved on the device or typed in
 *   (no params)                tickets of the verified LINE user (x-line-access-token header)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const id = searchParams.get('id');
    if (id && !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'รหัสใบแจ้งซ่อมไม่ถูกต้อง' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (id) {
      const { data, error } = await admin.from('repair_tickets').select(PUBLIC_TICKET_COLUMNS).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'ไม่พบใบแจ้งซ่อม' }, { status: 404 });
      return NextResponse.json({ ticket: data });
    }

    const numbersParam = searchParams.get('numbers');
    if (numbersParam) {
      const numbers = [...new Set(numbersParam.split(',').map(normalizeTicketNumber).filter((n): n is string => !!n))].slice(0, 15);
      if (numbers.length === 0) return NextResponse.json({ tickets: [] });
      const { data, error } = await admin
        .from('repair_tickets')
        .select(PUBLIC_TICKET_COLUMNS)
        .in('ticket_number', numbers)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ tickets: data ?? [] });
    }

    const lineUserId = await lineUserFromRequest(req);
    if (!lineUserId) return NextResponse.json({ tickets: [] });
    const { data, error } = await admin
      .from('repair_tickets')
      .select(PUBLIC_TICKET_COLUMNS)
      .eq('line_user_id', lineUserId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw error;
    return NextResponse.json({ tickets: data ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/liff/tickets — create a repair ticket from the LIFF form, then notify technicians. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const departmentId = String(body.department_id || '');
    const personnelId = String(body.personnel_id || '');
    const assetId = body.asset_id ? String(body.asset_id) : null;
    const issueType = ISSUE_TYPES.includes(body.issue_type) ? body.issue_type : 'Other';
    const description = String(body.description || '').trim();
    const imageKey = body.image_key ? String(body.image_key) : null;

    if (!UUID_RE.test(departmentId) || !UUID_RE.test(personnelId) || (assetId && !UUID_RE.test(assetId))) {
      return NextResponse.json({ error: 'กรุณาเลือกกลุ่มงานและผู้แจ้งให้ถูกต้อง' }, { status: 400 });
    }
    if (!description || description.length > 2000) {
      return NextResponse.json({ error: 'กรุณากรอกรายละเอียดอาการ (ไม่เกิน 2000 ตัวอักษร)' }, { status: 400 });
    }
    // Only accept images uploaded through /api/upload for repair tickets.
    if (imageKey && !/^repair\/[0-9a-f-]{36}\.(jpg|png|webp|gif|heic)$/.test(imageKey)) {
      return NextResponse.json({ error: 'ไฟล์รูปภาพไม่ถูกต้อง' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // The requester must belong to the chosen department, and the asset to the requester.
    const { data: person } = await admin
      .from('personnel')
      .select('id, first_name, last_name, department_id, departments (name)')
      .eq('id', personnelId)
      .maybeSingle();
    if (!person || person.department_id !== departmentId) {
      return NextResponse.json({ error: 'ข้อมูลผู้แจ้งไม่ตรงกับกลุ่มงาน' }, { status: 400 });
    }

    let assetInfo = '';
    if (assetId) {
      const { data: asset } = await admin
        .from('assets')
        .select('id, asset_number, brand_model, personnel_id')
        .eq('id', assetId)
        .maybeSingle();
      if (!asset || asset.personnel_id !== personnelId) {
        return NextResponse.json({ error: 'อุปกรณ์ไม่ตรงกับผู้แจ้ง' }, { status: 400 });
      }
      assetInfo = `${asset.asset_number || '-'} (${asset.brand_model || '-'})`;
    }

    // Invalid token -> 401; missing token -> anonymous ticket (opened outside LINE).
    const lineUserId = await lineUserFromRequest(req);
    const imageUrl = imageKey ? publicUrlForKey(imageKey) : null;

    const thaiYear = (new Date().getFullYear() + 543).toString().slice(2);
    let ticketNumber = '';
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      ticketNumber = `IT-${thaiYear}${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
      const { error } = await admin.from('repair_tickets').insert({
        ticket_number: ticketNumber,
        department_id: departmentId,
        personnel_id: personnelId,
        asset_id: assetId,
        issue_type: issueType,
        description,
        image_url: imageUrl,
        line_user_id: lineUserId,
        status: 'รอรับเรื่อง',
      });
      if (!error) inserted = true;
      else if (error.code !== '23505') throw error; // 23505 = duplicate ticket_number, retry
    }
    if (!inserted) throw new Error('Could not allocate a unique ticket number');

    const dept = person.departments as { name?: string } | { name?: string }[] | null;
    const deptName = (Array.isArray(dept) ? dept[0]?.name : dept?.name) || '';
    try {
      await notifyTechnicianGroup({
        ticketNumber,
        requesterName: `${person.first_name} ${person.last_name}`,
        department: deptName,
        issueType,
        assetInfo,
        description,
        imageUrl,
      });
    } catch (notifyErr) {
      // The ticket is saved; a failed LINE push must not fail the request.
      console.error('Notify technician error:', notifyErr);
    }

    return NextResponse.json({ success: true, ticketNumber });
  } catch (err) {
    return errorResponse(err, 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}
