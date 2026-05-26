import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { buildOwnerRoleFilter } from './supabase-role';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const secureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type ShopStatus = 'pending' | 'active' | 'rejected';

export async function determineUserRole(
  userId: string
): Promise<'owner' | 'pending' | 'rejected' | 'staff' | 'new_user'> {
  const { data: shop } = await supabase
    .from('shops')
    .select('id, status')
    .or(buildOwnerRoleFilter(userId))
    .maybeSingle();

  if (shop) {
    if (shop.status === 'active') return 'owner';
    if (shop.status === 'pending') return 'pending';
    if (shop.status === 'rejected') return 'rejected';
  }

  const { data: barber } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (barber) return 'staff';
  return 'new_user';
}
