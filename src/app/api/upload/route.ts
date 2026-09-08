import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Missing filename or contentType' }, { status: 400 });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: filename,
      ContentType: contentType,
    });

    // สร้าง URL สำหรับให้หน้าบ้านใช้อัปโหลดไฟล์โดยตรง (หมดอายุใน 5 นาที)
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_DOMAIN}/${filename}`;

    return NextResponse.json({ presignedUrl, publicUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { fileUrl } = await request.json();

    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    // Extract filename/key from public URL or relative path
    let key = fileUrl;
    if (fileUrl.includes('://')) {
      const urlObj = new URL(fileUrl);
      key = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    await s3Client.send(command);

    return NextResponse.json({ success: true, deletedKey: key });
  } catch (error) {
    console.error('Error deleting file from R2:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
