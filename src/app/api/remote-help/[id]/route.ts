import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, requireStaff, UUID_RE } from '@/lib/api-auth';
import { logRemoteAction, normalizeMac } from '@/lib/remote-help';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/remote-help/<id> — staff only. Returns the Remote Assistance invitation file and
 * password, marks the request in progress and writes an audit log entry.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const staff = await requireStaff(req);
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: request } = await admin
      .from('remote_help_requests')
      .select('id, status, hostname, asset_id, ticket_id, invitation_file, invitation_password, expires_at, opened_at')
      .eq('id', id)
      .maybeSingle();
    if (!request) return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });

    const usable =
      request.invitation_file &&
      ['waiting', 'in_progress'].includes(request.status) &&
      new Date(request.expires_at).getTime() > Date.now();
    if (!usable) {
      return NextResponse.json(
        { error: 'คำเชิญหมดอายุหรือถูกปิดแล้ว กรุณาให้ผู้ใช้กดขอความช่วยเหลือใหม่' },
        { status: 410 }
      );
    }

    await admin
      .from('remote_help_requests')
      .update({
        status: 'in_progress',
        ...(request.opened_at ? {} : { opened_at: new Date().toISOString(), opened_by: staff.email }),
      })
      .eq('id', id);
    await logRemoteAction(admin, {
      request_id: id,
      asset_id: request.asset_id,
      ticket_id: request.ticket_id,
      staff_user_id: staff.userId,
      staff_email: staff.email,
      action: 'OPEN_INVITATION',
      detail: request.hostname || undefined,
    });

    const name = (request.hostname || 'remote-help').replace(/[^\w.-]+/g, '_');
    return NextResponse.json({
      fileBase64: request.invitation_file,
      password: request.invitation_password,
      filename: `${name}.msrcincident`,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/remote-help/<id> — staff only.
 *   { action: 'close' }                                     close the request and wipe the invitation
 *   { action: 'link_asset', asset_id, save_network: bool }  link request + ticket to an asset;
 *                                                           optionally store this PC's MAC/IP on it
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const staff = await requireStaff(req);
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 });
    const body = await req.json().catch(() => ({}));

    const admin = getSupabaseAdmin();
    const { data: request } = await admin
      .from('remote_help_requests')
      .select('id, ticket_id, asset_id, ip_address, mac_addresses, hostname')
      .eq('id', id)
      .maybeSingle();
    if (!request) return NextResponse.json({ error: 'ไม่พบคำขอ' }, { status: 404 });

    if (body.action === 'close') {
      await admin
        .from('remote_help_requests')
        .update({ status: 'closed', closed_at: new Date().toISOString(), invitation_file: null, invitation_password: null })
        .eq('id', id);
      await logRemoteAction(admin, {
        request_id: id,
        asset_id: request.asset_id,
        ticket_id: request.ticket_id,
        staff_user_id: staff.userId,
        staff_email: staff.email,
        action: 'CLOSE',
      });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'link_asset') {
      const assetId = String(body.asset_id || '');
      if (!UUID_RE.test(assetId)) return NextResponse.json({ error: 'รหัสครุภัณฑ์ไม่ถูกต้อง' }, { status: 400 });
      const { data: asset } = await admin
        .from('assets')
        .select('id, asset_number, mac_address')
        .eq('id', assetId)
        .maybeSingle();
      if (!asset) return NextResponse.json({ error: 'ไม่พบครุภัณฑ์' }, { status: 404 });

      await admin.from('remote_help_requests').update({ asset_id: assetId, match_method: 'manual' }).eq('id', id);
      if (request.ticket_id) {
        await admin.from('repair_tickets').update({ asset_id: assetId }).eq('id', request.ticket_id);
      }

      // Save this computer's network identity on the asset so the next request matches automatically.
      if (body.save_network) {
        const firstMac = (request.mac_addresses || []).map((m: string) => normalizeMac(m)).find(Boolean);
        const update: Record<string, string> = {};
        if (request.ip_address) update.ip_address = request.ip_address;
        if (firstMac && !asset.mac_address) update.mac_address = firstMac;
        if (Object.keys(update).length > 0) await admin.from('assets').update(update).eq('id', assetId);
      }

      await logRemoteAction(admin, {
        request_id: id,
        asset_id: assetId,
        ticket_id: request.ticket_id,
        staff_user_id: staff.userId,
        staff_email: staff.email,
        action: 'LINK_ASSET',
        detail: `${asset.asset_number || assetId}${body.save_network ? ' (+network)' : ''}`,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
