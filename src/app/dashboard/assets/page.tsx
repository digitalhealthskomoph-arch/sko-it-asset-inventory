'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Loader2, Plus, MonitorSmartphone, Filter, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AssetListPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchFilters();
    fetchAssets();
  }, []);

  const fetchFilters = async () => {
    try {
      const [deptRes, catRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('asset_categories').select('id, name').order('name')
      ]);
      if (deptRes.data) setDepartments(deptRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          departments (name),
          personnel (first_name, last_name),
          asset_categories (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.brand_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.personnel?.first_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDept = selectedDept ? asset.department_id === selectedDept : true;
    const matchesCat = selectedCategory ? asset.category_id === selectedCategory : true;
    const matchesStatus = selectedStatus ? asset.status === selectedStatus : true;

    return matchesSearch && matchesDept && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายการครุภัณฑ์ทั้งหมด</h1>
          <p className="text-slate-500 text-sm mt-1">ทะเบียนคุมทรัพย์สิน พ.ร.บ.ไซเบอร์ และ งานไอที</p>
        </div>
        <Link 
          href="/dashboard/survey"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มรายการใหม่ / สำรวจ
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
            <div className="relative flex-1 sm:w-80">
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ, รหัส, ยี่ห้อ, หรือผู้ใช้งาน..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            
            <div className="flex gap-2">
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกกลุ่มงาน</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกประเภท</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select 
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกสถานะ</option>
                <option value="ใช้งาน">ใช้งาน</option>
                <option value="ชำรุด">ชำรุด</option>
                <option value="เสื่อมสภาพ">เสื่อมสภาพ</option>
                <option value="ไม่พบ">ไม่พบ</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-slate-500 font-medium whitespace-nowrap self-end md:self-auto">
            พบ {filteredAssets.length} รายการ
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <MonitorSmartphone className="w-16 h-16 text-slate-200" />
              <p>ยังไม่มีข้อมูลครุภัณฑ์</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">รูปภาพ</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">รหัสครุภัณฑ์</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ชื่ออุปกรณ์</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ผู้ครอบครอง</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">กลุ่มงาน</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAssets.map((asset) => (
                  <tr 
                    key={asset.id} 
                    onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      {asset.photo_url ? (
                        <div className="relative group/img">
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.photo_url} alt="Asset" className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute left-12 top-1/2 -translate-y-1/2 hidden group-hover/img:block z-[60] shadow-2xl border border-slate-200 rounded-xl overflow-hidden bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={asset.photo_url} alt="Asset Preview" className="w-64 h-64 object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{asset.asset_number || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">GF: {asset.gf_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{asset.asset_name || asset.asset_categories?.name || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{asset.brand_model || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {asset.personnel ? (
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold mr-2">
                            {asset.personnel.first_name[0]}
                          </div>
                          <span className="text-sm text-slate-700">{asset.personnel.first_name} {asset.personnel.last_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">ส่วนกลาง</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {asset.departments?.name || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        asset.status === 'ใช้งาน' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        asset.status === 'ชำรุด' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {asset.status || 'ใช้งาน'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
