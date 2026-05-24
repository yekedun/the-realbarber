import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { buildOwnerRoleFilter } from './supabase-role';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function determineUserRole(userId: string): Promise<'owner' | 'staff' | null> {
  const { data: shop } = await supabase
    .from('shops').select('id').or(buildOwnerRoleFilter(userId)).maybeSingle();
  if (shop) return 'owner';
  const { data: barber } = await supabase
    .from('staff').select('id').eq('user_id', userId).eq('is_active', true).maybeSingle();
  if (barber) return 'staff';
  return null;
}
