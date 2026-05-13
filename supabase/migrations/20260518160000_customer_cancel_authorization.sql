-- Allow customers (customer_user_id) to cancel their own appointments via
-- cancel_appointment_atomic. Previously only shop owners, staff, and admins
-- were authorized, which forced customer-cancel-appointment to bypass the RPC
-- and use a service_role direct UPDATE — a TOCTOU race that could overwrite
-- completed-appointment revenue snapshots.
--
-- Changes:
--   1. Add a.customer_user_id to the v_row SELECT so it is available for the
--      authorization check without an extra round-trip.
--   2. Add OR v_row.customer_user_id = v_uid to the EXISTS guard so an
--      authenticated customer can cancel their own confirmed appointment.
--
-- No RLS or permission changes — the GRANT to authenticated/service_role
-- already exists from 20260518140000.

CREATE OR REPLACE FUNCTION public.cancel_appointment_atomic(
  p_appointment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
BEGIN
  SELECT
    a.id,
    a.status,
    a.staff_id,
    a.customer_user_id,
    st.shop_id,
    st.user_id AS staff_user_id
  INTO v_row
  FROM public.appointments a
  JOIN public.staff st ON st.id = a.staff_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_role NOT IN ('postgres', 'service_role') THEN
    IF v_uid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = v_row.shop_id
        AND (
          sh.owner_user_id = v_uid
          OR sh.owner_id = v_uid
          OR v_row.staff_user_id = v_uid
          OR v_row.customer_user_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.staff admin_staff
            WHERE admin_staff.shop_id = sh.id
              AND admin_staff.user_id = v_uid
              AND admin_staff.role = 'admin'
              AND admin_staff.is_active = true
          )
        )
    ) THEN
      RAISE EXCEPTION 'not allowed to cancel appointment' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_row.status = 'completed' THEN
    RAISE EXCEPTION 'completed appointments cannot be cancelled' USING ERRCODE = '22023';
  END IF;

  IF v_row.status <> 'cancelled' THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_row.staff_id::text));
    PERFORM set_config('app.scheduling_rpc', 'on', true);

    UPDATE public.appointments
       SET status = 'cancelled'
     WHERE id = p_appointment_id;

    PERFORM set_config('app.scheduling_rpc', 'off', true);
  END IF;

  RETURN jsonb_build_object('appointment_id', p_appointment_id, 'status', 'cancelled');
END;
$$;
