import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Client = SupabaseClient<Database>;

export type EarningsPeriod = 'day' | '7' | '30';

export async function getEarningsReport(client: Client, shopId: string, period: EarningsPeriod) {
  const days = period === 'day' ? 1 : period === '7' ? 7 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch staff IDs first — Supabase JS v2 does not support subquery in .in()
  const { data: staffRows } = await client
    .from('staff')
    .select('id')
    .eq('shop_id', shopId);

  const staffIds = (staffRows ?? []).map(s => s.id);
  if (staffIds.length === 0) return { data: [], error: null };

  return client
    .from('appointments')
    .select(`
      id, completed_price_cents, completed_commission_cents,
      completed_shop_share_cents, completed_at,
      staff:staff_id ( id, name )
    `)
    .in('staff_id', staffIds)
    .eq('status', 'completed')
    .gte('completed_at', since)
    .order('completed_at', { ascending: false });
}
