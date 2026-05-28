'use server';

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function assertAdmin(adminKey: string) {
  const secret = process.env.ADMIN_SECRET_KEY ?? '';
  if (!secret) throw new Error('ADMIN_SECRET_KEY env var eksik');
  if (adminKey.length !== secret.length) throw new Error('Yetkisiz');
  const a = Buffer.from(adminKey);
  const b = Buffer.from(secret);
  if (!timingSafeEqual(a, b)) throw new Error('Yetkisiz');
}

export async function approveShop(shopId: string, adminKey: string) {
  assertAdmin(adminKey);
  const supabase = getAdminClient();
  const { error } = await supabase.from('shops').update({ status: 'active' }).eq('id', shopId);
  if (error) throw new Error('Onay başarısız: ' + error.message);

  const { data: shop } = await supabase
    .from('shops')
    .select('owner_user_id')
    .eq('id', shopId)
    .single();

  if (shop?.owner_user_id) {
    const { data: ownerStaff } = await supabase
      .from('staff')
      .select('push_token')
      .eq('shop_id', shopId)
      .eq('user_id', shop.owner_user_id)
      .maybeSingle();

    if (ownerStaff?.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ownerStaff.push_token,
          title: 'Başvurunuz Onaylandı! 🎉',
          body: 'Dükkanınız aktif hale getirildi. Şimdi giriş yapabilirsiniz.',
        }),
      }).catch((e) => console.error('[admin] Push notification failed:', e));
    }
  }
}

export async function rejectShop(shopId: string, adminKey: string) {
  assertAdmin(adminKey);
  const supabase = getAdminClient();
  const { error } = await supabase.from('shops').update({ status: 'rejected' }).eq('id', shopId);
  if (error) throw new Error('Red başarısız: ' + error.message);
}

export async function getPendingShops(adminKey: string) {
  assertAdmin(adminKey);
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, slug, status, created_at, owner_user_id')
    .in('status', ['pending', 'active', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error('Shop listesi alınamadı: ' + error.message);
  return data ?? [];
}
