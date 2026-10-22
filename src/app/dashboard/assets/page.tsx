'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { staffFetch } from '@/lib/api-client';
import {
  Search,
  Loader2,
  Plus,
  MonitorSmartphone,
  Image as ImageIcon,
  Wrench,
  AlertTriangle,
  PackageX,
  Trash2,
  CheckSquare,
  Square,
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  ArrowLeftRight,
  Check,
  Building2,
  Sparkles,
  FileDown,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { getSafeImageUrl } from '@/lib/image-url';
import {
  parseProcurementMeta,
  serializeProcurementMeta,
  mapProcurementStatusToItStatus,
  mapProcurementLocationToDeptName,
  isStatusEquivalent,
  isDepartmentEquivalent,
  ProcurementMeta,
  SyncSummary,
} from '@/lib/procurement-sync';

type ReconcileFilterType =
  | 'all'
  | 'conflict'
  | 'status_conflict'
  | 'dept_conflict'
  | 'pending_survey'
  | 'proc_disposed'
  | 'reconciled'
  | 'no_proc';

export default function AssetListPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [repairCounts, setRepairCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRepairFilter, setSelectedRepairFilter] = useState('');
  const [reconcileFilter, setReconcileFilter] = useState<ReconcileFilterType>('all');

  // Bulk Selection & Delete States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Procurement Sync Upload Modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFilters();
    fetchAssets();
  }, []);

  const fetchFilters = async () => {
    try {
      const [deptRes, catRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('asset_categories').select('id, name').order('name'),
      ]);
      if (deptRes.data) setDepartments(deptRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const [assetsRes, ticketsRes] = await Promise.all([
        supabase
          .from('assets')
          .select(`
            *,
            departments (name),
            personnel (first_name, last_name),
            asset_categories (name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('repair_tickets')
          .select('asset_id')
          .not('asset_id', 'is', null),
      ]);

      if (ticketsRes.data) {
        const counts: Record<string, number> = {};
        ticketsRes.data.forEach((t: any) => {
          if (t.asset_id) {
            counts[t.asset_id] = (counts[t.asset_id] || 0) + 1;
          }
        });
        setRepairCounts(counts);
      }

      if (assetsRes.error) throw assetsRes.error;
      setAssets(assetsRes.data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const deptIdByName = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.name.trim(), d.id));
    return map;
  }, [departments]);

  // Helper to evaluate reconciliation state of a single asset row
  const getReconcileInfo = (asset: any) => {
    const meta: ProcurementMeta = parseProcurementMeta(asset.proposed_action);
    const hasProcData = Boolean(meta.proc_status || asset.location_details);
    const procStatus = meta.proc_status || null;
    const procLocation = meta.proc_location || asset.location_details || null;
    const itStatus = asset.status || 'ใช้งาน';
    const itDeptName = asset.departments?.name || null;
    const mappedProcDeptName = mapProcurementLocationToDeptName(procLocation);

    const statusMatches = isStatusEquivalent(itStatus, procStatus);
    const deptMatches = isDepartmentEquivalent(itDeptName, procLocation);

    const hasStatusConflict = hasProcData && !statusMatches && !meta.status_reconciled;
    const hasDeptConflict = hasProcData && !deptMatches && !meta.dept_reconciled;
    const isPendingSurvey = itStatus === 'รอสำรวจ';
    const isReconciled =
      hasProcData &&
      !isPendingSurvey &&
      (statusMatches || Boolean(meta.status_reconciled)) &&
      (deptMatches || Boolean(meta.dept_reconciled));

    return {
      meta,
      hasProcData,
      procStatus,
      procLocation,
      mappedProcDeptName,
      itStatus,
      itDeptName,
      statusMatches,
      deptMatches,
      hasStatusConflict,
      hasDeptConflict,
      isPendingSurvey,
      isReconciled,
    };
  };

  // Summary counts for top cards
  const reconcileStats = useMemo(() => {
    let total = assets.length;
    let statusConflict = 0;
    let deptConflict = 0;
    let anyConflict = 0;
    let pendingSurvey = 0;
    let procDisposedPending = 0;
    let reconciled = 0;
    let noProc = 0;

    assets.forEach((a) => {
      const info = getReconcileInfo(a);
      if (!info.hasProcData) {
        noProc++;
        return;
      }
      if (info.isPendingSurvey) {
        pendingSurvey++;
        if (info.procStatus === 'จำหน่ายแล้ว') {
          procDisposedPending++;
        }
      } else {
        if (info.hasStatusConflict) statusConflict++;
        if (info.hasDeptConflict) deptConflict++;
        if (info.hasStatusConflict || info.hasDeptConflict) anyConflict++;
      }
      if (info.isReconciled) {
        reconciled++;
      }
    });

    return {
      total,
      statusConflict,
      deptConflict,
      anyConflict,
      pendingSurvey,
      procDisposedPending,
      reconciled,
      noProc,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const info = getReconcileInfo(asset);
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        asset.asset_name?.toLowerCase().includes(q) ||
        asset.asset_number?.toLowerCase().includes(q) ||
        asset.brand_model?.toLowerCase().includes(q) ||
        asset.personnel?.first_name?.toLowerCase().includes(q) ||
        info.procLocation?.toLowerCase().includes(q) ||
        info.meta.original_ocr_code?.toLowerCase().includes(q);

      const matchesDept = selectedDept ? asset.department_id === selectedDept : true;
      const matchesCat = selectedCategory ? asset.category_id === selectedCategory : true;
      const matchesStatus = selectedStatus ? asset.status === selectedStatus : true;

      const count = repairCounts[asset.id] || 0;
      let matchesRepair = true;
      if (selectedRepairFilter === 'repaired') {
        matchesRepair = count >= 1;
      } else if (selectedRepairFilter === 'frequent') {
        matchesRepair = count >= 3 || asset.status === 'เสื่อมสภาพ' || asset.status === 'ชำรุด';
      } else if (selectedRepairFilter === 'never') {
        matchesRepair = count === 0;
      }

      let matchesReconcile = true;
      if (reconcileFilter === 'conflict') {
        matchesReconcile = !info.isPendingSurvey && (info.hasStatusConflict || info.hasDeptConflict);
      } else if (reconcileFilter === 'status_conflict') {
        matchesReconcile = !info.isPendingSurvey && info.hasStatusConflict;
      } else if (reconcileFilter === 'dept_conflict') {
        matchesReconcile = !info.isPendingSurvey && info.hasDeptConflict;
      } else if (reconcileFilter === 'pending_survey') {
        matchesReconcile = info.isPendingSurvey;
      } else if (reconcileFilter === 'proc_disposed') {
        matchesReconcile = info.procStatus === 'จำหน่ายแล้ว' && info.itStatus !== 'จำหน่ายแล้ว';
      } else if (reconcileFilter === 'reconciled') {
        matchesReconcile = info.isReconciled;
      } else if (reconcileFilter === 'no_proc') {
        matchesReconcile = !info.hasProcData;
      }

      return (
        matchesSearch &&
        matchesDept &&
        matchesCat &&
        matchesStatus &&
        matchesRepair &&
        matchesReconcile
      );
    });
  }, [
    assets,
    searchTerm,
    selectedDept,
    selectedCategory,
    selectedStatus,
    selectedRepairFilter,
    reconcileFilter,
    repairCounts,
  ]);

  // Single-row Admin Decision Handler
  const handleSingleDecision = async (
    asset: any,
    mode: 'keep_it' | 'use_proc',
    scope: 'both' | 'status' | 'dept',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActionLoading(true);
    try {
      const info = getReconcileInfo(asset);
      const nextMeta: ProcurementMeta = {
        ...info.meta,
        decision_by: mode === 'keep_it' ? 'it' : 'procurement',
        reconciled_at: new Date().toISOString(),
      };

      let nextStatus = asset.status || 'ใช้งาน';
      let nextDeptId = asset.department_id;

      if (scope === 'both' || scope === 'status') {
        nextMeta.status_reconciled = true;
        if (mode === 'use_proc' && info.procStatus) {
          nextStatus = mapProcurementStatusToItStatus(info.procStatus);
        } else if (mode === 'keep_it' && nextStatus === 'รอสำรวจ') {
          nextStatus = 'ใช้งาน';
        }
      }

      if (scope === 'both' || scope === 'dept') {
        nextMeta.dept_reconciled = true;
        if (mode === 'use_proc' && info.mappedProcDeptName) {
          const targetDeptId = deptIdByName.get(info.mappedProcDeptName);
          if (targetDeptId) nextDeptId = targetDeptId;
        }
      }

      const payload: Record<string, any> = {
        status: nextStatus,
        department_id: nextDeptId,
        proposed_action: serializeProcurementMeta(nextMeta),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('assets').update(payload).eq('id', asset.id);
      if (error) throw error;

      const updatedDeptName =
        departments.find((d) => d.id === nextDeptId)?.name || asset.departments?.name;

      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset.id
            ? {
                ...a,
                ...payload,
                departments: updatedDeptName ? { name: updatedDeptName } : a.departments,
              }
            : a
        )
      );
    } catch (err: any) {
      console.error('Decision error:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการตัดสินใจ: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Admin Decision Handler
  const handleBulkDecision = async (mode: 'keep_it' | 'use_proc') => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const label =
      mode === 'keep_it'
        ? 'ยืนยันข้อมูลตามหน้างาน IT (คงสถานะและกลุ่มงานฝั่ง IT เป็นข้อมูลสุทธิ)'
        : 'ปรับสถานะและกลุ่มงานให้ตรงตามบัญชีพัสดุ';

    if (!window.confirm(`ยืนยันการตัดสินใจแบบกลุ่ม ${count} รายการ:\n"${label}" ใช่หรือไม่?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const selectedList = assets.filter((a) => selectedIds.has(a.id));
      const BATCH = 25;

      const updatedMap = new Map<string, any>();

      for (let i = 0; i < selectedList.length; i += BATCH) {
        const batch = selectedList.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (asset) => {
            const info = getReconcileInfo(asset);
            const nextMeta: ProcurementMeta = {
              ...info.meta,
              status_reconciled: true,
              dept_reconciled: true,
              decision_by: mode === 'keep_it' ? 'it' : 'procurement',
              reconciled_at: new Date().toISOString(),
            };

            let nextStatus = asset.status || 'ใช้งาน';
            let nextDeptId = asset.department_id;

            if (mode === 'use_proc') {
              if (info.procStatus) {
                nextStatus = mapProcurementStatusToItStatus(info.procStatus);
              }
              if (info.mappedProcDeptName) {
                const targetDeptId = deptIdByName.get(info.mappedProcDeptName);
                if (targetDeptId) nextDeptId = targetDeptId;
              }
            } else if (mode === 'keep_it' && nextStatus === 'รอสำรวจ') {
              nextStatus = 'ใช้งาน';
            }

            const payload = {
              status: nextStatus,
              department_id: nextDeptId,
              proposed_action: serializeProcurementMeta(nextMeta),
              updated_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('assets').update(payload).eq('id', asset.id);
            if (error) throw error;

            const updatedDeptName =
              departments.find((d) => d.id === nextDeptId)?.name || asset.departments?.name;

            updatedMap.set(asset.id, {
              ...payload,
              departments: updatedDeptName ? { name: updatedDeptName } : asset.departments,
            });
          })
        );
      }

      setAssets((prev) =>
        prev.map((a) => (updatedMap.has(a.id) ? { ...a, ...updatedMap.get(a.id) } : a))
      );
      setSelectedIds(new Set());
      alert(`บันทึกการตัดสินใจสำเร็จ (${count} รายการ)`);
    } catch (err: any) {
      console.error('Bulk decision error:', err);
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Upload Excel for Procurement Sync
  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setSyncResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await staffFetch('/api/procurement-sync', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการซิงค์ไฟล์พัสดุ');
      }

      setSyncResult(data.summary);
      await fetchAssets();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSyncing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export Reconciliation / Discrepancy Excel Report
  const handleExportReconcileExcel = () => {
    const list = selectedIds.size > 0 ? filteredAssets.filter((a) => selectedIds.has(a.id)) : filteredAssets;
    if (list.length === 0) {
      alert('ไม่มีรายการสำหรับส่งออก');
      return;
    }

    const headers = [
      'ลำดับ',
      'รหัสครุภัณฑ์',
      'รหัสเดิมก่อนซ่อม OCR (ถ้ามี)',
      'ชื่อครุภัณฑ์ / เครื่อง',
      'ประเภท',
      'ยี่ห้อ / รุ่น',
      'ผู้ครอบครอง (IT สำรวจ)',
      'กลุ่มงานปัจจุบัน (IT สำรวจ)',
      'ใช้ที่ (ตามบัญชีพัสดุ)',
      'ผลการเทียบกลุ่มงาน',
      'สถานะปัจจุบัน (IT สุทธิ)',
      'สภาพ/การใช้งาน (ตามบัญชีพัสดุ)',
      'ผลการเทียบสถานะ',
      'วันที่ได้มา',
      'ราคาจัดซื้อ (บาท)',
      'วิธีการได้มา',
      'จำนวนครั้งที่ซ่อม',
      'หมายเหตุ',
    ];

    const rows = list.map((asset, idx) => {
      const info = getReconcileInfo(asset);
      const repairs = repairCounts[asset.id] || 0;
      const deptCompareText = !info.hasProcData
        ? 'ไม่มีในบัญชีพัสดุ'
        : info.deptMatches
        ? 'ตรงกัน'
        : info.meta.dept_reconciled
        ? `ยืนยันแล้ว (${info.itDeptName || '-'})`
        : 'ไม่ตรงกัน (ย้ายกลุ่มงาน)';

      const statusCompareText = !info.hasProcData
        ? 'ไม่มีในบัญชีพัสดุ'
        : info.isPendingSurvey
        ? 'รอสำรวจหน้างาน'
        : info.statusMatches
        ? 'ตรงกัน'
        : info.meta.status_reconciled
        ? `ตัดสินใจแล้ว (ยึด: ${info.itStatus})`
        : 'ขัดแย้ง (รอตัดสินใจ)';

      return [
        idx + 1,
        asset.asset_number || '-',
        info.meta.original_ocr_code || '-',
        asset.asset_name || '-',
        asset.asset_categories?.name || '-',
        asset.brand_model || '-',
        asset.personnel ? `${asset.personnel.first_name} ${asset.personnel.last_name}` : 'ส่วนกลาง',
        info.itDeptName || '-',
        info.procLocation || '-',
        deptCompareText,
        info.itStatus,
        info.procStatus || '-',
        statusCompareText,
        asset.acquisition_date || '-',
        asset.purchase_price !== null && asset.purchase_price !== undefined
          ? Number(asset.purchase_price)
          : '-',
        asset.acquisition_method || '-',
        repairs,
        asset.notes || '-',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 22 },
      { wch: 20 },
      { wch: 24 },
      { wch: 26 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'กระทบยอดครุภัณฑ์');
    const fileDate = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `รายงานกระทบยอดพัสดุ-IT_สสจ.สระแก้ว_${fileDate}.xlsx`);
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedIds.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await supabase.from('assets').delete().in('id', idsToDelete);
      if (error) throw error;

      setAssets((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setShowDeleteModal(false);
      alert(`ลบข้อมูลครุภัณฑ์เรียบร้อยแล้ว (${count} รายการ)`);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const getAgeYears = (acqDate: string | null | undefined) => {
    if (!acqDate) return null;
    const t = new Date(acqDate).getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
  };

  return (
    <div className="space-y-5 pb-14">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">รายการครุภัณฑ์ & กระทบยอดทะเบียนพัสดุ</h1>
          <p className="text-slate-500 text-sm mt-1">
            บูรณาการข้อมูลสำรวจหน้างาน IT (พ.ร.บ.ไซเบอร์) เทียบคู่กับรายงานการตรวจสอบพัสดุประจำปีแบบ 2 คอลัมน์
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-2xs cursor-pointer"
          >
            <Upload className="w-4 h-4 mr-2 text-indigo-600" />
            ซิงค์ไฟล์พัสดุ (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportReconcileExcel}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-2xs cursor-pointer"
          >
            <FileDown className="w-4 h-4 mr-2 text-emerald-600" />
            ส่งออกรายงานผลต่าง (.xlsx)
          </button>
          <Link
            href="/dashboard/disposal"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-2xs"
          >
            <PackageX className="w-4 h-4 mr-2 text-purple-600" />
            ขอจำหน่ายพัสดุ
          </Link>
          <Link
            href="/dashboard/survey"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            สำรวจเพิ่ม
          </Link>
        </div>
      </div>

      {/* Interactive Reconciliation Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setReconcileFilter('all');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold opacity-80">ทั้งหมดในระบบ</div>
          <div className="text-xl font-bold mt-1">{reconcileStats.total}</div>
          <div className="text-[10px] opacity-70 mt-0.5">รวม IT + บัญชีพัสดุ</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReconcileFilter('status_conflict');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'status_conflict'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100/70'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>สถานะขัดแย้งกัน</span>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xl font-bold mt-1">{reconcileStats.statusConflict}</div>
          <div className="text-[10px] opacity-80 mt-0.5">เช่น IT ชำรุด vs พัสดุ ปกติ</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReconcileFilter('dept_conflict');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'dept_conflict'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100/70'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>กลุ่มงานไม่ตรงพัสดุ</span>
            <Building2 className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xl font-bold mt-1">{reconcileStats.deptConflict}</div>
          <div className="text-[10px] opacity-80 mt-0.5">ย้ายจุดใช้งานจากตอนซื้อ</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReconcileFilter('pending_survey');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'pending_survey'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-indigo-50/70 text-indigo-900 border-indigo-200 hover:bg-indigo-100/70'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>นำเข้าใหม่ (รอสำรวจ)</span>
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xl font-bold mt-1">{reconcileStats.pendingSurvey}</div>
          <div className="text-[10px] opacity-80 mt-0.5">มีในพัสดุ ยังไม่สแกนหน้างาน</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReconcileFilter('proc_disposed');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'proc_disposed'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
              : 'bg-purple-50/70 text-purple-900 border-purple-200 hover:bg-purple-100/70'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>พัสดุระบุ "จำหน่ายแล้ว"</span>
            <PackageX className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xl font-bold mt-1">{reconcileStats.procDisposedPending}</div>
          <div className="text-[10px] opacity-80 mt-0.5">รอกดยืนยันตัดจำหน่ายตามพัสดุ</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setReconcileFilter('reconciled');
            setSelectedIds(new Set());
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            reconcileFilter === 'reconciled'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>ข้อมูลสุทธิตรงกันแล้ว</span>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="text-xl font-bold mt-1">{reconcileStats.reconciled}</div>
          <div className="text-[10px] opacity-80 mt-0.5">กระทบยอดสมบูรณ์</div>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[calc(100vh-260px)] min-h-[540px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row flex-wrap w-full xl:w-auto gap-2.5">
            <div className="relative flex-1 sm:w-72">
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัส, ยี่ห้อ, ผู้ใช้, ใช้ที่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกกลุ่มงาน (IT)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกประเภท</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">ทุกสถานะ IT</option>
                <option value="ใช้งาน">ใช้งาน</option>
                <option value="รอสำรวจ">รอสำรวจ (นำเข้าจากพัสดุ)</option>
                <option value="ชำรุด">ชำรุด</option>
                <option value="เสื่อมสภาพ">เสื่อมสภาพ</option>
                <option value="พร้อมจำหน่าย">พร้อมจำหน่าย</option>
                <option value="จำหน่ายแล้ว">จำหน่ายแล้ว</option>
                <option value="ไม่พบ">ไม่พบ</option>
              </select>

              <select
                value={reconcileFilter}
                onChange={(e) => setReconcileFilter(e.target.value as ReconcileFilterType)}
                className="bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">ทุกสถานะกระทบยอด</option>
                <option value="conflict">⚠️ ขัดแย้งทั้งหมด (สถานะ หรือ กลุ่มงาน)</option>
                <option value="status_conflict">⚡ สถานะ IT vs พัสดุไม่ตรงกัน</option>
                <option value="dept_conflict">🏢 กลุ่มงาน IT vs พัสดุไม่ตรงกัน</option>
                <option value="pending_survey">🔍 รอสำรวจหน้างาน</option>
                <option value="proc_disposed">📦 พัสดุระบุ "จำหน่ายแล้ว" (รอยืนยัน)</option>
                <option value="reconciled">✅ ยืนยันข้อมูลสุทธิแล้ว</option>
                <option value="no_proc">📋 ไม่มีในบัญชีพัสดุ ({reconcileStats.noProc})</option>
              </select>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-slate-500 font-medium whitespace-nowrap self-end xl:self-auto">
            แสดง <span className="font-bold text-slate-800">{filteredAssets.length}</span> รายการ
          </div>
        </div>

        {/* Table / List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <MonitorSmartphone className="w-14 h-14 text-slate-200" />
              <p className="text-sm">ไม่พบรายการครุภัณฑ์ตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1180px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10 text-center">
                    <button
                      type="button"
                      onClick={(e) => handleSelectAll(e)}
                      className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                      title={
                        selectedIds.size === filteredAssets.length && filteredAssets.length > 0
                          ? 'ยกเลิกการเลือกทั้งหมด'
                          : 'เลือกทั้งหมดในหน้านี้'
                      }
                    >
                      {selectedIds.size > 0 && selectedIds.size === filteredAssets.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">
                    รูป
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    รหัสครุภัณฑ์ / ราคา-อายุ
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    ชื่ออุปกรณ์ / ผู้ครอบครอง
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    กลุ่มงาน (IT หน้างาน vs พัสดุ)
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50/40">
                    คอลัมน์ 1: สถานะ IT (สุทธิ)
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-indigo-700 uppercase tracking-wider bg-indigo-50/40">
                    คอลัมน์ 2: สถานะบัญชีพัสดุ
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold text-slate-600 uppercase tracking-wider text-center">
                    ตัดสินใจ (Admin)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedIds.has(asset.id);
                  const info = getReconcileInfo(asset);
                  const ageYears = getAgeYears(asset.acquisition_date);
                  const count = repairCounts[asset.id] || 0;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
                      className={`${
                        isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                      } transition-colors group cursor-pointer`}
                    >
                      {/* Checkbox */}
                      <td
                        className="px-3 py-3.5 text-center w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelect(asset.id, e)}
                          className="cursor-pointer transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>

                      {/* Photo */}
                      <td className="px-3 py-3.5">
                        {asset.photo_url ? (
                          <div className="relative group/img">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getSafeImageUrl(asset.photo_url)}
                                alt="Asset"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute left-12 top-1/2 -translate-y-1/2 hidden group-hover/img:block z-50 shadow-2xl border border-slate-200 rounded-xl overflow-hidden bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getSafeImageUrl(asset.photo_url)}
                                alt="Asset Preview"
                                className="w-60 h-60 object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                      </td>

                      {/* Asset Code + Price & Age */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-semibold text-slate-800 text-xs sm:text-sm">
                          {asset.asset_number || '-'}
                        </div>
                        {info.meta.original_ocr_code && (
                          <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-3 h-3" />
                            ซ่อมรหัสจาก: {info.meta.original_ocr_code}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                          {asset.purchase_price !== null && asset.purchase_price !== undefined ? (
                            info.meta.is_bundled_item ? (
                              <span
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium"
                                title={`ราคาทั้งชุด ${Number(info.meta.full_set_price || 0).toLocaleString()} บาท คิดรวมอยู่ที่เครื่องหลัก`}
                              >
                                ฿0 (รวมในชุด PC)
                              </span>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                ฿{Number(asset.purchase_price).toLocaleString()}
                              </span>
                            )
                          ) : (
                            <span>ไม่ระบุราคา</span>
                          )}
                          {ageYears !== null && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium ${
                                ageYears >= 5
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              อายุ {ageYears} ปี
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Device Name + Category + Owner + Repair badge */}
                      <td className="px-4 py-3.5 max-w-[250px]">
                        <div className="font-semibold text-slate-800 truncate" title={asset.asset_name}>
                          {asset.asset_name || asset.asset_categories?.name || '-'}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          <span className="font-medium text-slate-600">
                            {asset.asset_categories?.name || '-'}
                          </span>
                          {asset.brand_model ? ` • ${asset.brand_model}` : ''}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {asset.personnel ? (
                            <span className="text-xs text-blue-700 font-medium">
                              👤 {asset.personnel.first_name} {asset.personnel.last_name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">ส่วนกลาง</span>
                          )}
                          {count > 0 && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                count >= 3
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              <Wrench className="w-2.5 h-2.5" /> ซ่อม {count}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department Comparison (IT vs Procurement) */}
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-semibold text-slate-800">
                          IT: {info.itDeptName || 'ไม่ระบุ'}
                        </div>
                        {info.procLocation ? (
                          <div className="mt-1">
                            <div
                              className={`text-[11px] ${
                                info.hasDeptConflict
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-slate-500'
                              }`}
                            >
                              พัสดุ: {info.procLocation}
                            </div>
                            {info.hasDeptConflict && (
                              <div
                                className="flex items-center gap-1 mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                                  ย้ายจุดใช้
                                </span>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={(e) => handleSingleDecision(asset, 'keep_it', 'dept', e)}
                                  className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-medium cursor-pointer"
                                  title="ยืนยันว่าย้ายมาอยู่กลุ่มงานตามที่ IT สำรวจจริง"
                                >
                                  ยึด IT
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={(e) => handleSingleDecision(asset, 'use_proc', 'dept', e)}
                                  className="text-[10px] px-1.5 py-0.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 rounded font-medium cursor-pointer"
                                  title="เปลี่ยนกลุ่มงานกลับไปตามบัญชีพัสดุ"
                                >
                                  ยึดพัสดุ
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic mt-0.5">
                            ไม่มีข้อมูลในไฟล์พัสดุ
                          </div>
                        )}
                      </td>

                      {/* Column 1: IT Status (Net Truth) */}
                      <td className="px-4 py-3.5 bg-blue-50/15">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            info.itStatus === 'ใช้งาน'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : info.itStatus === 'รอสำรวจ'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : info.itStatus === 'ชำรุด'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : info.itStatus === 'เสื่อมสภาพ'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : info.itStatus === 'พร้อมจำหน่าย'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : info.itStatus === 'จำหน่ายแล้ว'
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {info.itStatus}
                        </span>
                        {asset.last_check_date ? (
                          <div className="text-[10px] text-slate-400 mt-1">
                            สำรวจแล้ว{' '}
                            {new Date(asset.last_check_date).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-indigo-600 font-medium mt-1">
                            ยังไม่สแกนหน้างาน
                          </div>
                        )}
                      </td>

                      {/* Column 2: Procurement Status */}
                      <td className="px-4 py-3.5 bg-indigo-50/15">
                        {info.procStatus ? (
                          <div>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                info.procStatus === 'ใช้งานได้ปกติ'
                                  ? 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                                  : info.procStatus === 'จำหน่ายแล้ว'
                                  ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                                  : info.procStatus === 'รอจำหน่าย'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {info.procStatus}
                            </span>
                            {info.meta.proc_seq && (
                              <div className="text-[10px] text-slate-400 mt-1">
                                ทะเบียนพัสดุ ลำดับ #{info.meta.proc_seq}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">นอกบัญชีพัสดุ</span>
                        )}
                      </td>

                      {/* Admin Quick Decision Column */}
                      <td
                        className="px-4 py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!info.hasProcData ? (
                          <span className="text-[11px] text-slate-400">เฉพาะใน IT</span>
                        ) : info.isReconciled ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <Check className="w-3.5 h-3.5" />
                              ข้อมูลสุทธิแล้ว
                            </span>
                            {info.meta.decision_by && (
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                ({info.meta.decision_by === 'it' ? 'ยึดตาม IT' : 'ยึดตามพัสดุ'})
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 items-center">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={(e) => handleSingleDecision(asset, 'keep_it', 'both', e)}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                                title={
                                  info.isPendingSurvey
                                    ? 'ยืนยันว่าใช้งานอยู่จริงตามที่ตั้งไว้'
                                    : 'ยึดสถานะและกลุ่มงานตามที่ IT สำรวจหน้างานเป็นข้อมูลสุทธิ'
                                }
                              >
                                {info.isPendingSurvey ? 'ยืนยันใช้งาน (IT)' : 'ยึดตาม IT'}
                              </button>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={(e) => handleSingleDecision(asset, 'use_proc', 'both', e)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                title={`ปรับสถานะเป็น "${mapProcurementStatusToItStatus(
                                  info.procStatus
                                )}" ตามไฟล์พัสดุ`}
                              >
                                ยึดตามพัสดุ
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span className="text-sm font-semibold whitespace-nowrap">
              เลือกอยู่ {selectedIds.size} รายการ
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleBulkDecision('keep_it')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              ยืนยันยึดตาม IT ({selectedIds.size})
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleBulkDecision('use_proc')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              ยืนยันยึดตามพัสดุ ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ลบ ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="ยกเลิกการเลือก"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Procurement Excel Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    อัปโหลดและกระทบยอดไฟล์พัสดุประจำปี (.xlsx)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ระบบจะจับคู่รหัสครุภัณฑ์ ซ่อมรหัสที่พิมพ์ผิด เติมราคา/วันที่ได้มา และแยกสถานะ 2 คอลัมน์โดยไม่ทับข้อมูล IT
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-900">สิ่งที่ระบบดำเนินการให้อัตโนมัติ:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>ดึง <b>วันที่ได้มา</b>, <b>ราคาต่อหน่วย</b>, <b>วิธีการได้มา</b> และ <b>ใช้ที่</b> เข้าสู่ระบบ</li>
                <li>กรณีชุด PC + จอภาพใช้รหัสเดียวกัน ระบบใส่ราคาที่ตัวเครื่องหลักและใส่ ฿0 ที่จอภาพเพื่อป้องกันยอดเงินเบิ้ล</li>
                <li>ซ่อมรหัสครุภัณฑ์ที่เว้นวรรคผิดหรือเพี้ยนจาก AI OCR ให้ตรงกับบัญชีพัสดุ</li>
                <li>นำเข้ารายการที่ยังไม่มีในระบบ IT โดยตั้งสถานะเป็น <b>&quot;รอสำรวจ&quot;</b> เพื่อให้แอดมินเปรียบเทียบ 2 คอลัมน์</li>
              </ul>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUploadExcel}
              className="hidden"
            />

            <button
              type="button"
              disabled={syncing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-xl font-semibold text-sm flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span>กำลังประมวลผลและผนวกรวมข้อมูลพัสดุ...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-indigo-600" />
                  <span>คลิกเพื่อเลือกไฟล์ Excel รายงานการตรวจสอบพัสดุประจำปี (.xlsx)</span>
                </>
              )}
            </button>

            {syncResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-1.5">
                <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  ซิงค์ข้อมูลพัสดุสำเร็จเรียบร้อย!
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>• รายการในไฟล์พัสดุทั้งหมด: <b>{syncResult.totalExcelRows}</b> รายการ</div>
                  <div>• จับคู่และเติมข้อมูลสำเร็จ: <b>{syncResult.matchedDbAssets}</b> รายการ</div>
                  <div>• ซ่อมรหัส OCR อัตโนมัติ: <b>{syncResult.repairedOcrCodes}</b> รายการ</div>
                  <div>• จอ/อุปกรณ์พ่วง (฿0 กันเบิ้ล): <b>{syncResult.bundledCompanionItems}</b> รายการ</div>
                  <div>• นำเข้ารายการใหม่ (รอสำรวจ): <b>{syncResult.newlyImportedRows}</b> รายการ</div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Modal for Delete */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">ยืนยันการลบข้อมูลครุภัณฑ์</h3>
                <p className="text-sm text-slate-500 mt-1">
                  คุณกำลังจะลบข้อมูลครุภัณฑ์จำนวน{' '}
                  <span className="font-bold text-rose-600">{selectedIds.size} รายการ</span> ออกจากระบบ
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-medium">
              ⚠️ การกระทำนี้จะลบข้อมูลออกจากฐานข้อมูลอย่างถาวร และ
              <span className="font-bold underline">ไม่สามารถกู้คืนได้</span>
            </div>

            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
              {assets
                .filter((a) => selectedIds.has(a.id))
                .map((item, idx) => (
                  <div key={item.id} className="p-2.5 text-xs flex items-center justify-between">
                    <div className="truncate mr-2">
                      <span className="font-mono font-bold text-slate-800 mr-2">
                        {item.asset_number || 'ไม่ระบุรหัส'}
                      </span>
                      <span className="text-slate-600">
                        {item.asset_name || item.brand_model || '-'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">#{idx + 1}</span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังลบข้อมูล...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    ยืนยันลบถาวร ({selectedIds.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
