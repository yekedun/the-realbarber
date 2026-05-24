export interface AppointmentRevenueRow {
  status: string | null;
  booked_price_cents?: number | null;
  completed_price_cents?: number | null;
}

export function estimatedAppointmentRevenueCents(row: AppointmentRevenueRow): number {
  if (row.status === 'cancelled') return 0;
  return row.completed_price_cents ?? row.booked_price_cents ?? 0;
}
