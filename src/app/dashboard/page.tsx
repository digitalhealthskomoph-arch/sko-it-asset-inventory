'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function DashboardPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsRes, deptRes, catRes] = await Promise.all([
        supabase.from('assets').select(`
          id, status, last_check_date, department_id, category_id,
          departments(name)
        `),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('asset_categories').select('id, name').order('name')
      ]);
      
      if (assetsRes.data) setAssets(assetsRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter Assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesDept = selectedDept ? asset.department_id === selectedDept : true;
      const matchesCat = selectedCategory ? asset.category_id === selectedCategory : true;
      return matchesDept && matchesCat;
    });
  }, [assets, selectedDept, selectedCategory]);

  // Calculate Stats
  const stats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
    
    return {
      total: filteredAssets.length,
      active: filteredAssets.filter(a => a.status === 'ใช้งาน').length,
      broken: filteredAssets.filter(a => a.status === 'ชำรุด').length,
      thisWeek: filteredAssets.filter(a => a.last_check_date && new Date(a.last_check_date) >= oneWeekAgo).length
    };
  }, [filteredAssets]);

  // Chart Data: Assets by Department
  const deptChartData = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    filteredAssets.forEach(asset => {
      const deptName = asset.departments?.name || 'ไม่ระบุ';
      deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
    });
    return Object.keys(deptCounts)
      .map(name => ({ name, count: deptCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }, [filteredAssets]);

  // Chart Data: Status Pie Chart
  const statusChartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredAssets.forEach(asset => {
      const status = asset.status || 'ใช้งาน';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return Object.keys(statusCounts).map(name => ({
      name,
      value: statusCounts[name]
    }));
  }, [filteredAssets]);

  const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#3b82f6'];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ภาพรวม (Dashboard)</h1>
          <p className="text-slate-500 text-sm mt-1">สรุปข้อมูลครุภัณฑ์ สสจ.สระแก้ว</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center px-3 text-slate-400 border-r border-slate-100">
            <Filter className="w-4 h-4" />
          </div>
          <select 
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-transparent text-sm px-3 py-2 outline-none cursor-pointer text-slate-700"
          >
            <option value="">ทุกกลุ่มงาน</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent text-sm px-3 py-2 outline-none cursor-pointer text-slate-700 sm:border-l border-slate-100"
          >
            <option value="">ทุกประเภท</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'ครุภัณฑ์ทั้งหมด (รายการ)', count: loading ? '...' : stats.total, color: 'text-blue-600' },
          { title: 'กำลังใช้งาน', count: loading ? '...' : stats.active, color: 'text-emerald-600' },
          { title: 'รอซ่อม/ชำรุด', count: loading ? '...' : stats.broken, color: 'text-rose-600' },
          { title: 'ตรวจสอบล่าสุดสัปดาห์นี้', count: loading ? '...' : stats.thisWeek, color: 'text-purple-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center transition-all hover:shadow-md">
            <h3 className="text-sm font-medium text-slate-500 mb-2">{stat.title}</h3>
            <p className={`text-4xl font-bold ${stat.color}`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">จำนวนครุภัณฑ์แยกตามกลุ่มงาน (Top 10)</h2>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : deptChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    axisLine={false} 
                    tickLine={false} 
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="จำนวน (รายการ)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">สัดส่วนสถานะการใช้งาน</h2>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : statusChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
