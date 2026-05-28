export interface BookingFlowState {
  modalOpen: boolean;
  selectedSlot: string | null;
}

export function nextBookingSuccessState(_state: BookingFlowState): BookingFlowState {
  return {
    modalOpen: true,
    selectedSlot: null,
  };
}