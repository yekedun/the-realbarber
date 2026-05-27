// W2 · Dükkan Booking Sayfası — Server component
// Route: /[slug]  →  siradaki.app/keskin-berber
// Fetches shop/services/staff on the server, passes to BookingClient

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabase } from '../../lib/supabase';
import BookingClient from './BookingClient';

interface Props {
  params: { slug: string };
}

/* ── Metadata ─────────────────────────────────────────────────── */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: shop } = await supabase
    .from('shops')
    .select('name, display_name, address')
    .eq('slug', params.slug)
    .eq('status', 'active')
    .maybeSingle();
  if (!shop) return { title: 'Dükkan Bulunamadı' };
  const name = shop.name || shop.display_name;
  return {
    title: `${name} — Online Randevu · Sıradaki`,
    description: `${name}${shop.address ? ' · ' + shop.address : ''} — Online randevu al.`,
  };
}

/* ── Page ─────────────────────────────────────────────────────── */
export default async function ShopPage({ params }: Props) {
  const { slug } = params;

  // Shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, display_name, address, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!shop) notFound();

  // Fetch services + staff in parallel — both depend on shop.id
  const [{ data: services }, { data: staff }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, duration_min, price_cents')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('staff')
      .select('id, name, phone, role')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .order('name'),
  ]);

  // Owner always first, then alphabetical by name
  const sortedStaff = (staff ?? []).sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return (a.name ?? '').localeCompare(b.name ?? '', 'tr');
  });

  return (
    <BookingClient
      shop={{
        id:      shop.id,
        name:    shop.name || shop.display_name,
        address: shop.address ?? null,
        slug:    shop.slug,
      }}
      services={(services ?? []).map(s => ({
        id:           s.id,
        name:         s.name,
        duration_min: s.duration_min,
        price:        Math.round(s.price_cents / 100),
      }))}
      staff={sortedStaff.map(s => ({ id: s.id, name: s.name, phone: s.phone ?? null }))}
    />
  );
}
