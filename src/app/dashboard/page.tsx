'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    broken: 0,
    thisWeek: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.from('assets').select('id, status, last_check_date');
      
      if (error) throw error;
      
      if (data) {
        const now = new Date();
        const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
        
        const active = data.filter(a => a.status === 'ใช้งาน').length;
        const broken = data.filter(a => a.status === 'ชำรุด').length;
        const recent = data.filter(a => a.last_check_date && new Date(a.last_check_date) >= oneWeekAgo).length;

        setStats({
          total: data.length,
          active,
          broken,
          thisWeek: recent
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ภาพรวม (Dashboard)</h1>
        <p className="text-slate-500 text-sm mt-1">สรุปข้อมูลครุภัณฑ์ สสจ.สระแก้ว</p>
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

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
        <h2 className="text-lg font-semibold text-slate-800 mb-6 border-b pb-4">แผนภูมิจำนวนครุภัณฑ์แยกตามกลุ่มงาน</h2>
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <p className="font-medium text-slate-500">รอข้อมูลเพียงพอสำหรับการสร้างกราฟ...</p>
          <p className="text-sm mt-2 text-center max-w-sm">เมื่อมีการเพิ่มครุภัณฑ์เข้าสู่ระบบ กราฟสรุปสถิติจะปรากฏขึ้นที่นี่โดยอัตโนมัติ</p>
        </div>
      </div>
    </div>
  );
}
