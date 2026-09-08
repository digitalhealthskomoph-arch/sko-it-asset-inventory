'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ArrowLeft, Clock, CheckCircle } from 'lucide-react';
import liff from '@line/liff';

export default function StatusTrackingPage() {
  const [ticketNumber, setTicketNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [searchedTicket, setSearchedTicket] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);
  
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: '2008591648-0lfikgQW' });
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          fetchMyTickets(profile.userId);
        }
      } catch (err) {
        console.error('LIFF init failed', err);
      } finally {
        setInitLoading(false);
      }
    };
    initLiff();
  }, []);

  const fetchMyTickets = async (uid: string) => {
    const { data } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        personnel (first_name, last_name),
        assets (asset_number, brand_model)
      `)
      .eq('line_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) {
      setMyTickets(data);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;

    setLoading(true);
    setSearched(false);
    setSearchedTicket(null);

    // Add 'IT-' prefix automatically
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
      setSearchedTicket(data);
    }
    
    setLoading(false);
    setSearched(true);
  };

  const TicketCard = ({ ticket }: { ticket: any }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 mb-4">
      <div className="flex justify-between items-start border-b border-slate-100 pb-4">
        <div>
          <div className="text-sm text-slate-500 mb-1">รหัสแจ้งซ่อม</div>
          <div className="text-lg font-bold text-slate-800">{ticket.ticket_number}</div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
          ticket.status === 'ปิดงาน' ? 'bg-green-50 text-green-700 border-green-200' :
          ticket.status === 'รอผู้ใช้ยืนยัน' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          ticket.status === 'กำลังดำเนินการ' ? 'bg-purple-50 text-purple-700 border-purple-200' :
          'bg-orange-50 text-orange-700 border-orange-200'
        }`}>
          {ticket.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
        <div>
          <div className="text-slate-500 text-xs mb-0.5">วันที่แจ้ง</div>
          <div className="font-medium text-slate-800">
            {new Date(ticket.created_at).toLocaleDateString('th-TH')}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-xs mb-0.5">ผู้แจ้ง</div>
          <div className="font-medium text-slate-800 line-clamp-1">
            {ticket.personnel?.first_name}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-slate-500 text-xs mb-0.5">อาการเสีย</div>
          <div className="font-medium text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
            {ticket.description}
          </div>
        </div>
        {ticket.resolution_notes && (
          <div className="col-span-2">
            <div className="text-emerald-600 text-xs mb-0.5 font-medium">บันทึกการแก้ไข ({ticket.technician_name})</div>
            <div className="font-medium text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
              {ticket.resolution_notes}
            </div>
          </div>
        )}
      </div>

      {ticket.status === 'รอผู้ใช้ยืนยัน' && (
        <Link href={`/liff/evaluate/${ticket.id}`} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center text-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          ปิดงานและให้คะแนน
        </Link>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative pb-10">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-md sticky top-0 z-10">
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
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="รหัสแจ้งซ่อม (IT-...)"
              className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-sm"
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

        {searched && !searchedTicket && (
          <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 mb-6 shadow-sm">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>ไม่พบข้อมูลรหัส {ticketNumber}</p>
          </div>
        )}

        {searchedTicket && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center">
              <Search className="w-4 h-4 mr-1" /> ผลการค้นหา
            </h2>
            <TicketCard ticket={searchedTicket} />
            <button 
              onClick={() => { setSearchedTicket(null); setSearched(false); setTicketNumber(''); }}
              className="w-full text-center text-sm text-slate-500 py-2"
            >
              ล้างการค้นหา
            </button>
          </div>
        )}

        {!searchedTicket && (
          <>
            <h2 className="text-sm font-bold text-slate-500 mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-1" /> ประวัติการแจ้งซ่อมของคุณ
            </h2>
            
            {initLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : myTickets.length > 0 ? (
              <div>
                {myTickets.map(t => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
                <p className="text-sm">ไม่มีประวัติการแจ้งซ่อมของคุณ</p>
                {!lineUserId && <p className="text-xs text-slate-400 mt-2">(หรือไม่ได้เปิดผ่าน LINE)</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
