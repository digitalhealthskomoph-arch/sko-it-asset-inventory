'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ArrowLeft } from 'lucide-react';

export default function StatusTrackingPage() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;

    setLoading(true);
    setSearched(false);
    setTicket(null);

    // Add 'IT-' prefix automatically if user just typed numbers
    let searchId = ticketNumber.trim().toUpperCase();
    if (/^\d+$/.test(searchId)) {
      const year = new Date().getFullYear() + 543;
      searchId = `IT-${year.toString().slice(2)}${searchId}`;
    }

    const { data, error } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        personnel (first_name, last_name),
        assets (asset_number, brand_model)
      `)
      .eq('ticket_number', searchId)
      .single();

    if (data && !error) {
      setTicket(data);
    }
    
    setLoading(false);
    setSearched(true);
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm relative pb-10">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/liff" className="p-2 hover:bg-white/20 rounded-lg transition-colors -ml-2">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="bg-white/20 p-2 rounded-lg">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ติดตามสถานะ</h1>
            <p className="text-emerald-100 text-sm">ตรวจสอบความคืบหน้างานซ่อม</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form onSubmit={handleSearch} className="mb-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            รหัสใบแจ้งซ่อม (เช่น IT-26xxxx)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="กรอกรหัสแจ้งซ่อม..."
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl font-medium transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </form>

        {searched && !ticket && (
          <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>ไม่พบข้อมูลการแจ้งซ่อม</p>
            <p className="text-xs mt-1">โปรดตรวจสอบรหัสใบแจ้งซ่อมอีกครั้ง</p>
          </div>
        )}

        {ticket && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="text-sm text-slate-500 mb-1">รหัสแจ้งซ่อม</div>
                <div className="text-xl font-bold text-slate-800">{ticket.ticket_number}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                ticket.status === 'เสร็จสิ้น' ? 'bg-green-50 text-green-700 border-green-200' :
                ticket.status === 'กำลังดำเนินการ' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-orange-50 text-orange-700 border-orange-200'
              }`}>
                {ticket.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div>
                <div className="text-slate-500 mb-0.5">วันที่แจ้ง</div>
                <div className="font-medium text-slate-800">
                  {new Date(ticket.created_at).toLocaleDateString('th-TH')}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">ผู้แจ้ง</div>
                <div className="font-medium text-slate-800">
                  {ticket.personnel?.first_name} {ticket.personnel?.last_name}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-slate-500 mb-0.5">อาการเสีย</div>
                <div className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {ticket.description}
                </div>
              </div>
              {ticket.resolution_notes && (
                <div className="col-span-2">
                  <div className="text-emerald-600 mb-0.5 font-medium">บันทึกการแก้ไขจากช่าง</div>
                  <div className="font-medium text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    {ticket.resolution_notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
