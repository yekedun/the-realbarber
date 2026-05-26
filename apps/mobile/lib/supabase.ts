import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { buildOwnerRoleFilter, isMissingStatusColumnError } from './supabase-role';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const SECURE_STORE_CHUNK_SIZE = 1800;
const CHUNK_PREFIX = '__chunked__:';

async function removeChunkedItem(key: string) {
  const current = await SecureStore.getItemAsync(key);
  if (current?.startsWith(CHUNK_PREFIX)) {
    const count = Number(current.slice(CHUNK_PREFIX.length));
    await Promise.all(
      Array.from({ length: Number.isFinite(count) ? count : 0 }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${index}`),
      ),
    );
  }
  await SecureStore.deleteItemAsync(key);
}

const secureStoreAdapter = {
  async getItem(key: string) {
    const value = await SecureStore.getItemAsync(key);
    if (!value?.startsWith(CHUNK_PREFIX)) return value;

    const count = Number(value.slice(CHUNK_PREFIX.length));
    if (!Number.isFinite(count) || count <= 0) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    if (chunks.some(chunk => chunk === null)) return null;
    return chunks.join('');
  },
  async setItem(key: string, value: string) {
    await removeChunkedItem(key);
    if (value.length <= SECURE_STORE_CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) ?? [];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${chunks.length}`);
  },
  removeItem: removeChunkedItem,
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
export type UserRole = 'owner' | 'pending' | 'rejected' | 'staff' | 'new_user' | 'unknown';

export async function determineUserRole(
  userId: string
): Promise<UserRole> {
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, status')
    .or(buildOwnerRoleFilter(userId))
    .maybeSingle();
  if (shopError) {
    if (!isMissingStatusColumnError(shopError)) return 'unknown';

    const { data: legacyShop, error: legacyShopError } = await supabase
      .from('shops')
      .select('id')
      .or(buildOwnerRoleFilter(userId))
      .maybeSingle();
    if (legacyShopError) return 'unknown';
    if (legacyShop) return 'owner';
  }

  if (shop) {
    if (shop.status === 'active') return 'owner';
    if (shop.status === 'pending') return 'pending';
    if (shop.status === 'rejected') return 'rejected';
  }

  const { data: barber, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (staffError) return 'unknown';

  if (barber) return 'staff';
  return 'new_user';
}
