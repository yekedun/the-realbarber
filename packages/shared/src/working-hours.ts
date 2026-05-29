import type { WorkingHours } from './types';

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { open: '09:00', close: '19:00', enabled: true },
  tue: { open: '09:00', close: '19:00', enabled: true },
  wed: { open: '09:00', close: '19:00', enabled: true },
  thu: { open: '09:00', close: '19:00', enabled: true },
  fri: { open: '09:00', close: '19:00', enabled: true },
  sat: { open: '10:00', close: '17:00', enabled: true },
  sun: { open: '09:00', close: '19:00', enabled: false },
};
