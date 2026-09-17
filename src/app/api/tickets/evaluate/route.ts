import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, rating, feedback } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม (ticketId)' }, { status: 400 });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'กรุณาให้คะแนนความพึงพอใจ 1 - 5 ดาว' }, { status: 400 });
    }

    // Update ticket in database using service role (bypassing RLS)
    const { data, error } = await supabaseAdmin
      .from('repair_tickets')
      .update({
        status: 'ปิดงาน',
        rating: Math.round(numericRating),
        feedback: feedback ? String(feedback).trim() : null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('Error updating ticket evaluation:', error);
      return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'ไม่พบใบแจ้งซ่อมรหัสนี้ในระบบ' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket: data,
    });
  } catch (err: any) {
    console.error('Evaluate API error:', err);
    return NextResponse.json({ error: err.message || 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
