import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';

// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
const SUPABASE_URL = 'https://jxvnpqxvbnyxcvodggkw.supabase.co'; // ดึงจาก URL ในรูป
// ⚠️ ข้อควรระวัง: ปกติ Service Role Key ของ Supabase จะขึ้นต้นด้วย eyJ... 
// หากรันแล้ว Error ให้ลองกลับไป Copy Service Role Key มาใหม่นะครับ
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4dm5wcXh2Ym55eGN2b2RnZ2t3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTk2NzE4NywiZXhwIjoyMTAxNTQzMTg3fQ.oVFpY_fgE9i5LH0SsLX7lRadPob0cjJBocXtXgLUc1U'; 
const SUPABASE_BUCKET = 'asset-images';

// ==========================================
// 2. ตั้งค่า Cloudflare R2
// ==========================================
const R2_ACCOUNT_ID = '138823bdd5164bcdb49dc744afb0f871';
const R2_ACCESS_KEY_ID = 'fa0d3ea82509fdf710e16137c1afd8c5';
const R2_SECRET_ACCESS_KEY = '1d57f935c0df0cffb8eedf23170064a3547708ffbf3f9b83e0ed068aae5efc3b';
const R2_BUCKET = 'my-app-assets'; // ชื่อ Bucket ใน R2 ที่เราสร้างไว้ตอนแรก (แก้ให้ตรงถ้าเปลี่ยนชื่อ)

// ==========================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ฟังก์ชันช่วยหาไฟล์ทั้งหมดแบบ Recursive (เผื่อมีโฟลเดอร์ซ้อนกัน)
async function listAllFiles(path = '') {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list(path, { limit: 1000 });
  if (error) {
    console.error(`❌ ดึงรายชื่อจาก path '${path}' ไม่สำเร็จ:`, error.message);
    return [];
  }

  let allFiles = [];
  for (const item of data) {
    if (item.name === '.emptyFolderPlaceholder') continue;
    
    // ถ้าไม่มี metadata แปลว่าเป็น Folder (ต้องเข้าไปหาข้างในต่อ)
    if (!item.metadata) {
      const folderPath = path ? `${path}/${item.name}` : item.name;
      const subFiles = await listAllFiles(folderPath);
      allFiles = allFiles.concat(subFiles);
    } else {
      // เป็นไฟล์จริงๆ
      item.fullPath = path ? `${path}/${item.name}` : item.name;
      allFiles.push(item);
    }
  }
  return allFiles;
}

async function migrate() {
  console.log(`🚀 กำลังเริ่มย้ายไฟล์จาก Supabase '${SUPABASE_BUCKET}' ไปยัง R2 '${R2_BUCKET}'...`);

  // 1. ดึงรายชื่อไฟล์ทั้งหมด (รวมในโฟลเดอร์ย่อย)
  console.log('🔍 กำลังสแกนหาไฟล์ทั้งหมด...');
  const validFiles = await listAllFiles();
  
  if (validFiles.length === 0) {
    console.log('📂 ไม่พบไฟล์ให้ย้ายเลยครับ!');
    return;
  }
  
  console.log(`📂 พบไฟล์ทั้งหมด ${validFiles.length} ไฟล์\n`);

  // 2. ลูปดาวน์โหลดและอัปโหลดทีละไฟล์
  for (const file of validFiles) {
    try {
      console.log(`⏳ กำลังย้าย: ${file.fullPath} (${(file.metadata.size / 1024).toFixed(2)} KB)`);

      // 2.1 ดาวน์โหลดจาก Supabase
      const { data: fileBlob, error: downloadError } = await supabase
        .storage
        .from(SUPABASE_BUCKET)
        .download(file.fullPath);

      if (downloadError) throw downloadError;

      // แปลงไฟล์เป็น Buffer เพื่อเตรียมอัปโหลด
      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2.2 อัปโหลดไปยัง R2
      const uploadParams = {
        Bucket: R2_BUCKET,
        Key: file.fullPath, // ใช้ชื่อไฟล์เดิมพร้อมโครงสร้างโฟลเดอร์
        Body: buffer,
        ContentType: fileBlob.type, 
      };

      await s3.send(new PutObjectCommand(uploadParams));
      console.log(`✅ อัปโหลด ${file.fullPath} สำเร็จ!`);

    } catch (err) {
      console.error(`❌ เกิดข้อผิดพลาดกับไฟล์ ${file.fullPath}:`, err.message || err);
    }
  }

  console.log('\n🎉 ย้ายไฟล์เสร็จสมบูรณ์ทั้งหมดแล้ว!');
}

migrate();
