import { S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

/** Cloudflare R2 client. Server-side only. */
export function getR2Client(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY');
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET || 'my-app-assets';
}

export function publicUrlForKey(key: string): string {
  const rawDomain = process.env.NEXT_PUBLIC_R2_DOMAIN || '';
  const r2Domain = rawDomain && !rawDomain.includes('assets.mophsk.online')
    ? rawDomain
    : 'https://pub-0645b35588f444db916ede067d20d7e2.r2.dev';
  return `${r2Domain}/${key}`;
}

// Images only: nothing that a browser would execute (no HTML/SVG/JS) when opened from the public bucket.
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/bmp': 'bmp',
};

const TYPES_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
};

/**
 * The image content type to sign for. Browsers report an empty type for files they
 * don't recognise (HEIC on Windows, for one), so fall back to the file extension.
 */
export function resolveImageType(contentType: unknown, filename: unknown): string | null {
  const type = String(contentType || '').toLowerCase();
  if (IMAGE_TYPES[type]) return type;
  if (type && type !== 'application/octet-stream') return null;
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || '';
  return TYPES_BY_EXT[ext] || null;
}
