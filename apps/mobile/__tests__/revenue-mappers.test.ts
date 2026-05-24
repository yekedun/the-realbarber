import { estimatedAppointmentRevenueCents } from '../lib/revenue-mappers';

describe('estimatedAppointmentRevenueCents', () => {
  it('uses booked price for confirmed appointments that are not completed yet', () => {
    expect(estimatedAppointmentRevenueCents({
      status: 'confirmed',
      booked_price_cents: 35000,
      completed_price_cents: null,
    })).toBe(35000);
  });

  it('prefers completed snapshot once the appointment is completed', () => {
    expect(estimatedAppointmentRevenueCents({
      status: 'completed',
      booked_price_cents: 30000,
      completed_price_cents: 28000,
    })).toBe(28000);
  });

  it('does not count cancelled appointments', () => {
    expect(estimatedAppointmentRevenueCents({
      status: 'cancelled',
      booked_price_cents: 35000,
      completed_price_cents: null,
    })).toBe(0);
  });
});
