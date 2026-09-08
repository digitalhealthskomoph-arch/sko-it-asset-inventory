import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LIFF_REPAIR_URL = 'https://liff.line.me/2008591648-wGRKxePd';
const LIFF_STATUS_URL = 'https://liff.line.me/2008591648-0lfikgQW';
const LIFF_EVALUATE_URL = 'https://liff.line.me/2008591648-4Sg41AcX';

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

async function handleCloseTicket(replyToken: string, userId: string) {
  const { data: tickets, error } = await supabase
    .from('repair_tickets')
    .select('id, ticket_number, description, technician_name')
    .eq('line_user_id', userId)
    .eq('status', 'รอผู้ใช้ยืนยัน');

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
