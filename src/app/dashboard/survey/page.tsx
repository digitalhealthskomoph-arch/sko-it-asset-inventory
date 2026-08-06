'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Loader2, Plus, MonitorSmartphone, Camera, Save, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SurveyPage() {
  const router = useRouter();
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
  const [brandModel, setBrandModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [macAddressWifi, setMacAddressWifi] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState('ใช้งาน');
  const [notes, setNotes] = useState('');

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
  
  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์รูปภาพใหญ่เกินไป (จำกัดไม่เกิน 5MB)');
      if (scanInputRef.current) scanInputRef.current.value = '';
      return;
    }

    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errorMessage = errData?.error || 'ไม่สามารถวิเคราะห์รูปภาพได้ กรุณาตรวจสอบ API Key หรือลองใหม่อีกครั้ง';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Update states if AI found something and the current field is empty
      if (data.macAddressLan && !macAddress) setMacAddress(data.macAddressLan);
      if (data.macAddressWifi && !macAddressWifi) setMacAddressWifi(data.macAddressWifi);
      if (data.ipAddress && !ipAddress) setIpAddress(data.ipAddress);
      if (data.hostName && !assetName) setAssetName(data.hostName);
      if (data.assetNumber && !assetNumber) setAssetNumber(data.assetNumber);
      if (data.serialNumber && !serialNumber) setSerialNumber(data.serialNumber);
      if (data.brandModel && !brandModel) setBrandModel(data.brandModel);
      
      alert('ดึงข้อมูลจากรูปภาพสำเร็จ โปรดตรวจสอบความถูกต้องก่อนบันทึก');
    } catch (error: any) {
      console.error('Scan error:', error);
      alert(error.message);
    } finally {
      setIsScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = '';
    }
  };
  
  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // -------------------------
  // Image Handling
  // -------------------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 5MB just in case)
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------
  // Save Data
  // -------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      let photoUrl = null;

      // 1. Upload Image to Supabase Storage (if exists)
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `survey/${fileName}`; // Put in 'survey' folder

        const { error: uploadError } = await supabase.storage
          .from('asset-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload Error:', uploadError);
          throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('asset-images')
          .getPublicUrl(filePath);
          
        photoUrl = publicUrlData.publicUrl;
      }

      // 2. Insert Record into 'assets' table
      const { error: insertError } = await supabase.from('assets').insert([
        {
          asset_number: assetNumber || null,
          asset_name: assetName,
          brand_model: brandModel || null,
          serial_number: serialNumber || null,
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
        }
      ]);

      if (insertError) throw insertError;

      alert('บันทึกข้อมูลการสำรวจเรียบร้อยแล้ว');
      
      // Navigate to Assets List
      router.push('/dashboard/assets');
      
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setSaving(false);
    }
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
          <p className="text-slate-500 text-sm mt-1">บันทึกข้อมูลและสถานะครุภัณฑ์หน้างานเข้าสู่ระบบ พ.ร.บ.ไซเบอร์</p>
        </div>
      </div>

      {/* AI Scanner Banner */}
      <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">ใช้ AI ช่วยกรอกข้อมูลอัตโนมัติ</h3>
            <p className="text-sm text-blue-700/80 mt-0.5">ถ่ายรูปหน้าจอ ipconfig หรือสติกเกอร์ครุภัณฑ์ เพื่อดึง MAC/IP, ชื่อเครื่อง และรหัสให้อัตโนมัติ</p>
          </div>
        </div>
        <input type="file" accept="image/*" capture="environment" className="hidden" ref={scanInputRef} onChange={handleScan} />
        <button 
          type="button" 
          onClick={() => scanInputRef.current?.click()}
          disabled={isScanning}
          className="w-full sm:w-auto shrink-0 bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 font-medium py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
        >
          {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          {isScanning ? 'กำลังสแกน...' : 'ถ่ายรูปสแกน'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-6">
          
          {/* Section 1: Location & Owner */}
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">1. สถานที่และผู้ใช้งาน</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">กลุ่มงาน / ฝ่าย <span className="text-red-500">*</span></label>
              <select 
                required
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSelectedPerson(''); // reset person when dept changes
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสครุภัณฑ์ (ถ้ามี)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={assetNumber}
                  onChange={(e) => setAssetNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="เช่น 7440-001-0001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่ออุปกรณ์ <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                required
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="เช่น เครื่องคอมพิวเตอร์พกพา, จอภาพ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท <span className="text-red-500">*</span></label>
              <select 
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">-- เลือกประเภท --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ยี่ห้อ / รุ่น (ถ้ามี)</label>
                <input 
                  type="text" 
                  value={brandModel}
                  onChange={(e) => setBrandModel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="เช่น HP ProDesk, Dell Latitude"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number (S/N)</label>
                <input 
                  type="text" 
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MAC Address (LAN)</label>
                <input 
                  type="text" 
                  value={macAddress}
                  onChange={handleMacChange}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm uppercase placeholder:normal-case"
                  placeholder="เช่น A1:B2:C3:D4:E5:F6"
                  maxLength={17}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MAC Address (Wi-Fi)</label>
                <input 
                  type="text" 
                  value={macAddressWifi}
                  onChange={handleMacWifiChange}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm uppercase placeholder:normal-case"
                  placeholder="เช่น A1:B2:C3:D4:E5:F6"
                  maxLength={17}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">IP Address (ถ้ามี)</label>
              <input 
                type="text" 
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                placeholder="เช่น 192.168.1.100"
              />
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
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="ใช้งาน">ใช้งานได้ปกติ</option>
                <option value="ชำรุด">ชำรุด / รอซ่อม</option>
                <option value="เสื่อมสภาพ">เสื่อมสภาพ / รอจำหน่าย</option>
                <option value="ไม่พบ">ไม่พบ / สูญหาย</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รูปภาพหน้างาน</label>
              
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageChange}
              />

              {!imagePreview ? (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">แตะเพื่อเปิดกล้องถ่ายภาพ</span>
                </button>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-48 group">
                  <a href={imagePreview} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                  </a>
                  <button 
                    type="button" 
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-600 rounded-lg shadow-sm hover:text-red-600 transition-colors z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea 
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
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
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> กำลังบันทึกอัปโหลด...</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> บันทึกและอัปโหลด</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
