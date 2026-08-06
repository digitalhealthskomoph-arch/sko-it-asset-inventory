'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Save, Search, Loader2 } from 'lucide-react';

export default function SurveyPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [assetName, setAssetName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('ใช้งาน');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const [deptRes, personRes, catRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('personnel').select('*').order('first_name'),
        supabase.from('asset_categories').select('*').order('name'),
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (personRes.data) setPersonnel(personRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Simulate save for now
    setTimeout(() => {
      alert('บันทึกข้อมูลการสำรวจเรียบร้อยแล้ว');
      setSaving(false);
      // Reset some fields
      setAssetNumber('');
      setAssetName('');
      setNotes('');
    }, 1000);
  };

  const filteredPersonnel = selectedDept 
    ? personnel.filter(p => p.department_id === selectedDept)
    : personnel;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สำรวจครุภัณฑ์</h1>
          <p className="text-slate-500 text-sm mt-1">บันทึกข้อมูลและสถานะครุภัณฑ์หน้างาน</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6">
          
          {/* Section 1: Location & Owner */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">1. สถานที่และผู้ใช้งาน</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">กลุ่มงาน / ฝ่าย</label>
              <select 
                required
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">-- เลือกกลุ่มงาน --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ผู้ครอบครอง / ใช้งานหลัก (ถ้ามี)</label>
              <select 
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={!selectedDept}
              >
                <option value="">-- ไม่ระบุ / ส่วนกลาง --</option>
                {filteredPersonnel.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Asset Info */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">2. ข้อมูลครุภัณฑ์</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมายเลขครุภัณฑ์ / หมายเลข GF</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={assetNumber}
                  onChange={(e) => setAssetNumber(e.target.value)}
                  className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="เช่น 7440-001-0001"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 rounded-lg">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อทรัพย์สิน / อุปกรณ์</label>
              <input 
                type="text" 
                required
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="เช่น เครื่องคอมพิวเตอร์พกพา, จอภาพ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท</label>
              <select 
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">-- เลือกประเภท --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Status & Photo */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">3. สถานะและรูปภาพ</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สถานะปัจจุบัน</label>
              <select 
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="ใช้งาน">ใช้งานได้ปกติ</option>
                <option value="ชำรุด">ชำรุด / รอซ่อม</option>
                <option value="เสื่อมสภาพ">เสื่อมสภาพ / รอจำหน่าย</option>
                <option value="ไม่พบ">ไม่พบ / สูญหาย</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รูปภาพ</label>
              <button type="button" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                <Camera className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">แตะเพื่อถ่ายภาพหรืออัปโหลดรูป</span>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea 
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="ระบุอาการชำรุด หรือข้อมูลเพิ่มเติม..."
              />
            </div>
          </div>

          {/* Actions - Sticky on Mobile */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 lg:static lg:bg-transparent lg:border-none lg:p-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] lg:shadow-none">
            <button 
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-70"
            >
              {saving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> บันทึกการสำรวจ</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
