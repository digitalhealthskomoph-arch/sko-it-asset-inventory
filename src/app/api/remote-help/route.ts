import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { errorResponse, requireOfficeNetwork, requireStaff, UUID_RE } from '@/lib/api-auth';
import { notifyTechnicianGroup } from '@/lib/line-notify';
import { ISSUE_TYPES, createRepairTicket, loadRequester } from '@/lib/tickets';
import { INVITATION_TTL_MINUTES, expireOldRequests, macVariants, normalizeMac } from '@/lib/remote-help';

const PRIVATE_IPV4 = /^(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}$/;
// BIOS placeholders that are not real serial numbers
const JUNK_SERIALS = /^(to be filled.*|default string|system serial number|none|n\/a|0+|1234567890|chassis serial number)$/i;
const MAX_INVITATION_BASE64 = 64 * 1024;

function text(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * POST /api/remote-help — called by the SKO Help desktop app (office network only).
 * Creates a repair ticket for the chosen requester, links it to the asset whose MAC/serial
 * matches this computer, stores the Remote Assistance invitation and notifies technicians.
 */
export async function POST(req: Request) {
  try {
    requireOfficeNetwork(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const departmentId = String(body.department_id || '');
    const personnelId = String(body.personnel_id || '');
    const issueType = ISSUE_TYPES.includes(body.issue_type) ? body.issue_type : 'Other';
    const description = text(body.description, 2000);
    if (!UUID_RE.test(departmentId) || !UUID_RE.test(personnelId)) {
      return NextResponse.json({ error: 'กรุณาเลือกกลุ่มงานและชื่อผู้ขอความช่วยเหลือ' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'กรุณาแจ้งอาการหรือปัญหาที่พบ' }, { status: 400 });
    }

    // Device facts reported by the app
    const device = body.device && typeof body.device === 'object' ? body.device : {};
    const hostname = text(device.hostname, 64);
    const windowsUser = text(device.windows_user, 128);
    const osName = text(device.os_name, 128);
    const rawSerial = text(device.serial_number, 64);
    const serial = rawSerial && !JUNK_SERIALS.test(rawSerial) && rawSerial.length >= 4 ? rawSerial : '';
    const adapters: { mac: string; ipv4: string }[] = (Array.isArray(device.adapters) ? device.adapters : [])
      .slice(0, 10)
      .map((a: { mac?: string; ipv4?: string }) => ({
        mac: normalizeMac(String(a?.mac || '')) || '',
        ipv4: PRIVATE_IPV4.test(String(a?.ipv4 || '')) ? String(a.ipv4) : '',
      }))
      .filter((a: { mac: string }) => a.mac);
    const macs = [...new Set(adapters.map((a) => a.mac))];

    // Remote Assistance invitation (optional: the ticket is still created without it)
    const inv = body.invitation && typeof body.invitation === 'object' ? body.invitation : null;
    let invitationFile: string | null = null;
    let invitationPassword: string | null = null;
    if (inv) {
      const file = String(inv.file_base64 || '');
      const password = String(inv.password || '');
      if (file.length > MAX_INVITATION_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(file) || !/^[A-Za-z0-9]{6,20}$/.test(password)) {
        return NextResponse.json({ error: 'ข้อมูลการเชื่อมต่อรีโมทไม่ถูกต้อง' }, { status: 400 });
      }
      invitationFile = file;
      invitationPassword = password;
    }

    const admin = getSupabaseAdmin();
    const person = await loadRequester(admin, personnelId, departmentId);
    if (!person) {
      return NextResponse.json({ error: 'ชื่อผู้ขอไม่ตรงกับกลุ่มงานที่เลือก' }, { status: 400 });
    }

    // Find the asset: MAC first (LAN or Wi-Fi column), then BIOS serial number.
    type AssetRow = { id: string; asset_number: string | null; brand_model: string | null; mac_address: string | null; mac_address_wifi: string | null };
    let asset: AssetRow | null = null;
    let matchMethod: 'mac' | 'serial' | null = null;
    const columns = 'id, asset_number, brand_model, mac_address, mac_address_wifi';
    if (macs.length > 0) {
      const variants = macs.flatMap(macVariants);
      const [lan, wifi] = await Promise.all([
        admin.from('assets').select(columns).in('mac_address', variants).limit(1),
        admin.from('assets').select(columns).in('mac_address_wifi', variants).limit(1),
      ]);
      asset = (lan.data?.[0] as AssetRow) || (wifi.data?.[0] as AssetRow) || null;
      if (asset) matchMethod = 'mac';
    }
    if (!asset && serial) {
      const { data } = await admin.from('assets').select(columns).ilike('serial_number', serial).limit(1);
      asset = (data?.[0] as AssetRow) || null;
      if (asset) matchMethod = 'serial';
    }

    // The IP of the adapter that matched (or the first private one) — keeps the asset's IP current.
    const matchedMac = asset ? normalizeMac(asset.mac_address || '') || normalizeMac(asset.mac_address_wifi || '') : null;
    const currentIp =
      adapters.find((a) => a.mac === matchedMac && a.ipv4)?.ipv4 || adapters.find((a) => a.ipv4)?.ipv4 || '';
    if (asset && matchMethod === 'mac' && currentIp) {
      await admin.from('assets').update({ ip_address: currentIp }).eq('id', asset.id);
    }

    const deviceLine = `[ขอรีโมท] เครื่อง ${hostname || '-'} (${currentIp || 'ไม่ทราบ IP'})${windowsUser ? ` ผู้ใช้ Windows: ${windowsUser}` : ''}`;
    const ticket = await createRepairTicket(admin, {
      department_id: departmentId,
      personnel_id: personnelId,
      asset_id: asset?.id ?? null,
      issue_type: issueType,
      description: `${description}\n\n${deviceLine}`,
    });

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MINUTES * 60_000).toISOString();
    const { data: request, error: reqError } = await admin
      .from('remote_help_requests')
      .insert({
        ticket_id: ticket.id,
        asset_id: asset?.id ?? null,
        personnel_id: personnelId,
        department_id: departmentId,
        hostname: hostname || null,
        windows_user: windowsUser || null,
        ip_address: currentIp || null,
        mac_addresses: macs,
        serial_number: rawSerial || null,
        os_name: osName || null,
        match_method: matchMethod,
        invitation_file: invitationFile,
        invitation_password: invitationPassword,
        status: invitationFile ? 'waiting' : 'closed',
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (reqError) throw reqError;

    try {
      await notifyTechnicianGroup({
        ticketNumber: ticket.ticketNumber,
        requesterName: `${person.first_name} ${person.last_name}`,
        department: person.departmentName,
        issueType,
        assetInfo: asset ? `${asset.asset_number || '-'} (${asset.brand_model || '-'})` : 'ยังไม่ผูกกับครุภัณฑ์',
        description,
        imageUrl: null,
        headline: invitationFile ? '🖥️ ขอความช่วยเหลือผ่านรีโมท' : '🖥️ ขอความช่วยเหลือ (ไม่มีรีโมท)',
        manageUrl: 'https://sko-it-asset-inventory.vercel.app/dashboard/remote-help',
        extraRows: [{ label: 'เครื่อง', value: `${hostname || '-'} ${currentIp ? `(${currentIp})` : ''}`.trim() }],
      });
    } catch (notifyErr) {
      console.error('Notify technician error:', notifyErr);
    }

    return NextResponse.json({
      success: true,
      requestId: request.id,
      ticketNumber: ticket.ticketNumber,
      matchedAsset: asset?.asset_number || null,
      expiresInMinutes: invitationFile ? INVITATION_TTL_MINUTES : 0,
    });
  } catch (err) {
    return errorResponse(err, 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่หรือโทรแจ้ง IT');
  }
}

/** GET /api/remote-help — staff list of open requests plus the last 7 days of history. */
export async function GET(req: Request) {
  try {
    await requireStaff(req);
    const admin = getSupabaseAdmin();
    await expireOldRequests(admin);

    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data, error } = await admin
      .from('remote_help_requests')
      .select(`
        id, status, hostname, windows_user, ip_address, mac_addresses, serial_number, os_name, match_method,
        expires_at, opened_by, opened_at, closed_at, created_at, invitation_file,
        personnel (first_name, last_name),
        departments (name),
        assets (id, asset_number, asset_name, brand_model),
        repair_tickets (id, ticket_number, status, description)
      `)
      .or(`status.in.(waiting,in_progress),created_at.gte.${since}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    // Never send the invitation itself in the list; only whether one is available.
    const requests = (data ?? []).map(({ invitation_file, ...row }) => ({ ...row, has_invitation: !!invitation_file }));
    return NextResponse.json({ requests });
  } catch (err) {
    return errorResponse(err);
  }
}
