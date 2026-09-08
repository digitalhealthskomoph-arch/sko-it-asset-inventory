import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. ตั้งค่า Supabase (ใช้ Service Role Key เพื่อให้อัปเดต DB ได้ทั้งหมด)
// ==========================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jxvnpqxvbnyxcvodggkw.supabase.co'; 
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; 

const R2_DOMAIN = process.env.NEXT_PUBLIC_R2_DOMAIN || 'https://assets.mophsk.online';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateDatabaseUrls() {
  console.log('🔍 กำลังค้นหาข้อมูลครุภัณฑ์ที่มีรูปภาพจาก Supabase...');

  // 1. ดึงข้อมูลที่ photo_url ไม่เป็นค่าว่าง
  const { data: assets, error: fetchError } = await supabase
    .from('assets')
    .select('id, photo_url')
    .not('photo_url', 'is', null);

  if (fetchError) {
    console.error('❌ ดึงข้อมูลไม่สำเร็จ:', fetchError);
    return;
  }

  // 2. กรองเฉพาะรูปที่ยังเป็น URL ของ Supabase
  const assetsToUpdate = assets.filter(asset => 
    asset.photo_url.includes('supabase.co') && asset.photo_url.includes('asset-images')
  );

  console.log(`พบข้อมูลที่ต้องอัปเดต URL ทั้งหมด ${assetsToUpdate.length} รายการ`);

  if (assetsToUpdate.length === 0) {
    console.log('✅ ไม่มีข้อมูลต้องอัปเดตแล้วครับ');
    return;
  }

  // 3. ทำการอัปเดตทีละรายการ
  let successCount = 0;
  for (const asset of assetsToUpdate) {
    try {
      // ดึงเฉพาะชื่อโฟลเดอร์และไฟล์ออกมา (เช่น survey/1234.jpg)
      // URL เก่าจะหน้าตาประมาณ: https://...supabase.co/storage/v1/object/public/asset-images/survey/1234.jpg
      const pathParts = asset.photo_url.split('/asset-images/');
      if (pathParts.length !== 2) continue;
      
      const filePath = pathParts[1]; // คือ "survey/1234.jpg"
      const newUrl = `${R2_DOMAIN}/${filePath}`;

      const { error: updateError } = await supabase
        .from('assets')
        .update({ photo_url: newUrl })
        .eq('id', asset.id);

      if (updateError) throw updateError;
      successCount++;
      console.log(`✅ อัปเดตรายการที่ ${asset.id} -> ${newUrl}`);
    } catch (err) {
      console.error(`❌ ผิดพลาดที่ ID ${asset.id}:`, err);
    }
  }

  console.log(`\n🎉 อัปเดต Database เสร็จสมบูรณ์! สำเร็จ ${successCount} จาก ${assetsToUpdate.length} รายการ`);
}

updateDatabaseUrls();
