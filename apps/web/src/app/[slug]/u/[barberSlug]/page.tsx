// W3 · Berber Kişisel Randevu Sayfası — Server component
// Route: /[slug]/u/[barberSlug]  →  siradaki.app/keskin-berber/u/ahmet
// Pre-selects the barber in BookingClient (soft lock — user can change)

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabase } from '../../../../lib/supabase';
import BookingClient from '../../BookingClient';

interface Props {
  params: Promise<{ slug: string; barberSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, barberSlug } = await params;
  const { data: staffMember } = await supabase
    .from('staff')
    .select('name, shops(name)')
    .eq('slug', barberSlug)
    .eq('shops.slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!staffMember) return { title: 'Berber Bulunamadı' };
  const shopName = (staffMember.shops as any)?.name ?? '';
  return {
    title: `${staffMember.name} — ${shopName} · Online Randevu · Sıradaki`,
    description: `${staffMember.name} ile ${shopName}'de online randevu al.`,
  };
}

export default async function BarberPage({ params }: Props) {
  const { slug, barberSlug } = await params;

  // Shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, display_name, address, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!shop) notFound();

  // Staff member by barberSlug — must belong to this shop
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, name, slug')
    .eq('shop_id', shop.id)
    .eq('slug', barberSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (!staffMember) notFound();

  // All active staff for the booking flow
  const { data: allStaff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('shop_id', shop.id)
    .eq('is_active', true)
    .order('name');

  const sortedStaff = (allStaff ?? []).sort((a, b) => {
    return (a.name ?? '').localeCompare(b.name ?? '', 'tr');
  });

  // Active services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_min, price_cents')
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
      staff={sortedStaff.map(s => ({ id: s.id, name: s.name, phone: null }))}
      preselectedStaffId={staffMember.id}
    />
  );
}
