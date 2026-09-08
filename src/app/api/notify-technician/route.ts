import { NextResponse } from 'next/server';

const LINE_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  'Kxcra7n2EaxDS1182sOkyLlvJ9gcqxp99LaMvOxXSmFVhtyN1p5SEyyOBFSUOQqtlHdTT3n5d1jz6VnRuTxE306pqYVMEKa8/xPd+Yh8MSlzYPObugTI/onsp9dN9hQNbxG9le/0DoMPXT17MQbVDgdB04t89/1O/w1cDnyilFU=';

const ADMIN_LINE_GROUP_ID =
  process.env.ADMIN_LINE_GROUP_ID ||
  process.env.LINE_ADMIN_GROUP_ID ||
  'C1219a8b54f36b2c6b9fbdf52e5c93a39';

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
    const flexContents: any = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '📣 มีรายการแจ้งซ่อมใหม่', weight: 'bold', size: 'lg', color: '#ffffff' },
          { type: 'text', text: `รหัส: ${ticketNumber}`, size: 'xs', color: '#fecaca', margin: 'xs' }
        ],
        backgroundColor: '#dc2626'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ผู้แจ้ง:', color: '#64748b', size: 'sm', flex: 2 },
              { type: 'text', text: requesterName || '-', weight: 'bold', color: '#1e293b', size: 'sm', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'กลุ่มงาน:', color: '#64748b', size: 'sm', flex: 2 },
              { type: 'text', text: department || '-', color: '#1e293b', size: 'sm', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ปัญหา:', color: '#64748b', size: 'sm', flex: 2 },
              { type: 'text', text: issueType || '-', color: '#2563eb', weight: 'bold', size: 'sm', flex: 5 }
            ]
          },
          ...(assetInfo ? [{
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'อุปกรณ์:', color: '#64748b', size: 'sm', flex: 2 },
              { type: 'text', text: assetInfo, color: '#1e293b', size: 'sm', flex: 5, wrap: true }
            ]
          }] : []),
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#f8fafc',
            paddingAll: 'md',
            cornerRadius: 'md',
            contents: [
              { type: 'text', text: 'รายละเอียดอาการเสีย:', color: '#64748b', size: 'xs' },
              { type: 'text', text: description || '-', color: '#0f172a', size: 'sm', wrap: true, margin: 'xs' }
            ]
          },
          {
            type: 'text',
            text: `📅 ${thaiDateStr}`,
            color: '#94a3b8',
            size: 'xxs',
            align: 'end',
            margin: 'sm'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#2563eb',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🖥️ จัดการงานในระบบ',
              uri: 'https://sko-it-asset-inventory.vercel.app/dashboard/tickets'
            }
          },
          ...(imageUrl ? [{
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🖼️ ดูรูปภาพประกอบ',
              uri: imageUrl
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
        (imageUrl ? `📷 รูปภาพ: ${imageUrl}\n` : '') +
        `\n🖥️ จัดการงาน: https://sko-it-asset-inventory.vercel.app/dashboard/tickets`;

      await fetch('https://api.line.me/v2/bot/message/push', {
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
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error notifying technician group:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
