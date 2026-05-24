export interface BookingFlowState {
  modalOpen: boolean;
  selectedSlot: string | null;
}

export function nextBookingSuccessState(state: BookingFlowState): BookingFlowState {
  return {
    ...state,
    modalOpen: true,
  };
}
