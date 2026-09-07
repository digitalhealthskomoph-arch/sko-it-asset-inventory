'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Wrench, Upload } from 'lucide-react';

type Department = { id: string; name: string };
type Personnel = { id: string; first_name: string; last_name: string };
type Asset = { id: string; asset_number: string; brand_model: string; category_id: string };

export default function RepairFormPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  
  const [issueType, setIssueType] = useState('Hardware');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  // 1. Fetch Departments on load
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoading(true);
      const { data } = await supabase.from('departments').select('id, name').order('name');
      if (data) setDepartments(data);
      setLoading(false);
    };
    fetchDepartments();
  }, []);

  // 2. Fetch Personnel when Department changes
  useEffect(() => {
    if (!selectedDept) {
      setPersonnel([]);
      setSelectedPersonnel('');
      return;
    }
    const fetchPersonnel = async () => {
      const { data } = await supabase
        .from('personnel')
        .select('id, first_name, last_name')
        .eq('department_id', selectedDept)
        .order('first_name');
      if (data) setPersonnel(data);
    };
    fetchPersonnel();
  }, [selectedDept]);

  // 3. Fetch Assets when Personnel changes
  useEffect(() => {
    if (!selectedPersonnel) {
      setAssets([]);
      setSelectedAsset('');
      return;
    }
    const fetchAssets = async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, asset_number, brand_model, category_id')
        .eq('personnel_id', selectedPersonnel);
      if (data) setAssets(data);
    };
    fetchAssets();
  }, [selectedPersonnel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !selectedPersonnel || !description) return;
    
    setSubmitting(true);
    
    // Generate simple ticket number (e.g. IT-250001)
    // In production, might want a safer sequence generation in DB.
    const year = new Date().getFullYear() + 543; // Thai year
    const random = Math.floor(Math.random() * 9000) + 1000;
    const generatedTicket = \`IT-\${year.toString().slice(2)}\${random}\`;

    let imageUrl = null;
    
    // TODO: Upload file to R2 if selected (Skipped for now as requested)

    const { error } = await supabase.from('repair_tickets').insert({
      ticket_number: generatedTicket,
      department_id: selectedDept,
      personnel_id: selectedPersonnel,
      asset_id: selectedAsset || null,
      issue_type: issueType,
      description: description,
      image_url: imageUrl,
      status: 'รอรับเรื่อง'
    });

    setSubmitting(false);

    if (!error) {
      setTicketNumber(generatedTicket);
      setSuccess(true);
      // NOTE: LINE LIFF integration (liff.sendMessages) will be added here later
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      console.error(error);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">แจ้งซ่อมสำเร็จ!</h2>
          <p className="text-slate-600 mb-4">หมายเลขแจ้งซ่อมของคุณคือ<br/><span className="text-2xl font-bold text-blue-600 my-2 block">{ticketNumber}</span></p>
          <p className="text-sm text-slate-500">กรุณารอเจ้าหน้าที่ติดต่อกลับ</p>
          <button onClick={() => window.close()} className="mt-6 w-full bg-slate-100 text-slate-700 py-2 rounded-lg font-medium">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
      <div className="bg-blue-600 text-white p-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">แจ้งปัญหา IT</h1>
            <p className="text-blue-100 text-sm">IT Service Desk</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {loading && <div className="text-center py-4 text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></div>}
        
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">กลุ่มงาน/ฝ่าย</label>
          <select 
            required 
            value={selectedDept} 
            onChange={e => setSelectedDept(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- เลือกกลุ่มงาน --</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">ชื่อผู้แจ้ง</label>
          <select 
            required 
            disabled={!selectedDept}
            value={selectedPersonnel} 
            onChange={e => setSelectedPersonnel(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">-- เลือกชื่อบุคลากร --</option>
            {personnel.map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">อุปกรณ์ที่มีปัญหา (ถ้ามี)</label>
          <select 
            disabled={!selectedPersonnel}
            value={selectedAsset} 
            onChange={e => setSelectedAsset(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">-- ไม่ระบุอุปกรณ์ / อื่นๆ --</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>{a.asset_number} ({a.brand_model})</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">ประเภทปัญหา</label>
          <select 
            value={issueType} 
            onChange={e => setIssueType(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Hardware">Hardware (เครื่องคอม, ปริ้นเตอร์)</option>
            <option value="Software">Software (โปรแกรม, ไวรัส)</option>
            <option value="Network">Network (อินเทอร์เน็ต, LAN, WiFi)</option>
            <option value="Other">อื่นๆ</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">รายละเอียดปัญหา</label>
          <textarea 
            required
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="อธิบายอาการเสียที่พบ..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">รูปภาพประกอบ (ถ้ามี)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors">
            <input 
              type="file" 
              accept="image/*"
              className="hidden" 
              id="file-upload"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-6 h-6 text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">
                {file ? file.name : 'แตะเพื่อเลือกรูปภาพ'}
              </span>
            </label>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting || !selectedPersonnel}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center disabled:opacity-70 mt-6"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ส่งแจ้งซ่อม'}
        </button>
      </form>
    </div>
  );
}
