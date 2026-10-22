import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { errorResponse, isStaffRequest, requireStaff } from '@/lib/api-auth';
import { getR2Client, r2Bucket, publicUrlForKey, IMAGE_TYPES } from '@/lib/r2';

// Folders each caller may write to. The server picks the object name, so callers
// can never overwrite an existing file.
const STAFF_FOLDERS = ['survey', 'repair', 'assets'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const contentType = String(body.contentType || '');
    const ext = IMAGE_TYPES[contentType];
    if (!ext) {
      return NextResponse.json({ error: 'อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF, HEIC)' }, { status: 400 });
    }

    // Anonymous callers (the LIFF repair form) may only write to repair/.
    const requested = String(body.folder || body.filename || '').split('/')[0];
    const staff = await isStaffRequest(request);
    const folder = staff && STAFF_FOLDERS.includes(requested) ? requested : 'repair';
    const key = `${folder}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      ContentType: contentType,
    });

    // Presigned URL for a direct browser upload, valid for 5 minutes
    const presignedUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

    return NextResponse.json({ presignedUrl, publicUrl: publicUrlForKey(key), key });
  } catch (error) {
    return errorResponse(error, 'เซิร์ฟเวอร์ยังตั้งค่าที่เก็บรูปภาพ (R2) ไม่ครบ หรือเชื่อมต่อไม่ได้');
  }
}

export async function DELETE(request: Request) {
  try {
    await requireStaff(request);

    const { fileUrl } = await request.json();
    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    // Extract filename/key from public URL or relative path
    let key = String(fileUrl);
    if (key.includes('://')) {
      key = decodeURIComponent(new URL(key).pathname.replace(/^\//, ''));
    }
    if (!key || key.includes('..')) {
      return NextResponse.json({ error: 'Invalid file key' }, { status: 400 });
    }

    await getR2Client().send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }));

    return NextResponse.json({ success: true, deletedKey: key });
  } catch (error) {
    return errorResponse(error, 'Failed to delete file');
  }
}
