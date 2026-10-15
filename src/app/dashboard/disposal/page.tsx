'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getSafeImageUrl } from '@/lib/image-url';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import {
  PackageX,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  CheckSquare,
  Square,
  ExternalLink,
  Eye,
  RefreshCw,
  X,
  FileDown,
  DollarSign,
  Building2,
  Wrench,
  Clock,
  ArrowRight,
  RotateCcw
} from 'lucide-react';

interface AssetRecord {
  id: string;
  asset_number: string | null;
  gf_number: string | null;
  asset_name: string | null;
  category_id: string | null;
  asset_group: string | null;
  brand_model: string | null;
  serial_number: string | null;
  department_id: string | null;
  personnel_id: string | null;
  location_details: string | null;
  acquisition_date: string | null;
  purchase_price: number | null;
  status: string | null;
  problem_description: string | null;
  photo_url: string | null;
  departments?: { name: string } | null;
  personnel?: { first_name: string; last_name: string } | null;
  asset_categories?: { name: string } | null;
}

export default function DisposalPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [repairCounts, setRepairCounts] = useState<Record<string, number>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Tabs: 'ready' (พร้อมจำหน่าย) | 'candidates' (เข้าเกณฑ์จำหน่าย/ชำรุด) | 'disposed' (ตัดจำหน่ายแล้ว)
  const [activeTab, setActiveTab] = useState<'ready' | 'candidates' | 'disposed'>('ready');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Selected Checkboxes
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // PDF Preview & Customization Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [docNumber, setDocNumber] = useState('สส 0032.001/ -');
  const [reportDate, setReportDate] = useState(() => {
    const today = new Date();
    return today.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });
  const [reportObjective, setReportObjective] = useState(
    'เพื่อเสนอคณะกรรมการดำเนินการตรวจสอบสภาพและขออนุมัติจำหน่ายพัสดุชำรุด เสื่อมสภาพ หรือไม่จำเป็นต้องใช้ในหน่วยงาน ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560'
  );
  const [signer1Name, setSigner1Name] = useState('');
  const [signer1Pos, setSigner1Pos] = useState('เจ้าหน้าที่ผู้จัดทำรายงาน');
  const [signer2Name, setSigner2Name] = useState('');
  const [signer2Pos, setSigner2Pos] = useState('เจ้าหน้าที่ผู้ตรวจสอบสภาพพัสดุ');
  const [signer3Name, setSigner3Name] = useState('');
  const [signer3Pos, setSigner3Pos] = useState('หัวหน้ากลุ่มงานเทคโนโลยีสารสนเทศ');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [deptRes, catRes, assetsRes, ticketsRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('asset_categories').select('id, name').order('name'),
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
          .not('asset_id', 'is', null)
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (catRes.data) setCategories(catRes.data);

      if (ticketsRes.data) {
        const counts: Record<string, number> = {};
        ticketsRes.data.forEach((t: any) => {
          if (t.asset_id) {
            counts[t.asset_id] = (counts[t.asset_id] || 0) + 1;
          }
        });
        setRepairCounts(counts);
      }

      if (assetsRes.data) setAssets(assetsRes.data);
    } catch (error) {
      console.error('Error fetching disposal data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate age in years
  const getAssetAge = (acquisitionDate: string | null) => {
    if (!acquisitionDate) return null;
    const acqTime = new Date(acquisitionDate).getTime();
    if (isNaN(acqTime)) return null;
    return Math.floor((Date.now() - acqTime) / (365.25 * 24 * 3600 * 1000));
  };

  // Categorize assets
  const categorizedAssets = useMemo(() => {
    const ready: AssetRecord[] = [];
    const candidates: AssetRecord[] = [];
    const disposed: AssetRecord[] = [];

    assets.forEach((asset) => {
      const currentStatus = asset.status || 'ใช้งาน';
      const repairCount = repairCounts[asset.id] || 0;
      const age = getAssetAge(asset.acquisition_date);

      if (currentStatus === 'จำหน่ายแล้ว') {
        disposed.push(asset);
      } else if (currentStatus === 'พร้อมจำหน่าย') {
        ready.push(asset);
      } else {
        // Candidates: ชำรุด, เสื่อมสภาพ, ซ่อมสะสม >= 3 ครั้ง, หรืออายุ >= 5 ปี
        const isCandidate =
          currentStatus === 'ชำรุด' ||
          currentStatus === 'เสื่อมสภาพ' ||
          repairCount >= 3 ||
          (age !== null && age >= 5 && repairCount >= 1);

        if (isCandidate) {
          candidates.push(asset);
        }
      }
    });

    return { ready, candidates, disposed };
  }, [assets, repairCounts]);

  // Current tab items
  const currentTabAssets = useMemo(() => {
    return categorizedAssets[activeTab];
  }, [categorizedAssets, activeTab]);

  // Filter items in current tab
  const filteredAssets = useMemo(() => {
    return currentTabAssets.filter((asset) => {
      const matchesSearch =
        !searchTerm ||
        asset.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.asset_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.gf_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.brand_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.personnel?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.departments?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = selectedDept ? asset.department_id === selectedDept : true;
      const matchesCat = selectedCategory ? asset.category_id === selectedCategory : true;

      return matchesSearch && matchesDept && matchesCat;
    });
  }, [currentTabAssets, searchTerm, selectedDept, selectedCategory]);

  // Items to export or action (either user checked items, or all currently filtered items if none selected)
  const itemsForAction = useMemo(() => {
    if (selectedIds.size > 0) {
      return filteredAssets.filter((a) => selectedIds.has(a.id));
    }
    return filteredAssets;
  }, [filteredAssets, selectedIds]);

  // Calculation of Stats
  const stats = useMemo(() => {
    const readyTotalValue = categorizedAssets.ready.reduce(
      (sum, a) => sum + (Number(a.purchase_price) || 0),
      0
    );
    const candidateTotalValue = categorizedAssets.candidates.reduce(
      (sum, a) => sum + (Number(a.purchase_price) || 0),
      0
    );
    const disposedTotalValue = categorizedAssets.disposed.reduce(
      (sum, a) => sum + (Number(a.purchase_price) || 0),
      0
    );

    return {
      readyCount: categorizedAssets.ready.length,
      readyTotalValue,
      candidateCount: categorizedAssets.candidates.length,
      candidateTotalValue,
      disposedCount: categorizedAssets.disposed.length,
      disposedTotalValue
    };
  }, [categorizedAssets]);

  // Checkbox helpers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk Status Updates
  const updateStatus = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      alert('กรุณาเลือกรายการครุภัณฑ์ที่ต้องการดำเนินการ');
      return;
    }

    const count = selectedIds.size;
    const confirmMsg = `ยืนยันการปรับสถานะ ${count} รายการ เป็น "${newStatus}" ใช่หรือไม่?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('assets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;

      // Update local state
      setAssets((prev) =>
        prev.map((a) => (ids.includes(a.id) ? { ...a, status: newStatus } : a))
      );
      setSelectedIds(new Set());
      alert(`อัปเดตสถานะเป็น "${newStatus}" สำเร็จเรียบร้อยแล้ว (${count} รายการ)`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + (error.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Format currency
  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Format Date Thai
  const formatDateThai = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 1. Export Excel
  const handleExportExcel = () => {
    const list = itemsForAction;
    if (list.length === 0) {
      alert('ไม่มีรายการสำหรับส่งออก');
      return;
    }

    // Build worksheet data table
    const headers = [
      'ลำดับ',
      'รหัสครุภัณฑ์',
      'หมายเลขสินทรัพย์ (GFMIS)',
      'ชื่อครุภัณฑ์ / รายการ',
      'ยี่ห้อ / รุ่น',
      'หมายเลขเครื่อง (Serial Number)',
      'กลุ่มงาน / ฝ่าย',
      'ผู้ถือครอง / ผู้ใช้งาน',
      'วันที่ได้มา',
      'อายุใช้งาน (ปี)',
      'ราคาจัดซื้อ (บาท)',
      'สภาพการชำรุด / เหตุผลขอจำหน่าย',
      'ประวัติการส่งซ่อม (ครั้ง)',
      'สถานะ',
      'ลิงก์รูปภาพสภาพครุภัณฑ์'
    ];

    const rows = list.map((asset, index) => {
      const age = getAssetAge(asset.acquisition_date);
      const repairs = repairCounts[asset.id] || 0;
      const photoUrl = getSafeImageUrl(asset.photo_url);

      return [
        index + 1,
        asset.asset_number || '-',
        asset.gf_number || '-',
        asset.asset_name || '-',
        asset.brand_model || '-',
        asset.serial_number || '-',
        asset.departments?.name || '-',
        asset.personnel ? `${asset.personnel.first_name} ${asset.personnel.last_name}` : '-',
        asset.acquisition_date || '-',
        age !== null ? age : '-',
        asset.purchase_price !== null ? Number(asset.purchase_price) : 0,
        asset.problem_description ||
          (asset.status === 'เสื่อมสภาพ'
            ? 'เสื่อมสภาพตามอายุการใช้งาน'
            : asset.status === 'ชำรุด'
            ? 'ชำรุด ซ่อมแซมไม่คุ้มค่า'
            : 'เสนอขอจำหน่าย'),
        repairs,
        asset.status || 'พร้อมจำหน่าย',
        photoUrl ? 'เปิดดูรูปภาพ' : '-'
      ];
    });

    // Summary Row
    const totalPrice = list.reduce((sum, a) => sum + (Number(a.purchase_price) || 0), 0);
    const summaryRow = [
      'รวมทั้งสิ้น',
      `${list.length} รายการ`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalPrice,
      '',
      '',
      '',
      ''
    ];

    const data = [headers, ...rows, summaryRow];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Apply Hyperlinks to Photo URLs
    list.forEach((asset, idx) => {
      const photoUrl = getSafeImageUrl(asset.photo_url);
      if (photoUrl) {
        // Column O is index 14 -> cell coordinate O{idx + 2} (1-indexed, header is row 1)
        const cellAddress = XLSX.utils.encode_cell({ r: idx + 1, c: 14 });
        ws[cellAddress] = {
          t: 's',
          v: 'คลิกเปิดดูรูปภาพสภาพจริง',
          l: { Target: photoUrl, Tooltip: 'คลิกเปิดดูรูปภาพสภาพครุภัณฑ์' }
        };
      }
    });

    // Set Column Widths
    ws['!cols'] = [
      { wch: 6 }, // ลำดับ
      { wch: 22 }, // รหัสครุภัณฑ์
      { wch: 20 }, // GF
      { wch: 28 }, // รายการ
      { wch: 24 }, // ยี่ห้อ/รุ่น
      { wch: 22 }, // S/N
      { wch: 22 }, // กลุ่มงาน
      { wch: 22 }, // ผู้ถือครอง
      { wch: 14 }, // วันที่ได้มา
      { wch: 12 }, // อายุ
      { wch: 16 }, // ราคา
      { wch: 32 }, // สภาพ/เหตุผล
      { wch: 14 }, // ซ่อมสะสม
      { wch: 14 }, // สถานะ
      { wch: 24 } // ลิงก์รูป
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายการขอจำหน่าย');

    const fileDate = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `รายงานขอจำหน่ายครุภัณฑ์_สสจ.สระแก้ว_${fileDate}.xlsx`);
  };

  // 2. Open PDF Preview Modal
  const handleOpenPdfModal = () => {
    const list = itemsForAction;
    if (list.length === 0) {
      alert('ไม่มีรายการสำหรับออกรายงาน PDF');
      return;
    }
    setShowPdfModal(true);
  };

  // Print PDF from browser
  const handlePrint = () => {
    window.print();
  };

  // Render official report content (Used in both modal preview and print container)
  const renderReportContent = (isForPrint: boolean) => (
    <div className={`print-area ${isForPrint ? 'w-full bg-white text-black font-sans m-0 p-0' : 'bg-white text-black p-8 sm:p-12 shadow-md w-full max-w-[1100px] font-sans'}`}>
      {/* 1. Official Header */}
      <div className="text-center pb-4 border-b-2 border-slate-800">
        <h2 className="text-xl font-bold tracking-wide">
          สำนักงานสาธารณสุขจังหวัดสระแก้ว
        </h2>
        <h3 className="text-lg font-bold mt-1 text-slate-900">
          รายงานสรุปรายการครุภัณฑ์คอมพิวเตอร์และอุปกรณ์ไอทีเพื่อเสนอขอจำหน่าย
        </h3>
        <div className="flex justify-between items-center text-xs mt-3 text-slate-700">
          <span>เลขที่เอกสาร: {docNumber}</span>
          <span>วันที่: {reportDate}</span>
        </div>
        <div className="text-left text-xs mt-2 text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
          <span className="font-semibold">เรื่อง / วัตถุประสงค์: </span>
          <span>{reportObjective}</span>
        </div>
      </div>

      {/* 2. Official Table */}
      <div className="mt-4">
        <table className="w-full text-xs text-left border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="border border-slate-400 px-2 py-2 text-center w-8">ที่</th>
              <th className="border border-slate-400 px-2 py-2 text-center w-16">รูปภาพ</th>
              <th className="border border-slate-400 px-2 py-2 w-32">รหัสครุภัณฑ์ / เลข GF</th>
              <th className="border border-slate-400 px-2 py-2">รายการ / ยี่ห้อ / รุ่น / S/N</th>
              <th className="border border-slate-400 px-2 py-2 w-28">กลุ่มงาน / ผู้ถือครอง</th>
              <th className="border border-slate-400 px-2 py-2 text-center w-20">วันที่ได้มา</th>
              <th className="border border-slate-400 px-2 py-2 text-right w-24">ราคาจัดซื้อ (บาท)</th>
              <th className="border border-slate-400 px-2 py-2">สภาพการชำรุด / เหตุผลที่เสนอขอจำหน่าย</th>
            </tr>
          </thead>
          <tbody>
            {itemsForAction.map((asset, idx) => {
              const photoUrl = getSafeImageUrl(asset.photo_url);
              const age = getAssetAge(asset.acquisition_date);
              const repairs = repairCounts[asset.id] || 0;

              return (
                <tr key={asset.id} className="border-b border-slate-300">
                  <td className="border border-slate-300 px-2 py-2 text-center font-medium">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 px-1 py-1 text-center">
                    {photoUrl ? (
                      <div className="w-12 h-12 mx-auto rounded overflow-hidden border border-slate-300 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl}
                          alt="Asset"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">ไม่มีรูป</span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 font-mono">
                    <div className="font-semibold text-slate-900">
                      {asset.asset_number || '-'}
                    </div>
                    {asset.gf_number && (
                      <div className="text-[10px] text-slate-600">GF: {asset.gf_number}</div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <div className="font-semibold text-slate-900">{asset.asset_name || '-'}</div>
                    <div className="text-[11px] text-slate-700">
                      {asset.brand_model || '-'}
                    </div>
                    {asset.serial_number && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        S/N: {asset.serial_number}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <div>{asset.departments?.name || '-'}</div>
                    <div className="text-[10px] text-slate-500">
                      {asset.personnel
                        ? `${asset.personnel.first_name} ${asset.personnel.last_name}`
                        : '-'}
                    </div>
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">
                    <div>{formatDateThai(asset.acquisition_date)}</div>
                    {age !== null && (
                      <div className="text-[10px] text-slate-500">({age} ปี)</div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-medium">
                    {formatPrice(asset.purchase_price)}
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <div>
                      {asset.problem_description ||
                        (asset.status === 'เสื่อมสภาพ'
                          ? 'เสื่อมสภาพตามอายุการใช้งาน ไม่คุ้มค่าในการซ่อมแซม'
                          : asset.status === 'ชำรุด'
                          ? 'ชำรุด ไม่สามารถใช้งานได้'
                          : 'เสนอจำหน่าย')}
                    </div>
                    {repairs > 0 && (
                      <div className="text-[10px] text-rose-700 mt-0.5">
                        (มีประวัติส่งซ่อม {repairs} ครั้ง)
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
              <td
                colSpan={6}
                className="border border-slate-400 px-3 py-2 text-right text-slate-800"
              >
                รวมจำนวนทั้งสิ้น {itemsForAction.length} รายการ | รวมมูลค่าจัดซื้อทั้งสิ้น:
              </td>
              <td className="border border-slate-400 px-2 py-2 text-right text-slate-900">
                {formatPrice(
                  itemsForAction.reduce(
                    (sum, a) => sum + (Number(a.purchase_price) || 0),
                    0
                  )
                )}
              </td>
              <td className="border border-slate-400 px-2 py-2 text-xs text-slate-600">
                บาท
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 3. Official Signatures Section */}
      <div className="signature-block mt-8 pt-4 grid grid-cols-3 gap-6 text-center text-xs">
        {/* Signer 1 */}
        <div className="flex flex-col items-center">
          <div className="h-14 flex items-end justify-center w-48 border-b border-dotted border-slate-400 pb-1">
            {signer1Name ? (
              <span className="font-semibold text-slate-800">{signer1Name}</span>
            ) : (
              <span className="text-slate-300 text-[10px]">(ลงชื่อ)</span>
            )}
          </div>
          <div className="mt-1.5 font-medium text-slate-800">
            (............................................................)
          </div>
          <div className="mt-1 text-slate-600">{signer1Pos}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            วันที่ ......./......./...........
          </div>
        </div>

        {/* Signer 2 */}
        <div className="flex flex-col items-center">
          <div className="h-14 flex items-end justify-center w-48 border-b border-dotted border-slate-400 pb-1">
            {signer2Name ? (
              <span className="font-semibold text-slate-800">{signer2Name}</span>
            ) : (
              <span className="text-slate-300 text-[10px]">(ลงชื่อ)</span>
            )}
          </div>
          <div className="mt-1.5 font-medium text-slate-800">
            (............................................................)
          </div>
          <div className="mt-1 text-slate-600">{signer2Pos}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            วันที่ ......./......./...........
          </div>
        </div>

        {/* Signer 3 */}
        <div className="flex flex-col items-center">
          <div className="h-14 flex items-end justify-center w-48 border-b border-dotted border-slate-400 pb-1">
            {signer3Name ? (
              <span className="font-semibold text-slate-800">{signer3Name}</span>
            ) : (
              <span className="text-slate-300 text-[10px]">(ลงชื่อ)</span>
            )}
          </div>
          <div className="mt-1.5 font-medium text-slate-800">
            (............................................................)
          </div>
          <div className="mt-1 text-slate-600">{signer3Pos}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            วันที่ ......./......./...........
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <PackageX className="w-7 h-7 text-purple-600" />
            <h1 className="text-2xl font-bold text-slate-800">ระบบจัดการขอจำหน่ายพัสดุ (Disposal)</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            ตรวจนับ ยืนยันความพร้อมของพัสดุ และส่งออกรายงาน (PDF / Excel) ส่งงานพัสดุ สสจ.สระแก้ว
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialData}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            ส่งออก Excel (.xlsx)
          </button>
          <button
            onClick={handleOpenPdfModal}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            พิมพ์ / บันทึกรายงาน PDF
          </button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        {/* Card 1: พร้อมจำหน่าย */}
        <div
          onClick={() => {
            setActiveTab('ready');
            clearSelection();
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'ready'
              ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-400/30 shadow-xs'
              : 'bg-white border-slate-200 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              พร้อมจำหน่าย (ยืนยันแล้ว)
            </span>
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{stats.readyCount}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-1 font-medium">
            <span>มูลค่ารวม:</span>
            <span className="font-bold text-purple-700">{formatPrice(stats.readyTotalValue)}</span>
            <span>บาท</span>
          </div>
        </div>

        {/* Card 2: รายการเข้าเกณฑ์เสี่ยง/ชำรุด */}
        <div
          onClick={() => {
            setActiveTab('candidates');
            clearSelection();
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'candidates'
              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              เข้าเกณฑ์เสนอจำหน่าย (รอตรวจของ)
            </span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{stats.candidateCount}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-1 font-medium">
            <span>ชำรุด / เสื่อมสภาพ / ซ่อมบ่อย</span>
          </div>
        </div>

        {/* Card 3: ตัดจำหน่ายแล้ว */}
        <div
          onClick={() => {
            setActiveTab('disposed');
            clearSelection();
          }}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'disposed'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/30 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              ตัดจำหน่ายสำเร็จ (ประวัติ)
            </span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
              <PackageX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800">{stats.disposedCount}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-1 font-medium">
            <span>มูลค่าตัดจำหน่าย:</span>
            <span className="font-bold text-slate-700">{formatPrice(stats.disposedTotalValue)}</span>
            <span>บาท</span>
          </div>
        </div>
      </div>

      {/* 3. Main Data Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden no-print">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-3 gap-2">
          <button
            onClick={() => {
              setActiveTab('ready');
              clearSelection();
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ready'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            1. รายการพร้อมจำหน่าย
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 font-semibold">
              {stats.readyCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('candidates');
              clearSelection();
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'candidates'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            2. รอตรวจนับสภาพ / เข้าเกณฑ์
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">
              {stats.candidateCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('disposed');
              clearSelection();
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'disposed'
                ? 'border-slate-600 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageX className="w-4 h-4" />
            3. ตัดจำหน่ายแล้ว
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-700 font-semibold">
              {stats.disposedCount}
            </span>
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="ค้นหาชื่อ, รหัส, เลข GF, S/N, หรือผู้ครอบครอง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="">ทุกกลุ่มงาน</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              <option value="">ทุกประเภท</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons on selection */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {activeTab === 'candidates' && (
              <button
                onClick={() => updateStatus('พร้อมจำหน่าย')}
                disabled={selectedIds.size === 0 || actionLoading}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                ยืนยันของอยู่ "พร้อมจำหน่าย" {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            )}

            {activeTab === 'ready' && (
              <button
                onClick={() => updateStatus('จำหน่ายแล้ว')}
                disabled={selectedIds.size === 0 || actionLoading}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center shadow-xs cursor-pointer"
              >
                <PackageX className="w-4 h-4 mr-1.5" />
                บันทึกตัดจำหน่ายสำเร็จ {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            )}

            {(activeTab === 'ready' || activeTab === 'disposed') && (
              <button
                onClick={() => updateStatus('ใช้งาน')}
                disabled={selectedIds.size === 0 || actionLoading}
                className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center cursor-pointer"
                title="เปลี่ยนกลับเป็นสถานะใช้งาน"
              >
                <RotateCcw className="w-4 h-4 mr-1.5 text-slate-500" />
                ย้อนเป็น "ใช้งาน"
              </button>
            )}
          </div>
        </div>

        {/* Selection summary banner */}
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-slate-700 hover:text-purple-700 font-semibold cursor-pointer"
            >
              {selectedIds.size > 0 && selectedIds.size === filteredAssets.length ? (
                <CheckSquare className="w-4 h-4 text-purple-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>เลือกทั้งหมด ({filteredAssets.length} รายการ)</span>
            </button>
            {selectedIds.size > 0 && (
              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                เลือกอยู่ {selectedIds.size} รายการ
              </span>
            )}
          </div>
          <div className="font-medium text-slate-600">
            มูลค่ารวมในหน้านี้:{' '}
            <span className="font-bold text-slate-900">
              {formatPrice(
                itemsForAction.reduce((s, a) => s + (Number(a.purchase_price) || 0), 0)
              )}
            </span>{' '}
            บาท
          </div>
        </div>

        {/* Assets Table */}
        <div className="overflow-x-auto min-h-[350px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm">กำลังโหลดข้อมูลครุภัณฑ์...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <PackageX className="w-12 h-12 text-slate-300" />
              <p className="text-sm">ไม่พบรายการครุภัณฑ์ในหมวดนี้</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="bg-slate-50/80 sticky top-0 z-10 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <button onClick={handleSelectAll} className="cursor-pointer">
                      {selectedIds.size > 0 && selectedIds.size === filteredAssets.length ? (
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3.5 w-14">รูป</th>
                  <th className="px-4 py-3.5">รหัสครุภัณฑ์ / GF</th>
                  <th className="px-4 py-3.5">รายการอุปกรณ์ / ยี่ห้อรุ่น</th>
                  <th className="px-4 py-3.5">กลุ่มงาน / ผู้ถือครอง</th>
                  <th className="px-4 py-3.5">วันที่ได้มา / อายุ</th>
                  <th className="px-4 py-3.5 text-right">ราคาจัดซื้อ (บาท)</th>
                  <th className="px-4 py-3.5">สภาพ / เหตุผลเสนอจำหน่าย</th>
                  <th className="px-3 py-3.5 text-center">ส่งซ่อม</th>
                  <th className="px-4 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAssets.map((asset, idx) => {
                  const isSelected = selectedIds.has(asset.id);
                  const age = getAssetAge(asset.acquisition_date);
                  const repairs = repairCounts[asset.id] || 0;
                  const photoUrl = getSafeImageUrl(asset.photo_url);

                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-purple-50/40 transition-colors ${
                        isSelected ? 'bg-purple-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(asset.id)}
                          className="cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {photoUrl ? (
                          <div className="relative group/img w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrl}
                              alt="Asset"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute left-12 top-1/2 -translate-y-1/2 hidden group-hover/img:block z-[60] shadow-2xl border border-slate-200 rounded-xl overflow-hidden bg-white w-48 h-48">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl}
                                alt="Asset Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                            -
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {asset.asset_number || '-'}
                        </div>
                        {asset.gf_number && (
                          <div className="text-xs text-slate-500 font-mono">
                            GF: {asset.gf_number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{asset.asset_name || '-'}</div>
                        <div className="text-xs text-slate-500">
                          {asset.brand_model || '-'} {asset.serial_number ? `(S/N: ${asset.serial_number})` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{asset.departments?.name || '-'}</div>
                        <div className="text-xs text-slate-500">
                          {asset.personnel
                            ? `${asset.personnel.first_name} ${asset.personnel.last_name}`
                            : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{formatDateThai(asset.acquisition_date)}</div>
                        {age !== null && (
                          <div className="text-xs text-slate-500 font-medium">
                            อายุ {age} ปี {age >= 5 ? '⚠️ เกินเกณฑ์' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {formatPrice(asset.purchase_price)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-700 line-clamp-2 max-w-xs">
                          {asset.problem_description ||
                            (asset.status === 'เสื่อมสภาพ'
                              ? 'เสื่อมสภาพตามอายุการใช้งาน'
                              : asset.status === 'ชำรุด'
                              ? 'ชำรุดซ่อมแซมไม่คุ้มค่า'
                              : 'ขอจำหน่าย')}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {repairs > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            {repairs} ครั้ง
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/dashboard/assets/${asset.id}`}
                          className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="ดูรายละเอียดครุภัณฑ์"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. PDF Preview & Print Modal */}
      {/* 4. PDF Preview Modal (Screen only, completely hidden during print) */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Controls */}
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-purple-600" />
                  พรีวิวเอกสารรายงานขอจำหน่ายพัสดุ (PDF Report)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ตรวจสอบความถูกต้อง และกดปุ่มพิมพ์ด้านขวาเพื่อ Save as PDF หรือส่งออกเครื่องพิมพ์
                </p>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={handlePrint}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  สั่งพิมพ์ / บันทึกเป็น PDF
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metadata Config Bar */}
            <div className="p-4 bg-purple-50/50 border-b border-purple-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">เลขที่หนังสือ / รายงาน</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันที่ออกรายงาน</label>
                <input
                  type="text"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">วัตถุประสงค์ / หมายเหตุ</label>
                <input
                  type="text"
                  value={reportObjective}
                  onChange={(e) => setReportObjective(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Scrollable Preview on Screen */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-100 flex justify-center">
              {renderReportContent(false)}
            </div>
          </div>
        </div>
      )}

      {/* 5. Dedicated Print Container (Hidden on screen, active only when window.print() is called) */}
      <div className="hidden print:block w-full m-0 p-0">
        {renderReportContent(true)}
      </div>
    </div>
  );
}
