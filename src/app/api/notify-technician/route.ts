import { NextResponse } from 'next/server';
import { getSafeImageUrl } from '@/lib/image-url';

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  process.env.LINE_ACCESS_TOKEN ||
  process.env.CHANNEL_ACCESS_TOKEN ||
  '';

const ADMIN_LINE_GROUP_ID =
  process.env.ADMIN_LINE_GROUP_ID ||
  process.env.LINE_ADMIN_GROUP_ID ||
  process.env.LINE_GROUP_ID ||
  process.env.GROUP_ID ||
  '';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      ticketNumber,
      requesterName,
      department,
      issueType,
      assetInfo,
      description,
      imageUrl,
    } = body;

    if (!ticketNumber) {
      return NextResponse.json({ error: 'Missing ticketNumber' }, { status: 400 });
    }

    if (!LINE_ACCESS_TOKEN || !ADMIN_LINE_GROUP_ID) {
      console.error('Missing LINE credentials in environment variables:', {
        hasToken: !!LINE_ACCESS_TOKEN,
        hasGroupId: !!ADMIN_LINE_GROUP_ID,
      });
      return NextResponse.json({
        error: 'Missing LINE_CHANNEL_ACCESS_TOKEN or ADMIN_LINE_GROUP_ID in Vercel environment variables',
        hasToken: !!LINE_ACCESS_TOKEN,
        hasGroupId: !!ADMIN_LINE_GROUP_ID,
      }, { status: 500 });
    }

    const now = new Date();
    const thaiDateStr = now.toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Prepare Flex Message
    const safeImageUrl = getSafeImageUrl(imageUrl);

    const flexContents: any = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E293B',
        paddingAll: '15px',
        contents: [
          {
            type: 'text',
            text: '🔔 มีการแจ้งซ่อมใหม่ (IT Helpdesk)',
            weight: 'bold',
            color: '#38BDF8',
            size: 'sm'
          },
          {
            type: 'text',
            text: `ใบงานเลขที่: ${ticketNumber}`,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'lg',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '15px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ผู้แจ้ง:', size: 'sm', color: '#64748B', flex: 2 },
              { type: 'text', text: requesterName || '-', size: 'sm', color: '#334155', weight: 'bold', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'กลุ่มงาน:', size: 'sm', color: '#64748B', flex: 2 },
              { type: 'text', text: department || '-', size: 'sm', color: '#334155', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ปัญหา:', size: 'sm', color: '#64748B', flex: 2 },
              { type: 'text', text: issueType || '-', size: 'sm', color: '#EF4444', weight: 'bold', flex: 5 }
            ]
          },
          ...(assetInfo ? [{
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'อุปกรณ์:', size: 'sm', color: '#64748B', flex: 2 },
              { type: 'text', text: assetInfo, size: 'sm', color: '#334155', flex: 5, wrap: true }
            ]
          }] : []),
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#F8FAFC',
            paddingAll: '10px',
            cornerRadius: 'md',
            contents: [
              { type: 'text', text: 'รายละเอียดอาการ:', size: 'xs', color: '#64748B' },
              { type: 'text', text: description || '-', size: 'sm', color: '#0F172A', wrap: true, margin: 'xs' }
            ]
          },
          {
            type: 'text',
            text: `เวลาแจ้ง: ${thaiDateStr}`,
            size: 'xs',
            color: '#94A3B8',
            align: 'end',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '15px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#0284C7',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🖥️ จัดการงานในระบบ',
              uri: 'https://sko-it-asset-inventory.vercel.app/dashboard/tickets'
            }
          },
          ...(safeImageUrl ? [{
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🖼️ ดูรูปภาพประกอบ',
              uri: safeImageUrl
            }
          }] : [])
        ]
      }
    };

    const messages: any[] = [
      {
        type: 'flex',
        altText: `📣 แจ้งซ่อมใหม่ (${ticketNumber}) - ${requesterName}`,
        contents: flexContents
      }
    ];

    // Push to LINE Group
    const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: ADMIN_LINE_GROUP_ID,
        messages: messages,
      }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error('LINE push flex failed, trying fallback text:', errText);

      // Fallback to plain text push
      const fallbackText =
        `📣 *แจ้งซ่อมใหม่* (${ticketNumber})\n` +
        `👤 ผู้แจ้ง: ${requesterName || '-'}\n` +
        `🏢 กลุ่มงาน: ${department || '-'}\n` +
        `🔧 ปัญหา: ${issueType || '-'}\n` +
        (assetInfo ? `💻 อุปกรณ์: ${assetInfo}\n` : '') +
        `📝 รายละเอียด: ${description || '-'}\n` +
        `📅 เวลา: ${thaiDateStr}\n` +
        (safeImageUrl ? `📷 รูปภาพ: ${safeImageUrl}\n` : '') +
        `\n🖥️ จัดการงาน: https://sko-it-asset-inventory.vercel.app/dashboard/tickets`;

      const fallbackRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to: ADMIN_LINE_GROUP_ID,
          messages: [{ type: 'text', text: fallbackText }],
        }),
      });

      if (!fallbackRes.ok) {
        const fallbackErr = await fallbackRes.text();
        console.error('LINE push fallback failed:', fallbackErr);
        return NextResponse.json({
          error: 'Failed to push message to LINE group',
          flexError: errText,
          fallbackError: fallbackErr,
        }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error notifying technician group:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
