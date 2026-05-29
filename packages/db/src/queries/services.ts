import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Client = SupabaseClient<Database>;

export async function getServices(client: Client, shopId: string) {
  return client
    .from('services')
    .select('id, name, duration_min, price_cents, display_order, is_active')
    .eq('shop_id', shopId)
    .order('display_order')
    .order('name');
}

export async function upsertService(
  client: Client,
  shopId: string,
  data: {
    id?: string;
    name: string;
    duration_min: number;
    price_cents: number;
    is_active?: boolean;
  },
) {
  if (data.id) {
    return client
      .from('services')
      .update({ name: data.name, duration_min: data.duration_min, price_cents: data.price_cents, is_active: data.is_active ?? true })
      .eq('id', data.id)
      .eq('shop_id', shopId)
      .select('id, name, duration_min, price_cents, is_active')
      .single();
  }
  return client
    .from('services')
    .insert({ shop_id: shopId, name: data.name, duration_min: data.duration_min, price_cents: data.price_cents, is_active: true })
    .select('id, name, duration_min, price_cents, is_active')
    .single();
}

export async function toggleService(client: Client, serviceId: string, shopId: string, isActive: boolean) {
  return client
    .from('services')
    .update({ is_active: isActive })
    .eq('id', serviceId)
    .eq('shop_id', shopId);
}

export async function deleteService(client: Client, serviceId: string, shopId: string) {
  return client
    .from('services')
    .update({ is_active: false })
    .eq('id', serviceId)
    .eq('shop_id', shopId);
}
