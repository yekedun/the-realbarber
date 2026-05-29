import {
  DEFAULT_WORKING_HOURS,
  buildOnboardingServiceInsert,
  buildBarberLink,
} from '../lib/onboarding-utils';

describe('buildOnboardingServiceInsert', () => {
  it('uses is_active (not active) matching the services table schema', () => {
    const payload = buildOnboardingServiceInsert('shop-1', 'Saç Kesimi', 30, '200');
    expect(payload).toMatchObject({ is_active: true });
    expect(payload).not.toHaveProperty('active');
  });

  it('converts price string to price_cents', () => {
    const payload = buildOnboardingServiceInsert('shop-1', 'Sakal', 20, '150');
    expect(payload.price_cents).toBe(15000);
  });

  it('trims whitespace from name', () => {
    const payload = buildOnboardingServiceInsert('shop-1', '  Saç  ', 45, '300');
    expect(payload.name).toBe('Saç');
  });

  it('passes shop_id and duration_min through', () => {
    const payload = buildOnboardingServiceInsert('shop-uuid', 'Test', 60, '100');
    expect(payload.shop_id).toBe('shop-uuid');
    expect(payload.duration_min).toBe(60);
  });
});

describe('buildBarberLink', () => {
  it('returns the full siradaki.app URL for a barber', () => {
    expect(buildBarberLink('keskin-berber', 'ahmet')).toBe('https://siradaki.app/keskin-berber/u/ahmet');
  });

  it('returns null when staff slug is missing', () => {
    expect(buildBarberLink('keskin-berber', null)).toBeNull();
    expect(buildBarberLink('keskin-berber', '')).toBeNull();
  });

  it('returns null when shop slug is missing', () => {
    expect(buildBarberLink(null, 'ahmet')).toBeNull();
  });
});

describe('DEFAULT_WORKING_HOURS', () => {
  it('keeps weekdays and Saturday bookable for newly created shops', () => {
    expect(DEFAULT_WORKING_HOURS.mon).toEqual({ open: '09:00', close: '19:00', enabled: true });
    expect(DEFAULT_WORKING_HOURS.sat).toEqual({ open: '10:00', close: '17:00', enabled: true });
    expect(DEFAULT_WORKING_HOURS.sun.enabled).toBe(false);
  });
});
