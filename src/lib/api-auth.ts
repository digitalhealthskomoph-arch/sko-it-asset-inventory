import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// LINE Login channel that owns the LIFF app (the part of the LIFF ID before the dash).
const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID || '2008591648';

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies the Supabase session token sent by the dashboard and checks the
 * user is listed in public.staff_users. Throws AuthError otherwise.
 */
export async function requireStaff(req: Request): Promise<{ userId: string; email: string | null }> {
  const token = bearerToken(req);
  if (!token) throw new AuthError('กรุณาเข้าสู่ระบบ');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AuthError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');

  const { data: staff } = await admin
    .from('staff_users')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!staff) throw new AuthError('บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบ', 403);

  return { userId: data.user.id, email: data.user.email ?? null };
}

/** Returns true when the request carries a valid staff session, without throwing. */
export async function isStaffRequest(req: Request): Promise<boolean> {
  try {
    await requireStaff(req);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies a LIFF access token with LINE and returns the LINE userId it belongs to.
 * Returns null when no token is supplied; throws AuthError when the token is invalid.
 */
export async function verifyLineAccessToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;

  const verifyRes = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  );
  if (!verifyRes.ok) throw new AuthError('LINE token ไม่ถูกต้องหรือหมดอายุ');
  const verified = await verifyRes.json();
  if (String(verified.client_id) !== LINE_LOGIN_CHANNEL_ID || !(verified.expires_in > 0)) {
    throw new AuthError('LINE token ไม่ได้ออกให้แอปนี้');
  }

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!profileRes.ok) throw new AuthError('ไม่สามารถยืนยันตัวตน LINE ได้');
  const profile = await profileRes.json();
  return typeof profile.userId === 'string' ? profile.userId : null;
}

/** LINE userId from the `x-line-access-token` header, or null when absent. */
export function lineUserFromRequest(req: Request): Promise<string | null> {
  return verifyLineAccessToken(req.headers.get('x-line-access-token'));
}

/** Converts thrown errors into a JSON response without leaking internals. */
export function errorResponse(err: unknown, fallback = 'เกิดข้อผิดพลาดในระบบ'): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
