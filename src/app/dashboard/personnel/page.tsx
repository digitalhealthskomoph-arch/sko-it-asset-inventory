'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Users, Search, Edit2, Trash2 } from 'lucide-react';

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [position, setPosition] = useState('');
  const [deptId, setDeptId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [personRes, deptRes] = await Promise.all([
        supabase.from('personnel').select('*, departments(name)').order('first_name'),
        supabase.from('departments').select('*').order('name')
      ]);

      if (personRes.data) setPersonnel(personRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingPersonId) {
        // Edit Mode
        const { data, error } = await supabase.from('personnel').update({
          first_name: firstName,
          last_name: lastName,
          position: position,
          department_id: deptId || null
        }).eq('id', editingPersonId).select('*, departments(name)');

        if (error) throw error;
        
        if (data) {
          setPersonnel(personnel.map(p => p.id === editingPersonId ? data[0] : p).sort((a, b) => a.first_name.localeCompare(b.first_name)));
          closeModal();
        }
      } else {
        // Add Mode
        const { data, error } = await supabase.from('personnel').insert([
          {
            first_name: firstName,
            last_name: lastName,
            position: position,
            department_id: deptId || null
          }
        ]).select('*, departments(name)');

        if (error) throw error;
        
        if (data) {
          setPersonnel([...personnel, data[0]].sort((a, b) => a.first_name.localeCompare(b.first_name)));
          closeModal();
        }
      }
    } catch (error) {
      console.error('Error saving person:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบข้อมูลของ "${name}"?\n(หากบุคคลนี้มีชื่อผูกกับครุภัณฑ์อยู่ อาจทำให้เกิดข้อผิดพลาดในการลบ)`)) {
      return;
    }
    
    try {
      const { error } = await supabase.from('personnel').delete().eq('id', id);
      if (error) throw error;
      setPersonnel(personnel.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting person:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล หรืออาจมีข้อมูลครุภัณฑ์ที่ผูกกับบุคคลนี้อยู่');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingPersonId(null);
    setFirstName('');
    setLastName('');
    setPosition('');
    setDeptId('');
  };

  const openEditModal = (person: any) => {
    setEditingPersonId(person.id);
    setFirstName(person.first_name);
    setLastName(person.last_name);
    setPosition(person.position || '');
    setDeptId(person.department_id || '');
    setShowAddModal(true);
  };

  const filteredPersonnel = personnel.filter(p => 
    p.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.departments?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">จัดการบุคลากร</h1>
          <p className="text-slate-500 text-sm mt-1">รายชื่อผู้ใช้งานและกลุ่มงานในระบบ</p>
        </div>
        <button 
          onClick={() => {
            closeModal(); // Ensure form is reset before opening
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มบุคลากร
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, นามสกุล หรือ กลุ่มงาน..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <div className="text-sm text-slate-500">
            {filteredPersonnel.length} คน
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredPersonnel.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <Users className="w-16 h-16 text-slate-200" />
              <p>ไม่พบรายชื่อบุคลากร</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ชื่อ - นามสกุล</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ตำแหน่ง</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">กลุ่มงาน</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPersonnel.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{person.first_name} {person.last_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {person.position || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {person.departments?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditModal(person)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(person.id, `${person.first_name} ${person.last_name}`)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบข้อมูล"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                {editingPersonId ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSavePerson} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
                  <input required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น สมชาย" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล <span className="text-red-500">*</span></label>
                  <input required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น ใจดี" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ตำแหน่ง</label>
                <input value={position} onChange={e => setPosition(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น นักวิชาการคอมพิวเตอร์" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">กลุ่มงาน</label>
                <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">-- เลือกกลุ่มงาน --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium">
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex justify-center items-center">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
