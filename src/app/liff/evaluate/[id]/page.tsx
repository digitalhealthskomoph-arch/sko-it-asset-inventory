'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Star, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import liff from '@line/liff';

export default function EvaluatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [ticket, setTicket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Initialize LIFF just so we know we are in LINE context (optional here)
    liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' }).catch(console.error);
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    const { data } = await supabase
      .from('repair_tickets')
      .select('*, personnel(first_name, last_name)')
      .eq('id', id)
      .single();
    
    if (data) {
      setTicket(data);
      if (data.rating) setRating(data.rating); // Already rated?
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (rating === 0) return alert('กรุณาให้คะแนนความพึงพอใจ');
    
    setSubmitting(true);
    const { error } = await supabase
      .from('repair_tickets')
      .update({
        status: 'ปิดงาน',
        rating: rating,
        feedback: feedback,
        closed_at: new Date().toISOString()
      })
      .eq('id', id);

    setSubmitting(false);
    if (!error) {
      setSuccess(true);
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!ticket) {
    return <div className="p-8 text-center text-slate-500">ไม่พบใบแจ้งซ่อมรหัสนี้</div>;
  }

  if (success || ticket.status === 'ปิดงาน') {
    return (
      <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center w-full">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">บันทึกการปิดงานสำเร็จ!</h2>
          <p className="text-slate-500 text-sm mb-6">ขอบคุณสำหรับการประเมินความพึงพอใจ<br/>ทีมงาน IT จะนำไปปรับปรุงให้ดียิ่งขึ้นครับ</p>
          <button 
            onClick={() => {
              if (liff.isInClient()) liff.closeWindow();
              else router.push('/liff/status');
            }}
            className="bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium w-full"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative pb-10">
      <div className="bg-blue-600 text-white p-6 rounded-b-3xl shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/liff/status" className="p-2 hover:bg-white/20 rounded-lg transition-colors -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">ประเมินผลและปิดงาน</h1>
            <p className="text-blue-100 text-sm">รหัส {ticket.ticket_number}</p>
          </div>
        </div>
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
                <div className="font-medium text-emerald-800 bg-emerald-50 p-2 rounded mt-1">
                  {ticket.resolution_notes}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
          <h2 className="font-bold text-slate-800 mb-2">คุณพึงพอใจการบริการระดับใด?</h2>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    (hoverRating || rating) >= star 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'fill-slate-100 text-slate-200'
                  } transition-colors`}
                />
              </button>
            ))}
          </div>
          
          <div className="text-left mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
            <textarea
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              placeholder="พิมพ์ข้อเสนอแนะ..."
            />
          </div>

          <button 
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ยืนยันปิดงานและส่งประเมิน'}
          </button>
        </div>
      </div>
    </div>
  );
}
