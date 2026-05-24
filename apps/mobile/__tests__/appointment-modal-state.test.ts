import {
  getInitialAppointmentServiceId,
  isAppointmentModalSaveEnabled,
  resolveAppointmentServiceId,
  type AppointmentModalService,
} from '../lib/appointment-modal-state';

const dbServices: AppointmentModalService[] = [
  { id: 'svc-uuid-1', label: 'Kesim', dur: 30, price: '250' },
  { id: 'svc-uuid-2', label: 'Sakal', dur: 20, price: '150' },
];

describe('appointment modal service selection', () => {
  it('defaults to the first provided service instead of the design mock id', () => {
    expect(getInitialAppointmentServiceId(dbServices)).toBe('svc-uuid-1');
  });

  it('keeps the design mock default when using design mock services', () => {
    expect(getInitialAppointmentServiceId([
      { id: 'sac', label: 'Sac', dur: 30, price: '200' },
      { id: 'sac-sakal', label: 'Sac + Sakal', dur: 45, price: '280' },
    ])).toBe('sac-sakal');
  });

  it('falls back to the first service when selected id disappears after services reload', () => {
    expect(resolveAppointmentServiceId('sac-sakal', dbServices)).toBe('svc-uuid-1');
  });

  it('does not allow saving without a real current service id', () => {
    expect(isAppointmentModalSaveEnabled({
      customerName: 'Ali',
      slot: '09:00',
      serviceId: null,
      staffListHasItems: false,
      selectedStaffId: null,
    })).toBe(false);
  });
});
