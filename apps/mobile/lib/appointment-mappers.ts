import { formatTime, AppointmentState as AppState } from './utils';

interface AppointmentServiceJoin {
  name?: string | null;
  duration_min?: number | null;
}

export interface AppointmentAgendaRow {
  id: string;
  customer_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
  services?: AppointmentServiceJoin | AppointmentServiceJoin[] | null;
}

export function appointmentRowToAgendaItem(row: AppointmentAgendaRow, now = new Date()) {
  const start = new Date(row.starts_at);
  const end = new Date(row.ends_at);
  const service = Array.isArray(row.services) ? row.services[0] : row.services;
  const fallbackDuration = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const dur = service?.duration_min ?? fallbackDuration;
  const state: AppState = row.status === 'completed' ? 'done'
    : (start <= now && now < end) ? 'active' : 'upcoming';

  return {
    type: 'appt' as const,
    id: row.id,
    time: formatTime(start),
    endTime: formatTime(end),
    dur,
    name: row.customer_name,
    svc: service?.name ?? 'Hizmet',
    notes: row.notes ?? null,
    state,
  };
}
