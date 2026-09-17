const R2_PUBLIC_DOMAIN =
  process.env.NEXT_PUBLIC_R2_DOMAIN ||
  'https://pub-0645b35588f444db916ede067d20d7e2.r2.dev';

/**
 * Resolves an image URL safely.
 * Replaces any unreachable assets.mophsk.online URLs with the active Cloudflare R2 public URL
 */
export function getSafeImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  if (url.includes('assets.mophsk.online/')) {
    const key = url.split('assets.mophsk.online/')[1];
    return `${R2_PUBLIC_DOMAIN}/${key}`;
  }

  return url;
}
