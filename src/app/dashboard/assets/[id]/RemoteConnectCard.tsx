'use client';

import { useState } from 'react';
import { Monitor, LifeBuoy, FolderOpen, Copy, Check, AlertTriangle } from 'lucide-react';

// Office LAN ranges only (RFC 1918). Anything else is refused so the page never
// builds a connection file pointing outside the building.
function isPrivateIPv4(value: string): boolean {
  const m = value.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />;
}

type Props = {
  ipAddress: string;
  label: string; // asset number or name, used for the downloaded file name
};

/**
 * Shortcuts for reaching a Windows PC over the office LAN from the technician's own machine.
 * The connection goes technician PC -> target PC directly; nothing passes through the web server,
 * so it only works while the technician is inside the office network.
 */
export default function RemoteConnectCard({ ipAddress, label }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const ip = ipAddress.trim();
  const valid = isPrivateIPv4(ip);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    } catch {
      window.prompt('คัดลอกข้อความนี้', text);
    }
  };

  const downloadRdp = () => {
    const content = [
      `full address:s:${ip}`,
      'prompt for credentials:i:1',
      'authentication level:i:2',
      'enablecredsspsupport:i:1',
      'redirectclipboard:i:1',
      'redirectdrives:i:0',
      'redirectprinters:i:0',
      'screen mode id:i:1',
    ].join('\r\n');
    const blob = new Blob([content + '\r\n'], { type: 'application/x-rdp' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(label || ip).replace(/[^\w.-]+/g, '_')}.rdp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ip) {
    return (
      <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-500 flex items-center gap-3">
        <Monitor className="w-5 h-5 text-slate-400 shrink-0" />
        ยังไม่มี IP Address ของเครื่องนี้ — กรอก IP ในหัวข้อ &ldquo;2. ข้อมูลครุภัณฑ์&rdquo; เพื่อเปิดใช้งานการเชื่อมต่อระยะไกล
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        IP &ldquo;{ip}&rdquo; ไม่ใช่ IP ภายในสำนักงาน (10.x, 172.16–31.x, 192.168.x) จึงไม่แสดงปุ่มเชื่อมต่อ
      </div>
    );
  }

  const msraCmd = `msra /offerRA ${ip}`;
  const shareCmd = `\\\\${ip}\\c$`;

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            เชื่อมต่อเครื่องผ่าน LAN
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            ใช้ได้เฉพาะเมื่อเครื่องช่างอยู่ในเครือข่าย สสจ. • IP ที่บันทึกไว้: <span className="font-mono text-slate-700">{ip}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => copy('ip', ip)}
          className="shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          title="คัดลอก IP"
        >
          <CopyIcon done={copied === 'ip'} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => copy('msra', msraCmd)}
          className="text-left p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          <div className="flex items-center justify-between font-medium text-emerald-800 text-sm">
            <span className="flex items-center gap-2"><LifeBuoy className="w-4 h-4" /> ช่วยเหลือผู้ใช้</span>
            <CopyIcon done={copied === 'msra'} />
          </div>
          <div className="text-xs text-emerald-700 mt-1">Remote Assistance — เห็นจอเดียวกับผู้ใช้ ผู้ใช้ต้องกดอนุญาต</div>
          <code className="block text-[11px] text-emerald-900 mt-2 font-mono break-all">{msraCmd}</code>
        </button>

        <button
          type="button"
          onClick={downloadRdp}
          className="text-left p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <div className="font-medium text-blue-800 text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4" /> Remote Desktop
          </div>
          <div className="text-xs text-blue-700 mt-1">ดาวน์โหลดไฟล์ .rdp — ผู้ใช้จะถูกพักหน้าจอระหว่างเชื่อมต่อ</div>
          <code className="block text-[11px] text-blue-900 mt-2 font-mono">{ip}:3389</code>
        </button>

        <button
          type="button"
          onClick={() => copy('share', shareCmd)}
          className="text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center justify-between font-medium text-slate-800 text-sm">
            <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4" /> เปิดไดรฟ์ C:</span>
            <CopyIcon done={copied === 'share'} />
          </div>
          <div className="text-xs text-slate-600 mt-1">คัดลอกแล้ววางใน File Explorer (ต้องใช้รหัสแอดมินเครื่อง)</div>
          <code className="block text-[11px] text-slate-800 mt-2 font-mono break-all">{shareCmd}</code>
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        หาก IP เปลี่ยนบ่อย ควรจอง IP ตาม MAC Address (DHCP reservation) ที่อุปกรณ์เครือข่าย เพื่อให้ IP ในระบบตรงกับเครื่องจริง
      </p>
    </div>
  );
}
