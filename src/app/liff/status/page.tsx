'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, ArrowLeft, Clock, CheckCircle, Wrench, RefreshCw } from 'lucide-react';
import liff from '@line/liff';

export default function StatusTrackingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searched, setSearched] = useState(false);
  
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [lineUserId, setLineUserId] = useState<string | null>(null);

  useEffect(() => {
    const initPage = async () => {
      let uid = sessionStorage.getItem('liff_user_id');

      // Initialize LIFF to get user ID if not in session
      if (!uid) {
        try {
          await liff.init({ liffId: '2008591648-wGRKxePd' });
          if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            uid = profile.userId;
            sessionStorage.setItem('liff_user_id', uid);
          }
        } catch (err) {
          console.error('LIFF init in status page:', err);
        }
      }

      if (uid) setLineUserId(uid);
      await fetchMyTickets(uid);
    };

    initPage();
  }, []);

  const fetchMyTickets = async (uid: string | null) => {
    setInitLoading(true);
    try {
      let savedTicketNums: string[] = [];
      try {
        savedTicketNums = JSON.parse(localStorage.getItem('my_ticket_numbers') || '[]');
      } catch (e) {}

      let dataList: any[] = [];

      // 1. Fetch by line_user_id if available
      if (uid) {
        const { data: uidData } = await supabase
          .from('repair_tickets')
          .select(`
            *,
            personnel (first_name, last_name),
            assets (asset_number, brand_model)
          `)
          .eq('line_user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10);

        if (uidData) {
          dataList = [...uidData];
        }
      }

      // 2. Fetch by saved ticket numbers from local device (merging results)
      if (savedTicketNums.length > 0) {
        const existingIds = new Set(dataList.map(t => t.id));
        const { data: savedData } = await supabase
          .from('repair_tickets')
          .select(`
            *,
            personnel (first_name, last_name),
            assets (asset_number, brand_model)
          `)
          .in('ticket_number', savedTicketNums)
          .order('created_at', { ascending: false })
          .limit(10);

        if (savedData) {
          for (const item of savedData) {
            if (!existingIds.has(item.id)) {
              dataList.push(item);
              existingIds.add(item.id);
            }
          }
        }
      }

      setMyTickets(dataList);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setInitLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    setLoading(true);
    setSearched(true);
    setSearchResults(null);

    try {
      let searchId = query.toUpperCase();
      const isDigitsOnly = /^\d+$/.test(searchId);

      if (isDigitsOnly) {
        const year = new Date().getFullYear() + 543;
        searchId = `IT-${year.toString().slice(2)}${searchId}`;
      }

      let results: any[] = [];

      // 1. If it looks like a ticket number
      if (searchId.startsWith('IT-') || isDigitsOnly) {
        const { data } = await supabase
          .from('repair_tickets')
          .select(`
            *,
            personnel (first_name, last_name),
            assets (asset_number, brand_model)
          `)
          .eq('ticket_number', searchId);

        if (data && data.length > 0) results = data;
      }

      // 2. If no ticket found by ID, search by description or symptom
      if (results.length === 0) {
        const { data } = await supabase
          .from('repair_tickets')
          .select(`
            *,
            personnel (first_name, last_name),
            assets (asset_number, brand_model)
          `)
          .ilike('description', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(5);

        if (data && data.length > 0) results = data;
      }

      // Save found ticket numbers to local device storage
      if (results.length > 0) {
        try {
          const saved: string[] = JSON.parse(localStorage.getItem('my_ticket_numbers') || '[]');
          for (const item of results) {
            if (!saved.includes(item.ticket_number)) {
              saved.unshift(item.ticket_number);
            }
          }
          localStorage.setItem('my_ticket_numbers', JSON.stringify(saved.slice(0, 15)));
        } catch (e) {}
      }

      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const TicketCard = ({ ticket }: { ticket: any }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 mb-4 transition-all hover:border-emerald-300">
      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
        <div>
          <div className="text-xs text-slate-400 font-medium">รหัสแจ้งซ่อม</div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">{ticket.ticket_number}</div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
          ticket.status === 'ปิดงาน' ? 'bg-green-50 text-green-700 border-green-200' :
          ticket.status === 'รอผู้ใช้ยืนยัน' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
          ticket.status === 'กำลังดำเนินการ' ? 'bg-purple-50 text-purple-700 border-purple-200' :
          'bg-orange-50 text-orange-700 border-orange-200'
        }`}>
          {ticket.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-sm">
        <div>
          <div className="text-slate-400 text-xs">วันที่แจ้ง</div>
          <div className="font-medium text-slate-800">
            {new Date(ticket.created_at).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">ผู้แจ้ง</div>
          <div className="font-medium text-slate-800 line-clamp-1">
            {ticket.personnel ? `${ticket.personnel.first_name} ${ticket.personnel.last_name || ''}` : '-'}
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-slate-400 text-xs mb-1">อาการเสีย</div>
          <div className="font-medium text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-sm">
            {ticket.description}
          </div>
        </div>
        {ticket.resolution_notes && (
          <div className="col-span-2">
            <div className="text-emerald-600 text-xs mb-1 font-semibold">
              บันทึกการแก้ไข {ticket.technician_name ? `(${ticket.technician_name})` : ''}
            </div>
            <div className="font-medium text-emerald-900 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-sm">
              {ticket.resolution_notes}
            </div>
          </div>
        )}
      </div>

      {ticket.status === 'รอผู้ใช้ยืนยัน' && (
        <Link
          href={`/liff/evaluate?ticketId=${ticket.id}`}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center text-sm shadow-sm"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          ⭐ ประเมินความพึงพอใจและปิดงาน
        </Link>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen relative pb-10">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/liff/repair" className="p-2 hover:bg-white/20 rounded-lg transition-colors -ml-2">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="bg-white/20 p-2 rounded-lg">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ติดตามสถานะงานซ่อม</h1>
              <p className="text-emerald-100 text-xs">ตรวจสอบความคืบหน้างานของคุณ</p>
            </div>
          </div>
          <button
            onClick={() => fetchMyTickets(lineUserId)}
            className="p-2 hover:bg-white/20 rounded-lg text-emerald-100 hover:text-white transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาด้วยรหัส (เช่น 697552) หรืออาการ"
              className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl font-medium transition-colors disabled:opacity-70 flex items-center justify-center shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </form>

        {/* Search Results Display */}
        {searched && searchResults !== null && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                <Search className="w-3.5 h-3.5 mr-1" /> ผลการค้นหา ({searchResults.length})
              </h2>
              <button
                onClick={() => { setSearchResults(null); setSearched(false); setSearchTerm(''); }}
                className="text-xs text-emerald-600 hover:underline font-medium"
              >
                ล้างผลการค้นหา
              </button>
            </div>

            {searchResults.length > 0 ? (
              searchResults.map(ticket => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">ไม่พบข้อมูลงานซ่อมที่ตรงกับ "{searchTerm}"</p>
                <p className="text-xs text-slate-400 mt-1">ลองพิมพ์เฉพาะตัวเลขรหัส หรือข้อความอาการเสีย</p>
              </div>
            )}
          </div>
        )}

        {/* Auto My Tickets Display */}
        {(!searched || searchResults === null) && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" /> งานซ่อมล่าสุดของคุณ
              </h2>
              {myTickets.length > 0 && (
                <span className="text-xs text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full font-semibold">
                  {myTickets.length} รายการ
                </span>
              )}
            </div>

            {initLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-2" />
                <p className="text-xs">กำลังโหลดข้อมูลงานซ่อมของคุณ...</p>
              </div>
            ) : myTickets.length > 0 ? (
              <div>
                {myTickets.map(ticket => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wrench className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-slate-700">ยังไม่มีประวัติการแจ้งซ่อม</p>
                <p className="text-xs text-slate-400 mt-1 mb-5">
                  เมื่อคุณส่งใบแจ้งซ่อม รายการจะปรากฏที่หน้านี้โดยอัตโนมัติ
                </p>
                <Link
                  href="/liff/repair"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  <Wrench className="w-4 h-4" />
                  แจ้งปัญหาซ่อม IT ตอนนี้
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
