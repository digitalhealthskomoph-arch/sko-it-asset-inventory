'use client';

import liff from '@line/liff';
import { supabase } from '@/lib/supabase';

export const LIFF_ID = '2008591648-wGRKxePd';

/** fetch() for dashboard pages: attaches the logged-in staff member's Supabase token. */
export async function staffFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

let liffReady: Promise<void> | null = null;

function ensureLiff(): Promise<void> {
  if (!liffReady) {
    liffReady = liff.init({ liffId: LIFF_ID }).catch((err) => {
      liffReady = null;
      throw err;
    });
  }
  return liffReady;
}

/** LIFF access token of the current LINE user, or null outside LINE / when not logged in. */
export async function getLiffAccessToken(): Promise<string | null> {
  try {
    await ensureLiff();
    return liff.isLoggedIn() ? liff.getAccessToken() : null;
  } catch {
    return null;
  }
}

/** fetch() for LIFF pages: attaches the LINE access token so the server can verify the user. */
export async function liffFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getLiffAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('x-line-access-token', token);
  return fetch(input, { ...init, headers });
}
