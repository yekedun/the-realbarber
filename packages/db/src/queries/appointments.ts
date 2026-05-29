import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Client = SupabaseClient<Database>;

export async function getAppointments(
  client: Client,
  shopId: string,
  opts: { date?: string; staffId?: string; status?: string[] } = {},
) {
  // Fetch staff IDs first — Supabase JS v2 does not support subquery in .in()
  const { data: staffRows } = await client
    .from('staff')
    .select('id')
    .eq('shop_id', shopId);

  const staffIds = (staffRows ?? []).map(s => s.id);
  if (staffIds.length === 0) return { data: [], error: null };

  let q = client
    .from('appointments')
    .select(`
      id, starts_at, ends_at, status,
      customer_name, customer_phone, customer_notes,
      booked_price_cents, completed_price_cents,
      staff:staff_id ( id, name ),
      service:service_id ( id, name, duration_min )
    `)
    .in('staff_id', staffIds)
    .order('starts_at');

  if (opts.date) {
    const start = `${opts.date}T00:00:00+03:00`;
    const end   = `${opts.date}T23:59:59+03:00`;
    q = q.gte('starts_at', start).lte('starts_at', end);
  }
  if (opts.staffId) q = q.eq('staff_id', opts.staffId);
  if (opts.status?.length) q = q.in('status', opts.status);

  return q;
}

export async function updateAppointmentStatus(
  client: Client,
  appointmentId: string,
  status: 'confirmed' | 'completed' | 'cancelled',
  completedPriceCents?: number,
) {
  type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];
  const patch: AppointmentUpdate = { status };
  if (status === 'completed') {
    patch.completed_at = new Date().toISOString();
    if (completedPriceCents !== undefined) patch.completed_price_cents = completedPriceCents;
  }
  return client.from('appointments').update(patch).eq('id', appointmentId);
}
