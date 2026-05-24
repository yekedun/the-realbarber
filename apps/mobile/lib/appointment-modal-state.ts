export interface AppointmentModalService {
  id: string;
  label: string;
  dur: number;
  price: string;
}

interface SaveState {
  customerName: string;
  slot: string;
  serviceId: string | null;
  staffListHasItems: boolean;
  selectedStaffId: string | null;
}

const DESIGN_DEFAULT_SERVICE_ID = 'sac-sakal';

export function getInitialAppointmentServiceId(
  services: AppointmentModalService[],
): string | null {
  if (services.some((service) => service.id === DESIGN_DEFAULT_SERVICE_ID)) {
    return DESIGN_DEFAULT_SERVICE_ID;
  }
  return services[0]?.id ?? null;
}

export function resolveAppointmentServiceId(
  currentServiceId: string | null,
  services: AppointmentModalService[],
): string | null {
  if (currentServiceId && services.some((service) => service.id === currentServiceId)) {
    return currentServiceId;
  }
  return getInitialAppointmentServiceId(services);
}

export function isAppointmentModalSaveEnabled(state: SaveState): boolean {
  return state.customerName.trim().length >= 2
    && !!state.slot
    && !!state.serviceId
    && (!state.staffListHasItems || !!state.selectedStaffId);
}
