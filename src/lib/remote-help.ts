import { SupabaseClient } from '@supabase/supabase-js';

/** How long a Remote Assistance invitation stays usable after the user sends it. */
export const INVITATION_TTL_MINUTES = 60;

/** Normalises a MAC address to "AA:BB:CC:DD:EE:FF", or null when it is not one. */
export function normalizeMac(raw: string): string | null {
  const hex = String(raw || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12 || /^0+$/.test(hex)) return null;
  return hex.match(/.{2}/g)!.join(':');
}

/** All spellings a MAC may have been typed with in the assets table. */
export function macVariants(mac: string): string[] {
  return [mac, mac.replace(/:/g, '-'), mac.toLowerCase(), mac.replace(/:/g, '-').toLowerCase()];
}

/**
 * Wipes invitations whose time is up. Waiting requests become 'expired'; a session that
 * is already in progress keeps its status but no longer needs the invitation.
 */
export async function expireOldRequests(admin: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from('remote_help_requests')
    .update({ status: 'expired', invitation_file: null, invitation_password: null })
    .eq('status', 'waiting')
    .lt('expires_at', now);
  await admin
    .from('remote_help_requests')
    .update({ invitation_file: null, invitation_password: null })
    .eq('status', 'in_progress')
    .lt('expires_at', now)
    .not('invitation_file', 'is', null);
}

export async function logRemoteAction(
  admin: SupabaseClient,
  entry: {
    request_id: string;
    asset_id: string | null;
    ticket_id: string | null;
    staff_user_id: string;
    staff_email: string | null;
    action: 'OPEN_INVITATION' | 'LINK_ASSET' | 'CLOSE';
    detail?: string;
  }
): Promise<void> {
  const { error } = await admin.from('remote_action_logs').insert(entry);
  if (error) console.error('remote_action_logs insert failed:', error);
}
