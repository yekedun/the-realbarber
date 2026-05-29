// W2 · Dükkan Booking Sayfası — Server component
// Route: /[slug]  →  siradaki.app/keskin-berber
// Fetches shop/services/staff on the server, passes to BookingClient

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '../../lib/supabase/server';
import BookingClient from './BookingClient';

interface Props {
  params: Promise<{ slug: string }>;
}

/* ── Metadata ─────────────────────────────────────────────────── */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from('shops')
    .select('name, display_name, address')
    .eq('slug', slug)
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
  const { slug } = await params;
  const supabase = await createClient();

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
      .select('id, name')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .order('name'),
  ]);

  const sortedStaff = (staff ?? []).sort((a, b) => {
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
        price:        Math.round((s.price_cents ?? 0) / 100),
      }))}
      staff={sortedStaff.map(s => ({ id: s.id, name: s.name, phone: null }))}
    />
  );
}
