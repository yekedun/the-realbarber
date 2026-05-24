-- Allow owner dashboards to show estimated revenue for confirmed appointments.
-- Completed revenue snapshots are granted separately; booked_price_cents is the
-- service price captured at booking time before completion.
GRANT SELECT (
  booked_price_cents
) ON public.appointments TO authenticated;
