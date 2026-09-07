'use client';

import Link from 'next/link';
import { Wrench, Search, Monitor } from 'lucide-react';

export default function LiffHomePage() {
  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
      <div className="bg-blue-600 text-white p-8 rounded-b-3xl shadow-md text-center">
        <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Monitor className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">IT Service Desk</h1>
        <p className="text-blue-100 text-sm">สสจ.สระแก้ว</p>
      </div>

      <div className="p-6 space-y-4 mt-4">
        <Link 
          href="/liff/repair"
          className="flex items-center p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all group"
        >
          <div className="bg-blue-50 p-4 rounded-xl mr-4 group-hover:bg-blue-600 transition-colors">
            <Wrench className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">แจ้งปัญหา IT</h2>
            <p className="text-sm text-slate-500 mt-1">แจ้งซ่อมคอมพิวเตอร์และเครือข่าย</p>
          </div>
          <div className="text-slate-300 group-hover:text-blue-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </div>
        </Link>

        <Link 
          href="/liff/status"
          className="flex items-center p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all group"
        >
          <div className="bg-emerald-50 p-4 rounded-xl mr-4 group-hover:bg-emerald-600 transition-colors">
            <Search className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">ติดตามสถานะ</h2>
            <p className="text-sm text-slate-500 mt-1">เช็คสถานะการแจ้งซ่อมของคุณ</p>
          </div>
          <div className="text-slate-300 group-hover:text-emerald-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </div>
        </Link>
      </div>

      <div className="text-center p-6 mt-8">
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} IT Asset Inventory</p>
      </div>
    </div>
  );
}
