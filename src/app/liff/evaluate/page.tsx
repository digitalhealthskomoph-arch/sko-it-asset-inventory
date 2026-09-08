'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Star, CheckCircle, ArrowLeft } from 'lucide-react';
import liff from '@line/liff';

const LIFF_EVALUATE_ID = '2008591648-wGRKxePd';

function EvaluateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = searchParams.get('ticketId');

  const [ticket, setTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    liff.init({ liffId: LIFF_EVALUATE_ID }).catch(console.error);
    if (ticketId) fetchTicket(ticketId);
    else setLoading(false);
  }, [ticketId]);

  const fetchTicket = async (id: string) => {
    const { data } = await supabase
      .from('repair_tickets')
      .select('*, personnel(first_name, last_name)')
      .eq('id', id)
      .single();
    if (data) setTicket(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (rating === 0) return alert('กรุณาให้คะแนนความพึงพอใจ');
    setSubmitting(true);
    const { error } = await supabase
      .from('repair_tickets')
      .update({ status: 'ปิดงาน', rating, feedback, closed_at: new Date().toISOString() })
      .eq('id', ticketId);
    setSubmitting(false);
    if (!error) setSuccess(true);
    else alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!ticketId || !ticket) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-medium">ไม่พบรหัสงานที่ต้องการประเมิน</p>
        <p className="text-sm mt-2">กรุณาพิมพ์ "ปิดงาน" ในแชท LINE เพื่อรับลิงก์ที่ถูกต้องครับ</p>
      </div>
    );
  }

  if (success || ticket.status === 'ปิดงาน') {
    return (
      <div className="max-w-md mx-auto bg-slate-50 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center w-full">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">บันทึกการปิดงานสำเร็จ!</h2>
          <p className="text-slate-500 text-sm mb-6">ขอบคุณสำหรับการประเมินความพึงพอใจ<br/>ทีมงาน IT จะนำไปปรับปรุงให้ดียิ่งขึ้นครับ</p>
          <button
            onClick={() => { if (liff.isInClient()) liff.closeWindow(); }}
            className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium w-full"
          >ปิดหน้าต่าง</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-10">
      <div className="bg-blue-600 text-white p-6 rounded-b-3xl shadow-md">
        <h1 className="text-xl font-bold">ประเมินผลและปิดงาน</h1>
        <p className="text-blue-100 text-sm">{ticket.ticket_number}</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">สรุปการซ่อม</h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs">อาการเสีย</div>
              <div className="font-medium">{ticket.description}</div>
            </div>
            {ticket.resolution_notes && (
              <div>
                <div className="text-emerald-600 text-xs font-bold">ช่าง ({ticket.technician_name}) แก้ไขโดย:</div>
                <div className="font-medium text-emerald-800 bg-emerald-50 p-2 rounded mt-1">{ticket.resolution_notes}</div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
          <h2 className="font-bold text-slate-800 mb-4">คุณพึงพอใจการบริการระดับใด?</h2>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none p-1 transition-transform hover:scale-110">
                <Star className={`w-10 h-10 ${(hoverRating || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-200'} transition-colors`} />
              </button>
            ))}
          </div>
          <div className="text-left mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
            <textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              placeholder="พิมพ์ข้อเสนอแนะ..." />
          </div>
          <button onClick={handleSubmit} disabled={rating === 0 || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center disabled:opacity-50">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ยืนยันปิดงานและส่งประเมิน'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <EvaluateContent />
    </Suspense>
  );
}
