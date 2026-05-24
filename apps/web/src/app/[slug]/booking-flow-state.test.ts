import { nextBookingSuccessState } from './booking-flow-state';

describe('nextBookingSuccessState', () => {
  it('keeps the modal open so the success state can be shown', () => {
    expect(nextBookingSuccessState({
      modalOpen: true,
      selectedSlot: '09:30',
    })).toEqual({
      modalOpen: true,
      selectedSlot: '09:30',
    });
  });
});
