'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Search, Edit, AlertCircle, Clock, CheckCircle, ListTodo, Image as ImageIcon, X, Star } from 'lucide-react';
import Link from 'next/link';

type Ticket = {
  id: string;
  ticket_number: string;
  issue_type: string;
  description: string;
  status: string;
  image_url: string | null;
  created_at: string;
  technician_name: string | null;
  resolution_notes: string | null;
  rating?: number | null;
  feedback?: string | null;
  closed_at?: string | null;
  personnel: { first_name: string; last_name: string } | null;
  departments: { name: string } | null;
  assets: { asset_number: string; brand_model: string } | null;
};

const TECHNICIANS = [
  'ณัฏฐ์ดนัย ตั้งธนพรสกุล',
  'จิระเดช ช่างสาย',
  'ธนกฤต นิธิตันติปัญญา'
];

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState(TECHNICIANS[0]);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_tickets')
      .select(`
        id, ticket_number, issue_type, description, status, image_url, created_at, technician_name, resolution_notes,
        rating, feedback, closed_at,
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
    if (newStatus === 'รอผู้ใช้ยืนยัน') {
      const ticket = tickets.find(t => t.id === id);
      setTechnicianName(ticket?.technician_name || TECHNICIANS[0]);
      setResolutionNotes(ticket?.resolution_notes || '');
      setSelectedTicketId(id);
      setShowModal(true);
      return;
    }

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

  const handleAssignTechnician = async (id: string, name: string) => {
    setUpdatingId(id);
    const updatePayload: any = { technician_name: name || null };
    
    // If ticket was "รอรับเรื่อง" and we assign a technician, advance to "กำลังดำเนินการ"
    const currentTicket = tickets.find(t => t.id === id);
    if (currentTicket && currentTicket.status === 'รอรับเรื่อง' && name) {
      updatePayload.status = 'กำลังดำเนินการ';
    }

    const { error } = await supabase
      .from('repair_tickets')
      .update(updatePayload)
      .eq('id', id);

    if (!error) {
      setTickets(tickets.map(t => t.id === id ? { ...t, ...updatePayload } : t));
    } else {
      alert('เกิดข้อผิดพลาดในการมอบหมายช่าง');
    }
    setUpdatingId(null);
  };

  const handleConfirmCompletion = async () => {
    if (!selectedTicketId || !resolutionNotes.trim()) {
      alert('กรุณากรอกวิธีการแก้ไข');
      return;
    }

    setUpdatingId(selectedTicketId);
    setShowModal(false);

    const { error } = await supabase
      .from('repair_tickets')
      .update({ 
        status: 'รอผู้ใช้ยืนยัน',
        technician_name: technicianName,
        resolution_notes: resolutionNotes
      })
      .eq('id', selectedTicketId);
      
    if (!error) {
      setTickets(tickets.map(t => t.id === selectedTicketId ? { 
        ...t, 
        status: 'รอผู้ใช้ยืนยัน',
        technician_name: technicianName,
        resolution_notes: resolutionNotes
      } : t));
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
    setUpdatingId(null);
  };

  const closedTickets = tickets.filter(t => t.status === 'ปิดงาน');
  const ratedTickets = closedTickets.filter(t => t.rating && t.rating > 0);
  const avgRating = ratedTickets.length > 0 
    ? (ratedTickets.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTickets.length).toFixed(1)
    : null;

  const filteredTickets = tickets.filter(t => 
    t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.personnel?.first_name || '').toLowerCase().includes(searchTerm.toLowerCase())
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

      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
            <div className="bg-slate-100 p-3 rounded-lg text-slate-600">
              <ListTodo className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-slate-500 font-medium">งานทั้งหมด</div>
              <div className="text-2xl font-bold text-slate-800">{tickets.length}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-slate-500 font-medium">กำลังรอดำเนินการ</div>
              <div className="text-2xl font-bold text-slate-800">
                {tickets.filter(t => ['รอรับเรื่อง', 'กำลังดำเนินการ'].includes(t.status)).length}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-slate-500 font-medium">รอผู้ใช้ยืนยัน</div>
              <div className="text-2xl font-bold text-slate-800">
                {tickets.filter(t => t.status === 'รอผู้ใช้ยืนยัน').length}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-lg text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-slate-500 font-medium">ปิดงานแล้ว</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-800">{closedTickets.length}</span>
                {avgRating && (
                  <span className="text-xs text-amber-600 font-semibold flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {avgRating} / 5
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <th className="p-4">อาการเสีย/การแก้ไข</th>
                  <th className="p-4">ช่างผู้รับผิดชอบ</th>
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
                      <div className="text-slate-700 line-clamp-2 mb-1">{ticket.description}</div>
                      {ticket.image_url && (
                        <a href={ticket.image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-blue-600 hover:underline mt-1">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          ดูรูปภาพ
                        </a>
                      )}
                      {ticket.resolution_notes && (
                        <div className="mt-2 bg-green-50 p-2 rounded border border-green-100 text-xs text-green-700">
                          <strong>{ticket.technician_name} แก้ไข:</strong> {ticket.resolution_notes}
                        </div>
                      )}
                      {ticket.status === 'ปิดงาน' && (ticket.rating || ticket.feedback) && (
                        <div className="mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                            <span>ผลประเมิน:</span>
                            <div className="flex text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${s <= (ticket.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                                />
                              ))}
                            </div>
                            <span className="text-amber-800 font-bold text-[11px]">({ticket.rating}/5 ดาว)</span>
                          </div>
                          {ticket.feedback && (
                            <div className="text-slate-700 bg-white/80 p-2 rounded border border-amber-100 text-xs italic">
                              "{ticket.feedback}"
                            </div>
                          )}
                          {ticket.closed_at && (
                            <div className="text-[10px] text-slate-400">
                              ปิดงานเมื่อ: {new Date(ticket.closed_at).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {ticket.status === 'ปิดงาน' ? (
                        <span className="text-slate-600 font-medium text-xs">
                          {ticket.technician_name || '-'}
                        </span>
                      ) : (
                        <select
                          value={ticket.technician_name || ''}
                          onChange={(e) => handleAssignTechnician(ticket.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg p-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500 w-full min-w-[130px]"
                        >
                          <option value="">-- มอบหมายช่าง --</option>
                          {TECHNICIANS.map(tech => (
                            <option key={tech} value={tech}>{tech}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        ticket.status === 'ปิดงาน' ? 'bg-green-50 text-green-700 border-green-200' :
                        ticket.status === 'รอผู้ใช้ยืนยัน' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        ticket.status === 'กำลังดำเนินการ' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {updatingId === ticket.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                      ) : ticket.status === 'ปิดงาน' ? (
                        <span className="text-slate-400 text-xs">-</span>
                      ) : (
                        <select
                          value={ticket.status}
                          onChange={(e) => handleUpdateStatus(ticket.id, e.target.value)}
                          className="text-xs border border-slate-200 rounded p-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="รอรับเรื่อง">รอรับเรื่อง</option>
                          <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                          <option value="รอผู้ใช้ยืนยัน">รอผู้ใช้ยืนยัน</option>
                          <option value="ปิดงาน" disabled>ปิดงาน (ให้ผู้ใช้ทำ)</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
                
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      ไม่พบข้อมูลแจ้งซ่อม
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-4">บันทึกผลการซ่อม</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ช่างผู้ดำเนินการ</label>
                <select 
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TECHNICIANS.map(tech => (
                    <option key={tech} value={tech}>{tech}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียดการแก้ไข</label>
                <textarea 
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="อธิบายว่าซ่อมหรือแก้ไขอย่างไร..."
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleConfirmCompletion}
                  disabled={!resolutionNotes.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  บันทึกและตั้งสถานะ "รอผู้ใช้ยืนยัน"
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
