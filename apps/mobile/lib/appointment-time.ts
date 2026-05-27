function toMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) return NaN;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const WORKING_HOUR_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type WorkingHourKey = typeof WORKING_HOUR_KEYS[number];

export type AppointmentWorkingHours = Partial<Record<WorkingHourKey, {
  open?: string;
  close?: string;
  enabled?: boolean;
}>>;

export function formatLocalAppointmentDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateAppointmentTimes({
  open,
  close,
  stepMinutes = 30,
  durationMinutes = 30,
}: {
  open: string;
  close: string;
  stepMinutes?: number;
  durationMinutes?: number;
}): string[] {
  const start = toMinutes(open);
  const closeMin = toMinutes(close);
  if (isNaN(start) || isNaN(closeMin)) {
    console.warn('[appointment-time] Invalid time string:', { open, close });
    return [];
  }
  const latestStart = closeMin - durationMinutes;
  if (latestStart < start || stepMinutes <= 0) return [];

  const slots: string[] = [];
  for (let minute = start; minute <= latestStart; minute += stepMinutes) {
    slots.push(fromMinutes(minute));
  }
  return slots;
}

export function generateAppointmentTimesForDate(
  date: Date,
  workingHours: AppointmentWorkingHours | null | undefined,
  durationMinutes = 30,
): string[] {
  if (isNaN(date.getTime())) {
    console.warn('[appointment-time] Invalid date passed to generateAppointmentTimesForDate');
    return [];
  }
  const key = WORKING_HOUR_KEYS[date.getDay()];
  const day = workingHours?.[key];
  if (day?.enabled === false) return [];

  return generateAppointmentTimes({
    open: day?.open ?? '09:00',
    close: day?.close ?? '23:59',
    stepMinutes: 30,
    durationMinutes,
  });
}

export function buildLocalAppointmentTimestamp(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offsetHour = String(Math.floor(abs / 60)).padStart(2, '0');
  const offsetMinute = String(abs % 60).padStart(2, '0');

  return `${date}T${time}:00${sign}${offsetHour}:${offsetMinute}`;
}
