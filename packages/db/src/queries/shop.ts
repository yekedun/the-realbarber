import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../database.types';

type Client = SupabaseClient<Database>;

export async function getShopByOwner(client: Client, userId: string) {
  return client
    .from('shops')
    .select('id, slug, name, display_name, address, working_hours, status, timezone')
    .or(`owner_user_id.eq.${userId},owner_id.eq.${userId}`)
    .maybeSingle();
}

export async function updateShop(
  client: Client,
  shopId: string,
  patch: {
    name?: string;
    display_name?: string;
    address?: string;
    working_hours?: Json;
    timezone?: string;
  },
) {
  return client
    .from('shops')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', shopId)
    .select('id, slug, name, display_name, address, working_hours, status')
    .single();
}
