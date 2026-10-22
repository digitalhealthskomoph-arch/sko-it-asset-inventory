import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, lineUserFromRequest, UUID_RE } from '@/lib/api-auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, rating, feedback } = body;

    if (!ticketId || !UUID_RE.test(String(ticketId))) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม (ticketId)' }, { status: 400 });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'กรุณาให้คะแนนความพึงพอใจ 1 - 5 ดาว' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: ticket } = await supabaseAdmin
      .from('repair_tickets')
      .select('id, status, rating, line_user_id')
      .eq('id', ticketId)
      .maybeSingle();

    if (!ticket) {
      return NextResponse.json({ error: 'ไม่พบใบแจ้งซ่อมรหัสนี้ในระบบ' }, { status: 404 });
    }

    // Only a job the technician has finished can be closed, and only once.
    const canEvaluate =
      ticket.status === 'รอผู้ใช้ยืนยัน' || (ticket.status === 'ปิดงาน' && ticket.rating == null);
    if (!canEvaluate) {
      return NextResponse.json({ error: 'ใบแจ้งซ่อมนี้ยังไม่พร้อมให้ประเมิน หรือประเมินไปแล้ว' }, { status: 409 });
    }

    // If both the ticket and the caller have a LINE identity, they must match.
    const lineUserId = await lineUserFromRequest(req);
    if (lineUserId && ticket.line_user_id && lineUserId !== ticket.line_user_id) {
      return NextResponse.json({ error: 'ใบแจ้งซ่อมนี้ไม่ใช่ของบัญชี LINE นี้' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('repair_tickets')
      .update({
        status: 'ปิดงาน',
        rating: Math.round(numericRating),
        feedback: feedback ? String(feedback).trim().slice(0, 1000) : null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select('id, ticket_number, status, rating, feedback, closed_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      ticket: data,
    });
  } catch (err) {
    return errorResponse(err, 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}
