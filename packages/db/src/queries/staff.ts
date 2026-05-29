import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Client = SupabaseClient<Database>;

export async function getStaff(client: Client, shopId: string) {
  return client
    .from('staff')
    .select('id, user_id, name, role, is_active, slug, created_at')
    .eq('shop_id', shopId)
    .order('created_at');
}

export async function updateStaffName(client: Client, staffId: string, shopId: string, name: string) {
  return client
    .from('staff')
    .update({ name })
    .eq('id', staffId)
    .eq('shop_id', shopId);
}

export async function setStaffActive(client: Client, staffId: string, shopId: string, isActive: boolean) {
  return client
    .from('staff')
    .update({ is_active: isActive })
    .eq('id', staffId)
    .eq('shop_id', shopId);
}

export async function canDeactivateStaff(
  client: Client,
  shopId: string,
  staffIdToDeactivate: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('staff')
    .select('id')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .neq('id', staffIdToDeactivate);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}
