'use client';

import { useState, useEffect, useRef, use } from 'react';
import { supabase } from '@/lib/supabase';
import { Camera, Save, Loader2, X, Trash2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [departments, setDepartments] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [assetName, setAssetName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [macAddressWifi, setMacAddressWifi] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState('ใช้งาน');
  const [notes, setNotes] = useState('');
  
  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // Fetch metadata
      const [deptRes, personRes, catRes, assetRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('personnel').select('*').order('first_name'),
        supabase.from('asset_categories').select('*').order('name'),
        supabase.from('assets').select('*').eq('id', id).single(),
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (personRes.data) setPersonnel(personRes.data);
      if (catRes.data) setCategories(catRes.data);

      if (assetRes.data) {
        const asset = assetRes.data;
        setSelectedDept(asset.department_id || '');
        setSelectedPerson(asset.personnel_id || '');
        setAssetNumber(asset.asset_number || '');
        setAssetName(asset.asset_name || '');
        setCategoryId(asset.category_id || '');
        setMacAddress(asset.mac_address || '');
        setMacAddressWifi(asset.mac_address_wifi || '');
        setIpAddress(asset.ip_address || '');
        setStatus(asset.status || 'ใช้งาน');
        setNotes(asset.notes || '');
        setExistingPhotoUrl(asset.photo_url || null);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('ไม่พบข้อมูลครุภัณฑ์นี้');
      router.push('/dashboard/assets');
    } finally {
      setLoading(false);
    }
  };

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    if (val.length > 12) val = val.slice(0, 12);
    const match = val.match(/.{1,2}/g);
    setMacAddress(match ? match.join(':') : '');
  };

  const handleMacWifiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    if (val.length > 12) val = val.slice(0, 12);
    const match = val.match(/.{1,2}/g);
    setMacAddressWifi(match ? match.join(':') : '');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์รูปภาพใหญ่เกินไป (จำกัดไม่เกิน 5MB)');
      return;
    }

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setExistingPhotoUrl(null); // Mark for deletion of existing photo if saving
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      let photoUrl = existingPhotoUrl;

      // Upload New Image
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `survey/${fileName}`; 

        const { error: uploadError } = await supabase.storage
          .from('asset-images')
          .upload(filePath, imageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');

        const { data: publicUrlData } = supabase.storage
          .from('asset-images')
          .getPublicUrl(filePath);
          
        photoUrl = publicUrlData.publicUrl;
      }

      // Update Record
      const { error: updateError } = await supabase.from('assets').update({
        asset_number: assetNumber || null,
        asset_name: assetName,
        category_id: categoryId,
        department_id: selectedDept || null,
        personnel_id: selectedPerson || null,
        ip_address: ipAddress || null,
        mac_address: macAddress || null,
        mac_address_wifi: macAddressWifi || null,
        status: status,
        notes: notes,
        photo_url: photoUrl,
        last_check_date: new Date().toISOString(),
      }).eq('id', id);

      if (updateError) throw updateError;

      alert('อัปเดตข้อมูลสำเร็จ');
      router.push('/dashboard/assets');
      
    } catch (error: any) {
      console.error('Update Error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('คุณต้องการลบข้อมูลครุภัณฑ์นี้ใช่หรือไม่? (การกระทำนี้ไม่สามารถกู้คืนได้)')) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      router.push('/dashboard/assets');
    } catch (error: any) {
      alert(`ลบไม่สำเร็จ: ${error.message}`);
      setDeleting(false);
    }
  };

  const filteredPersonnel = selectedDept 
    ? personnel.filter(p => p.department_id === selectedDept)
    : personnel;

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  const currentImageDisplay = imagePreview || existingPhotoUrl;

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/assets" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">แก้ไขข้อมูล</h1>
            <p className="text-slate-500 text-sm mt-1">{assetName} {assetNumber ? `(${assetNumber})` : ''}</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          ลบรายการ
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6">
          
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">1. สถานที่และผู้ใช้งาน</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">กลุ่มงาน / ฝ่าย <span className="text-red-500">*</span></label>
              <select required value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setSelectedPerson(''); }} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                <option value="">-- เลือกกลุ่มงาน --</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ผู้ครอบครอง / ใช้งานหลัก (ถ้ามี)</label>
              <select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" disabled={!selectedDept}>
                <option value="">-- ไม่ระบุ / ส่วนกลาง --</option>
                {filteredPersonnel.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">2. ข้อมูลครุภัณฑ์</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสครุภัณฑ์ (ถ้ามี)</label>
              <input type="text" value={assetNumber} onChange={(e) => setAssetNumber(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่ออุปกรณ์ <span className="text-red-500">*</span></label>
              <input type="text" required value={assetName} onChange={(e) => setAssetName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท <span className="text-red-500">*</span></label>
              <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                <option value="">-- เลือกประเภท --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MAC Address (LAN)</label>
                <input type="text" value={macAddress} onChange={handleMacChange} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm uppercase placeholder:normal-case" placeholder="เช่น A1:B2:C3:D4:E5:F6" maxLength={17} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MAC Address (Wi-Fi)</label>
                <input type="text" value={macAddressWifi} onChange={handleMacWifiChange} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm uppercase placeholder:normal-case" placeholder="เช่น A1:B2:C3:D4:E5:F6" maxLength={17} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">IP Address (ถ้ามี)</label>
              <input type="text" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm" placeholder="เช่น 192.168.1.100" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">3. สถานะและรูปภาพ</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สถานะปัจจุบัน</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                <option value="ใช้งาน">ใช้งานได้ปกติ</option>
                <option value="ชำรุด">ชำรุด / รอซ่อม</option>
                <option value="เสื่อมสภาพ">เสื่อมสภาพ / รอจำหน่าย</option>
                <option value="ไม่พบ">ไม่พบ / สูญหาย</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รูปภาพหน้างาน</label>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              {!currentImageDisplay ? (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">แตะเพื่อเปิดกล้องหรือเปลี่ยนรูป</span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-48">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={currentImageDisplay} alt="Preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-600 rounded-lg shadow-sm hover:text-red-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none" placeholder="ระบุอาการชำรุด หรือข้อมูลเพิ่มเติม..." />
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 lg:static lg:bg-transparent lg:border-none lg:p-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] lg:shadow-none flex gap-3">
            <button type="submit" disabled={saving || deleting} className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-70">
              {saving ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> กำลังบันทึก...</> : <><Save className="w-5 h-5 mr-2" /> บันทึกการแก้ไข</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
