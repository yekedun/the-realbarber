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
    .maybeSingle();

  if (!shop) notFound();

  // Active services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_min, price_cents')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('name');

  // Active staff
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('name');

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
      staff={(staff ?? []).map(s => ({ id: s.id, name: s.name }))}
    />
  );
}
