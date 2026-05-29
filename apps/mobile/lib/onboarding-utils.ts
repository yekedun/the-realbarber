export { slugify, DEFAULT_WORKING_HOURS } from '@berber/shared';

export function buildBarberLink(
  shopSlug: string | null | undefined,
  staffSlug: string | null | undefined,
): string | null {
  if (!shopSlug || !staffSlug) return null;
  return `https://siradaki.app/${shopSlug}/u/${staffSlug}`;
}

export function buildOnboardingServiceInsert(
  shopId: string,
  name: string,
  durationMin: number,
  priceInput: string,
) {
  return {
    shop_id: shopId,
    name: name.trim(),
    duration_min: durationMin,
    price_cents: Math.round(Number(priceInput) * 100),
    is_active: true,
  };
}
