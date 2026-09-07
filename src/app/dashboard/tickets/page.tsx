'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, Edit } from 'lucide-react';
import Link from 'next/link';

type Ticket = {
  id: string;
  ticket_number: string;
  issue_type: string;
  description: string;
  status: string;
  created_at: string;
  personnel: { first_name: string; last_name: string } | null;
  departments: { name: string } | null;
  assets: { asset_number: string; brand_model: string } | null;
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_tickets')
      .select(`
        id, ticket_number, issue_type, description, status, created_at,
        personnel (first_name, last_name),
        departments (name),
        assets (asset_number, brand_model)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as any);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('repair_tickets')
      .update({ status: newStatus })
      .eq('id', id);
      
    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus } : t));
    }
    setUpdatingId(null);
  };

  const filteredTickets = tickets.filter(t => 
    t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.personnel?.first_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">งานแจ้งซ่อม (Helpdesk)</h1>
          <p className="text-slate-500 text-sm mt-1">จัดการและติดตามสถานะการแจ้งซ่อม</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="ค้นหาเลขที่, ชื่อ, อาการ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-600">
                  <th className="p-4">เลขที่/วันที่</th>
                  <th className="p-4">ผู้แจ้ง/กลุ่มงาน</th>
                  <th className="p-4">อุปกรณ์ (ถ้ามี)</th>
                  <th className="p-4">อาการเสีย</th>
                  <th className="p-4 text-center">สถานะ</th>
                  <th className="p-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors text-sm">
                    <td className="p-4">
                      <div className="font-semibold text-slate-800">{ticket.ticket_number}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(ticket.created_at).toLocaleDateString('th-TH')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">
                        {ticket.personnel?.first_name} {ticket.personnel?.last_name}
                      </div>
                      <div className="text-xs text-slate-500">{ticket.departments?.name}</div>
                    </td>
                    <td className="p-4">
                      {ticket.assets ? (
                        <>
                          <div className="text-slate-800">{ticket.assets.asset_number}</div>
                          <div className="text-xs text-slate-500">{ticket.assets.brand_model}</div>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">- ไม่ระบุ -</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs mb-1 font-medium">
                        {ticket.issue_type}
                      </div>
                      <div className="text-slate-700 line-clamp-2">{ticket.description}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ticket.status === 'เสร็จสิ้น' ? 'bg-green-50 text-green-700 border-green-200' :
                        ticket.status === 'กำลังดำเนินการ' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {updatingId === ticket.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                      ) : (
                        <select
                          value={ticket.status}
                          onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded p-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="รอรับเรื่อง">รอรับเรื่อง</option>
                          <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                          <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      ไม่พบข้อมูลแจ้งซ่อม
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
