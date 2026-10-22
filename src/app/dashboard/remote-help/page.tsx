'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { staffFetch } from '@/lib/api-client';
import {
  Headset, Monitor, Download, KeyRound, Copy, Check, Link2, XCircle, Loader2,
  RefreshCw, Clock, User, Building2, AlertTriangle, Laptop,
} from 'lucide-react';

type RemoteRequest = {
  id: string;
  status: 'waiting' | 'in_progress' | 'closed' | 'expired';
  hostname: string | null;
  windows_user: string | null;
  ip_address: string | null;
  mac_addresses: string[] | null;
  serial_number: string | null;
  os_name: string | null;
  match_method: string | null;
  expires_at: string;
  opened_by: string | null;
  opened_at: string | null;
  created_at: string;
  has_invitation: boolean;
  personnel: { first_name: string; last_name: string } | null;
  departments: { name: string } | null;
  assets: { id: string; asset_number: string | null; asset_name: string | null; brand_model: string | null } | null;
  repair_tickets: { id: string; ticket_number: string; status: string; description: string } | null;
};

type AssetHit = { id: string; asset_number: string | null; asset_name: string | null; brand_model: string | null };

const STATUS_LABEL: Record<RemoteRequest['status'], { text: string; cls: string }> = {
  waiting: { text: 'รอช่างเชื่อมต่อ', cls: 'bg-orange-100 text-orange-700' },
  in_progress: { text: 'กำลังช่วยเหลือ', cls: 'bg-blue-100 text-blue-700' },
  closed: { text: 'ปิดแล้ว', cls: 'bg-green-100 text-green-700' },
  expired: { text: 'หมดอายุ', cls: 'bg-slate-100 text-slate-500' },
};

function minutesLeft(expiresAt: string): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function downloadBase64(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RemoteHelpPage() {
  const [requests, setRequests] = useState<RemoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [, setTick] = useState(0); // re-render once a minute so countdowns stay current

  const load = useCallback(async () => {
    const res = await staffFetch('/api/remote-help');
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setRequests(data.requests);
      setError(null);
    } else {
      setError(data.error || 'โหลดข้อมูลไม่สำเร็จ');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setTick((t) => t + 1), 60000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  const openInvitation = async (req: RemoteRequest) => {
    setBusyId(req.id);
    try {
      const res = await staffFetch(`/api/remote-help/${req.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'ไม่สามารถเปิดคำเชิญได้');
      } else {
        downloadBase64(data.fileBase64, data.filename);
        setPasswords((p) => ({ ...p, [req.id]: data.password }));
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const closeRequest = async (req: RemoteRequest) => {
    if (!window.confirm('ปิดคำขอนี้? คำเชิญรีโมทจะถูกลบและใช้ต่อไม่ได้')) return;
    setBusyId(req.id);
    await staffFetch(`/api/remote-help/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    });
    await load();
    setBusyId(null);
  };

  const copyPassword = async (id: string) => {
    try {
      await navigator.clipboard.writeText(passwords[id]);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('คัดลอกรหัสผ่านนี้', passwords[id]);
    }
  };

  const active = requests.filter((r) => r.status === 'waiting' || r.status === 'in_progress');
  const history = requests.filter((r) => r.status === 'closed' || r.status === 'expired');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">คำขอรีโมท (Remote Help)</h1>
          <p className="text-slate-500 text-sm mt-1">
            คำขอจากโปรแกรม &ldquo;ขอความช่วยเหลือ IT&rdquo; บนเครื่องผู้ใช้ — ใช้ได้เฉพาะเมื่อเครื่องช่างอยู่ในเครือข่าย สสจ.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> รีเฟรช
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">ขั้นตอนการเชื่อมต่อ</div>
        <ol className="list-decimal ml-5 space-y-0.5 text-blue-800">
          <li>กด <b>เชื่อมต่อ</b> ระบบจะดาวน์โหลดไฟล์คำเชิญ (.msrcincident) และแสดงรหัสผ่าน</li>
          <li>ดับเบิลคลิกไฟล์ที่ดาวน์โหลด แล้ววางรหัสผ่าน</li>
          <li>รอผู้ใช้กด <b>ใช่ (Yes)</b> เพื่ออนุญาต จากนั้นกด <b>ขอควบคุม (Request control)</b> หากต้องใช้เมาส์</li>
        </ol>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Headset className="w-5 h-5 text-orange-500" /> รอดำเนินการ ({active.length})
            </h2>
            {active.length === 0 && (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 text-sm">
                ยังไม่มีคำขอรีโมทที่รออยู่
              </div>
            )}
            {active.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                busy={busyId === req.id}
                password={passwords[req.id]}
                copied={copiedId === req.id}
                onOpen={() => openInvitation(req)}
                onCopy={() => copyPassword(req.id)}
                onClose={() => closeRequest(req)}
                onLink={() => setLinkingId(req.id)}
              />
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" /> ประวัติ 7 วันล่าสุด ({history.length})
            </h2>
            {history.map((req) => (
              <RequestCard key={req.id} req={req} busy={false} onLink={() => setLinkingId(req.id)} />
            ))}
          </section>
        </>
      )}

      {linkingId && (
        <LinkAssetDialog
          request={requests.find((r) => r.id === linkingId)!}
          onClose={() => setLinkingId(null)}
          onDone={async () => { setLinkingId(null); await load(); }}
        />
      )}
    </div>
  );
}

function RequestCard({
  req, busy, password, copied, onOpen, onCopy, onClose, onLink,
}: {
  req: RemoteRequest;
  busy: boolean;
  password?: string;
  copied?: boolean;
  onOpen?: () => void;
  onCopy?: () => void;
  onClose?: () => void;
  onLink: () => void;
}) {
  const status = STATUS_LABEL[req.status];
  const isActive = req.status === 'waiting' || req.status === 'in_progress';
  const left = minutesLeft(req.expires_at);
  const description = (req.repair_tickets?.description || '').split('\n\n[ขอรีโมท]')[0];

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 sm:p-5 ${isActive ? 'border-orange-200' : 'border-slate-200 opacity-90'}`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>{status.text}</span>
            {req.repair_tickets && (
              <Link href="/dashboard/tickets" className="text-xs font-mono text-blue-600 hover:underline">
                {req.repair_tickets.ticket_number}
              </Link>
            )}
            <span className="text-xs text-slate-400">{formatTime(req.created_at)}</span>
            {isActive && req.has_invitation && (
              <span className="text-xs text-orange-600 flex items-center gap-1"><Clock className="w-3 h-3" /> เหลือ {left} นาที</span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              {req.personnel ? `${req.personnel.first_name} ${req.personnel.last_name}` : '-'}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" /> {req.departments?.name || '-'}
            </span>
          </div>

          <p className="text-sm text-slate-900 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{description || '-'}</p>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Monitor className="w-3.5 h-3.5" /> {req.hostname || '-'}</span>
            <span className="font-mono">{req.ip_address || 'ไม่ทราบ IP'}</span>
            {req.windows_user && <span>ผู้ใช้ Windows: {req.windows_user}</span>}
            {req.os_name && <span>{req.os_name}</span>}
          </div>

          <div className="text-xs flex items-center gap-2">
            <Laptop className="w-3.5 h-3.5 text-slate-400" />
            {req.assets ? (
              <Link href={`/dashboard/assets/${req.assets.id}`} className="text-blue-600 hover:underline">
                {req.assets.asset_number || '-'} · {req.assets.asset_name || req.assets.brand_model || ''}
                <span className="text-slate-400"> (จับคู่ด้วย {req.match_method === 'mac' ? 'MAC' : req.match_method === 'serial' ? 'Serial' : 'ช่าง'})</span>
              </Link>
            ) : (
              <span className="text-amber-600">ยังไม่ผูกกับครุภัณฑ์</span>
            )}
            <button onClick={onLink} className="text-slate-500 hover:text-blue-600 underline">
              {req.assets ? 'เปลี่ยน' : 'ผูกครุภัณฑ์'}
            </button>
          </div>

          {req.opened_by && (
            <div className="text-xs text-slate-400">เปิดโดย {req.opened_by} {req.opened_at ? `เมื่อ ${formatTime(req.opened_at)}` : ''}</div>
          )}
        </div>

        {isActive && (
          <div className="lg:w-64 shrink-0 space-y-2">
            {req.has_invitation ? (
              <button
                onClick={onOpen}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} เชื่อมต่อ
              </button>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">ไม่มีคำเชิญรีโมท (Remote Assistance เปิดไม่สำเร็จบนเครื่องผู้ใช้)</div>
            )}
            {password && (
              <button
                onClick={onCopy}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm"
                title="คัดลอกรหัสผ่าน"
              >
                <span className="flex items-center gap-2 text-amber-800"><KeyRound className="w-4 h-4" /> รหัสผ่าน</span>
                <span className="font-mono font-semibold text-amber-900">{password}</span>
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-amber-700" />}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <XCircle className="w-4 h-4" /> ปิดคำขอ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkAssetDialog({ request, onClose, onDone }: { request: RemoteRequest; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AssetHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saveNetwork, setSaveNetwork] = useState(true);
  const [saving, setSaving] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().replace(/[,()%]/g, ' ');
    if (!q) return;
    setSearching(true);
    const { data } = await supabase
      .from('assets')
      .select('id, asset_number, asset_name, brand_model')
      .or(`asset_number.ilike.%${q}%,asset_name.ilike.%${q}%,brand_model.ilike.%${q}%,serial_number.ilike.%${q}%`)
      .limit(10);
    setHits(data || []);
    setSearching(false);
  };

  const link = async (assetId: string) => {
    setSaving(true);
    const res = await staffFetch(`/api/remote-help/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'link_asset', asset_id: assetId, save_network: saveNetwork }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'บันทึกไม่สำเร็จ');
      return;
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Link2 className="w-5 h-5 text-blue-600" /> ผูกกับครุภัณฑ์</h3>
          <p className="text-xs text-slate-500 mt-1">
            เครื่อง {request.hostname || '-'} · {request.ip_address || '-'} · MAC {(request.mac_addresses || []).join(', ') || '-'}
          </p>
        </div>
        <form onSubmit={search} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ รุ่น หรือ Serial"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ค้นหา'}
          </button>
        </form>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={saveNetwork} onChange={(e) => setSaveNetwork(e.target.checked)} />
          บันทึก IP และ MAC ของเครื่องนี้ลงครุภัณฑ์ (ครั้งหน้าระบบจะจับคู่ให้อัตโนมัติ)
        </label>
        <div className="max-h-64 overflow-y-auto divide-y border border-slate-200 rounded-lg">
          {hits.length === 0 && <div className="p-4 text-center text-sm text-slate-400">ค้นหาเพื่อเลือกครุภัณฑ์</div>}
          {hits.map((a) => (
            <button
              key={a.id}
              disabled={saving}
              onClick={() => link(a.id)}
              className="w-full text-left p-3 hover:bg-blue-50 text-sm"
            >
              <div className="font-medium text-slate-800">{a.asset_number || '-'}</div>
              <div className="text-xs text-slate-500">{a.asset_name || ''} {a.brand_model ? `· ${a.brand_model}` : ''}</div>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
