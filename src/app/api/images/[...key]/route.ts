import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, r2Bucket } from '@/lib/r2';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;
    const objectKey = key.join('/');

    if (!objectKey) {
      return NextResponse.json({ error: 'Missing object key' }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: objectKey,
    });

    const response = await getR2Client().send(command);

    if (!response.Body) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Convert SDK stream to standard Web ReadableStream
    const webStream = (response.Body as any).transformToWebStream();

    return new Response(webStream, {
      headers: {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Content-Length': response.ContentLength?.toString() || '',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Error fetching image from R2:', error);
    return NextResponse.json({ error: 'Failed to fetch image from storage' }, { status: 500 });
  }
}
