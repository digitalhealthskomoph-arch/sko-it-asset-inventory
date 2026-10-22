import { randomInt } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

// Must match the <option> values in src/app/liff/repair/page.tsx and tools/sko-help/SkoHelp.cs
export const ISSUE_TYPES = ['Hardware', 'Software', 'Network', 'Plan-D', 'ช่วยดึงข้อมูล', 'Other'];

export type Requester = {
  id: string;
  first_name: string;
  last_name: string;
  department_id: string;
  departmentName: string;
};

/**
 * Loads a personnel row and checks it belongs to the given department.
 * Returns null when the pair does not match (the caller answers 400).
 */
export async function loadRequester(
  admin: SupabaseClient,
  personnelId: string,
  departmentId: string
): Promise<Requester | null> {
  const { data: person } = await admin
    .from('personnel')
    .select('id, first_name, last_name, department_id, departments (name)')
    .eq('id', personnelId)
    .maybeSingle();
  if (!person || person.department_id !== departmentId) return null;

  const dept = person.departments as { name?: string } | { name?: string }[] | null;
  const departmentName = (Array.isArray(dept) ? dept[0]?.name : dept?.name) || '';
  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    department_id: person.department_id,
    departmentName,
  };
}

export type NewTicket = {
  department_id: string;
  personnel_id: string;
  asset_id: string | null;
  issue_type: string;
  description: string;
  image_url?: string | null;
  line_user_id?: string | null;
};

/** Inserts a repair ticket with a random, unique ticket number (IT-<thai yy><6 digits>). */
export async function createRepairTicket(
  admin: SupabaseClient,
  ticket: NewTicket
): Promise<{ id: string; ticketNumber: string }> {
  const thaiYear = (new Date().getFullYear() + 543).toString().slice(2);
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketNumber = `IT-${thaiYear}${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
    const { data, error } = await admin
      .from('repair_tickets')
      .insert({
        ticket_number: ticketNumber,
        department_id: ticket.department_id,
        personnel_id: ticket.personnel_id,
        asset_id: ticket.asset_id,
        issue_type: ticket.issue_type,
        description: ticket.description,
        image_url: ticket.image_url ?? null,
        line_user_id: ticket.line_user_id ?? null,
        status: 'รอรับเรื่อง',
      })
      .select('id')
      .single();
    if (!error) return { id: data.id, ticketNumber };
    if (error.code !== '23505') throw error; // 23505 = duplicate ticket_number, retry
  }
  throw new Error('Could not allocate a unique ticket number');
}
