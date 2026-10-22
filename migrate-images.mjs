import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';

// ==========================================
// 1. ตั้งค่า Supabase
// ==========================================
// อ่านค่าลับจาก environment เท่านั้น ห้ามใส่ key ลงในไฟล์นี้
// ตัวอย่าง: node --env-file=.env.local migrate-images.mjs
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = 'asset-images';

// ==========================================
// 2. ตั้งค่า Cloudflare R2
// ==========================================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'my-app-assets'; // ชื่อ Bucket ใน R2 ที่เราสร้างไว้ตอนแรก (แก้ให้ตรงถ้าเปลี่ยนชื่อ)

// ==========================================

if (!SUPABASE_URL || !SUPABASE_KEY || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ ต้องตั้งค่า NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

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
