import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
// Endpoint URL = https://sko-it-asset-inventory.vercel.app/liff
// So LIFF sub-paths become: /liff.line.me/ID/repair → /liff/repair
const LIFF_BASE = 'https://liff.line.me/2008591648-wGRKxePd';
const LIFF_REPAIR_URL   = `${LIFF_BASE}/repair`;
const LIFF_STATUS_URL   = `${LIFF_BASE}/status`;
const LIFF_EVALUATE_URL = `${LIFF_BASE}/evaluate`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const events = body.events;

    if (!events || events.length === 0) {
      return NextResponse.json({ status: 'ok' });
    }

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();
        const userId = event.source.userId;
        const replyToken = event.replyToken;

        if (text === 'แจ้งซ่อม' || text === 'เมนู') {
          await sendMainMenu(replyToken);
        } else if (text === 'ติดตามสถานะ' || text === 'สถานะ' || text === 'เช็คสถานะ') {
          await handleTrackStatus(replyToken, userId);
        } else if (text === 'ปิดงาน') {
          await handleCloseTicket(replyToken, userId);
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function sendMainMenu(replyToken: string) {
  const payload = {
    replyToken,
    messages: [
      {
        type: 'flex',
        altText: 'เมนูระบบแจ้งซ่อม IT',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'IT Helpdesk', weight: 'bold', size: 'xl', color: '#ffffff' }
            ],
            backgroundColor: '#2563eb'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#2563eb',
                action: {
                  type: 'uri',
                  label: '🛠️ แจ้งปัญหา IT',
                  uri: LIFF_REPAIR_URL
                }
              },
              {
                type: 'button',
                style: 'secondary',
                action: {
                  type: 'uri',
                  label: '🔍 ติดตามสถานะ',
                  uri: LIFF_STATUS_URL
                }
              }
            ]
          }
        }
      }
    ]
  };

  await replyToLine(payload);
}

async function handleTrackStatus(replyToken: string, userId: string) {
  let { data: tickets, error } = await supabase
    .from('repair_tickets')
    .select('id, ticket_number, description, status, technician_name, created_at, line_user_id')
    .eq('line_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fallback: If no tickets matched line_user_id, find active tickets
  if (!tickets || tickets.length === 0) {
    const { data: activeTickets } = await supabase
      .from('repair_tickets')
      .select('id, ticket_number, description, status, technician_name, created_at, line_user_id')
      .neq('status', 'ปิดงาน')
      .order('created_at', { ascending: false })
      .limit(5);

    if (activeTickets && activeTickets.length > 0) {
      tickets = activeTickets;
      if (userId) {
        await supabase
          .from('repair_tickets')
          .update({ line_user_id: userId })
          .eq('id', activeTickets[0].id);
      }
    }
  }

  if (error || !tickets || tickets.length === 0) {
    await replyToLine({
      replyToken,
      messages: [
        {
          type: 'flex',
          altText: 'ตรวจสอบสถานะงานซ่อม',
          contents: {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                { type: 'text', text: '🔍 ตรวจสอบสถานะงานซ่อม', weight: 'bold', size: 'md', color: '#1e293b' },
                { type: 'text', text: 'ไม่พบรายการงานซ่อมที่ผูกกับบัญชี LINE ของคุณ สามารถกดค้นหาด้วยรหัสหรือชื่อได้ที่ปุ่มด้านล่างครับ', size: 'sm', color: '#64748b', wrap: true }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#059669',
                  action: {
                    type: 'uri',
                    label: '🔎 ค้นหาใบแจ้งซ่อม',
                    uri: LIFF_STATUS_URL
                  }
                }
              ]
            }
          }
        }
      ]
    });
    return;
  }

  const bubbles = tickets.map((t) => {
    const statusColor =
      t.status === 'ปิดงาน' ? '#16a34a' :
      t.status === 'รอผู้ใช้ยืนยัน' ? '#2563eb' :
      t.status === 'กำลังดำเนินการ' ? '#7c3aed' :
      '#ea580c';

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: t.ticket_number, weight: 'bold', size: 'md', color: '#ffffff' },
          { type: 'text', text: t.status, size: 'xs', color: '#ffffff', align: 'end', weight: 'bold' }
        ],
        backgroundColor: statusColor
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: 'อาการเสีย:', size: 'xs', color: '#64748b' },
          { type: 'text', text: t.description || '-', size: 'sm', color: '#1e293b', wrap: true, maxLines: 2 },
          ...(t.technician_name ? [
            { type: 'text', text: `👨‍🔧 ช่าง: ${t.technician_name}`, size: 'xs', color: '#059669', margin: 'sm' }
          ] : [])
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(t.status === 'รอผู้ใช้ยืนยัน' ? [
            {
              type: 'button',
              style: 'primary',
              color: '#2563eb',
              height: 'sm',
              action: {
                type: 'uri',
                label: '⭐ ประเมินและปิดงาน',
                uri: `${LIFF_EVALUATE_URL}?ticketId=${t.id}`
              }
            }
          ] : []),
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📋 ดูรายละเอียด',
              uri: LIFF_STATUS_URL
            }
          }
        ]
      }
    };
  });

  await replyToLine({
    replyToken,
    messages: [
      {
        type: 'flex',
        altText: 'สถานะงานซ่อมของคุณ',
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      }
    ]
  });
}

async function handleCloseTicket(replyToken: string, userId: string) {
  let { data: tickets, error } = await supabase
    .from('repair_tickets')
    .select('id, ticket_number, description, technician_name, line_user_id')
    .eq('line_user_id', userId)
    .eq('status', 'รอผู้ใช้ยืนยัน');

  // Fallback: If no tickets matched line_user_id, find tickets with status 'รอผู้ใช้ยืนยัน'
  if (!tickets || tickets.length === 0) {
    const { data: pendingTickets } = await supabase
      .from('repair_tickets')
      .select('id, ticket_number, description, technician_name, line_user_id')
      .eq('status', 'รอผู้ใช้ยืนยัน')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (pendingTickets && pendingTickets.length > 0) {
      tickets = pendingTickets;
      if (userId) {
        await supabase
          .from('repair_tickets')
          .update({ line_user_id: userId })
          .eq('id', pendingTickets[0].id);
      }
    }
  }

  if (error || !tickets || tickets.length === 0) {
    await replyToLine({
      replyToken,
      messages: [{ type: 'text', text: 'ขณะนี้คุณไม่มีใบแจ้งซ่อมที่รอการยืนยันปิดงานครับ 😊' }]
    });
    return;
  }

  const bubbles = tickets.slice(0, 10).map((ticket) => ({
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `รหัส: ${ticket.ticket_number}`, weight: 'bold', size: 'md', color: '#1e293b' },
        { type: 'text', text: ticket.description, size: 'sm', color: '#64748b', wrap: true, margin: 'md' },
        { type: 'text', text: `ช่าง: ${ticket.technician_name}`, size: 'xs', color: '#10b981', margin: 'md' }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#10b981',
          action: {
            type: 'uri',
            label: '⭐ ประเมินและปิดงาน',
            uri: `${LIFF_EVALUATE_URL}?ticketId=${ticket.id}`
          }
        }
      ]
    }
  }));

  const payload = {
    replyToken,
    messages: [
      {
        type: 'flex',
        altText: 'รายการแจ้งซ่อมที่รอปิดงาน',
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      }
    ]
  };

  await replyToLine(payload);
}

async function replyToLine(payload: any) {
  if (!LINE_ACCESS_TOKEN) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify(payload)
  });
}
