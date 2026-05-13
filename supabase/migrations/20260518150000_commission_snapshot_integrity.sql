-- Preserve commission/revenue history without expanding the product into payroll.
-- Booking stores the service price seen at scheduling time; completion snapshots
-- the actual completed price and commission exactly once through the controlled RPC.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booked_price_cents integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_booked_price_cents_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_booked_price_cents_check
      CHECK (booked_price_cents IS NULL OR booked_price_cents >= 0);
  END IF;
END $$;

UPDATE public.appointments a
SET booked_price_cents = sv.price_cents
FROM public.services sv
WHERE a.service_id = sv.id
  AND a.booked_price_cents IS NULL
  AND sv.price_cents IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
  p_shop_slug text DEFAULT NULL,
  p_shop_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_staff_id uuid DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_staff_id uuid;
  v_ends_at timestamptz;
  v_appointment_id uuid;
  v_staff_name text;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_privileged boolean;
BEGIN
  IF p_service_id IS NULL OR p_starts_at IS NULL OR trim(COALESCE(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Eksik randevu bilgisi' USING ERRCODE = '22023';
  END IF;
  IF char_length(trim(p_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Isim en az 2 karakter olmali' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_shop
  FROM public.shops
  WHERE (p_shop_id IS NOT NULL AND id = p_shop_id)
     OR (p_shop_id IS NULL AND slug = p_shop_slug)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dukkan bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND shop_id = v_shop.id
    AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hizmet bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT s.id INTO v_staff_id
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.shop_id = v_shop.id
      AND s.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Personel bulunamadi' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_is_privileged := v_role IN ('postgres', 'service_role');
  IF NOT v_is_privileged THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'not allowed to create appointment' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = v_shop.id
        AND (
          sh.owner_user_id = v_uid
          OR sh.owner_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.staff admin_staff
            WHERE admin_staff.shop_id = sh.id
              AND admin_staff.user_id = v_uid
              AND admin_staff.role = 'admin'
              AND admin_staff.is_active = true
          )
          OR (
            v_staff_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.staff self_staff
              WHERE self_staff.id = v_staff_id
                AND self_staff.user_id = v_uid
                AND self_staff.is_active = true
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'not allowed to create appointment' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_min);

  IF v_staff_id IS NULL THEN
    v_staff_id := public.assign_any_staff(v_shop.id, p_starts_at, v_ends_at);
    IF v_staff_id IS NULL THEN
      RAISE EXCEPTION 'Secilen saatte musait personel yok' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(v_staff_id::text));

    IF NOT public.staff_is_inside_work_window(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saat personelin calisma saati veya mola araligi disinda' USING ERRCODE = 'P0001';
    END IF;

    IF public.schedule_has_conflict(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saat dolu; cakisan randevu veya manuel blok var' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.scheduling_rpc', 'on', true);

  INSERT INTO public.appointments (
    staff_id, service_id, customer_name, customer_phone, customer_notes,
    customer_user_id, starts_at, ends_at, status, booked_price_cents
  )
  VALUES (
    v_staff_id, v_service.id, trim(p_customer_name), nullif(trim(COALESCE(p_customer_phone, '')), ''),
    nullif(trim(COALESCE(p_customer_notes, '')), ''), p_customer_user_id,
    p_starts_at, v_ends_at, 'confirmed', v_service.price_cents
  )
  RETURNING id INTO v_appointment_id;

  PERFORM set_config('app.scheduling_rpc', 'off', true);

  SELECT name INTO v_staff_name FROM public.staff WHERE id = v_staff_id;

  RETURN json_build_object(
    'appointment_id', v_appointment_id,
    'starts_at', p_starts_at,
    'ends_at', v_ends_at,
    'staff_id', v_staff_id,
    'staff_name', COALESCE(v_staff_name, ''),
    'barber_display_name', COALESCE(v_staff_name, ''),
    'service_name', v_service.name
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Secilen saat dolu; cakisan randevu veya manuel blok var' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_appointment_atomic(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_appointment record;
  v_ends_at timestamptz;
  v_updated int;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
  v_is_privileged boolean;
BEGIN
  SELECT
    a.id,
    a.status,
    a.staff_id,
    st.shop_id,
    st.user_id AS current_staff_user_id
  INTO v_appointment
  FROM public.appointments a
  JOIN public.staff st ON st.id = a.staff_id
  WHERE a.id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Randevu bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  IF v_appointment.status <> 'confirmed' THEN
    RAISE EXCEPTION 'only confirmed appointments can be edited' USING ERRCODE = '22023';
  END IF;

  SELECT srv.* INTO v_service
  FROM public.services srv
  JOIN public.staff st ON st.shop_id = srv.shop_id
  WHERE srv.id = p_service_id
    AND st.id = p_staff_id
    AND st.shop_id = v_appointment.shop_id
    AND srv.is_active = true
    AND st.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hizmet veya personel bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  v_is_privileged := v_role IN ('postgres', 'service_role');
  IF NOT v_is_privileged THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'not allowed to update appointment' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.shops sh
      WHERE sh.id = v_appointment.shop_id
        AND (
          sh.owner_user_id = v_uid
          OR sh.owner_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.staff admin_staff
            WHERE admin_staff.shop_id = sh.id
              AND admin_staff.user_id = v_uid
              AND admin_staff.role = 'admin'
              AND admin_staff.is_active = true
          )
          OR (
            p_staff_id = v_appointment.staff_id
            AND v_appointment.current_staff_user_id = v_uid
          )
        )
    ) THEN
      RAISE EXCEPTION 'not allowed to update appointment' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_min);
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text));

  IF NOT public.staff_is_inside_work_window(p_staff_id, p_starts_at, v_ends_at)
     OR public.schedule_has_conflict(p_staff_id, p_starts_at, v_ends_at, p_appointment_id, NULL) THEN
    RAISE EXCEPTION 'Bu saat artik musait degil' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.scheduling_rpc', 'on', true);

  UPDATE public.appointments
     SET staff_id = p_staff_id,
         service_id = p_service_id,
         booked_price_cents = v_service.price_cents,
         customer_name = trim(p_customer_name),
         customer_phone = nullif(trim(COALESCE(p_customer_phone, '')), ''),
         customer_notes = nullif(trim(COALESCE(p_customer_notes, '')), ''),
         starts_at = p_starts_at,
         ends_at = v_ends_at,
         status = 'confirmed'
   WHERE id = p_appointment_id
     AND status = 'confirmed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  PERFORM set_config('app.scheduling_rpc', 'off', true);

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Randevu bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  RETURN json_build_object('appointment_id', p_appointment_id, 'starts_at', p_starts_at, 'ends_at', v_ends_at);
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Bu saat artik musait degil' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_appointment_with_revenue(
  p_appointment_id uuid,
  p_final_price_cents integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_gross integer;
  v_commission_type text;
  v_commission_rate_bps integer;
  v_commission_cents integer;
  v_shop_share_cents integer;
  v_updated int;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
BEGIN
  IF p_final_price_cents IS NOT NULL AND p_final_price_cents < 0 THEN
    RAISE EXCEPTION 'final price cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT
    a.id,
    a.status,
    a.starts_at,
    a.booked_price_cents,
    a.final_price_cents,
    a.completed_price_cents,
    a.completed_commission_type,
    a.completed_commission_rate_bps,
    a.completed_commission_cents,
    a.completed_shop_share_cents,
    a.staff_id,
    st.shop_id,
    st.user_id AS staff_user_id,
    st.commission_type,
    st.commission_rate_bps,
    sh.commission_enabled,
    sv.price_cents
  INTO v_row
  FROM public.appointments a
  JOIN public.staff st ON st.id = a.staff_id
  JOIN public.shops sh ON sh.id = st.shop_id
  LEFT JOIN public.services sv ON sv.id = a.service_id
  WHERE a.id = p_appointment_id
  FOR UPDATE OF a;

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
      RAISE EXCEPTION 'not allowed to complete appointment' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'appointment_id', p_appointment_id,
      'completed_price_cents', v_row.completed_price_cents,
      'completed_commission_type', v_row.completed_commission_type,
      'completed_commission_rate_bps', v_row.completed_commission_rate_bps,
      'completed_commission_cents', v_row.completed_commission_cents,
      'completed_shop_share_cents', v_row.completed_shop_share_cents
    );
  END IF;

  IF v_row.status <> 'confirmed' THEN
    RAISE EXCEPTION 'only confirmed appointments can be completed' USING ERRCODE = '22023';
  END IF;

  IF v_row.starts_at > now() THEN
    RAISE EXCEPTION 'future appointments cannot be completed' USING ERRCODE = '22023';
  END IF;

  v_gross := COALESCE(p_final_price_cents, v_row.final_price_cents, v_row.booked_price_cents, v_row.price_cents, 0);

  IF v_row.commission_enabled AND v_row.commission_type = 'percentage' THEN
    v_commission_type := 'percentage';
    v_commission_rate_bps := COALESCE(v_row.commission_rate_bps, 0);
    v_commission_cents := ROUND((v_gross::numeric * v_commission_rate_bps::numeric) / 10000)::integer;
  ELSE
    v_commission_type := 'none';
    v_commission_rate_bps := NULL;
    v_commission_cents := 0;
  END IF;

  v_shop_share_cents := v_gross - v_commission_cents;

  PERFORM set_config('app.commission_completion_rpc', 'on', true);

  UPDATE public.appointments
  SET
    status = 'completed',
    final_price_cents = v_gross,
    completed_price_cents = v_gross,
    completed_commission_type = v_commission_type,
    completed_commission_rate_bps = v_commission_rate_bps,
    completed_commission_cents = v_commission_cents,
    completed_shop_share_cents = v_shop_share_cents,
    completed_at = COALESCE(completed_at, now())
  WHERE id = p_appointment_id
    AND status = 'confirmed';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  PERFORM set_config('app.commission_completion_rpc', 'off', true);

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'appointment could not be completed' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'completed_price_cents', v_gross,
    'completed_commission_type', v_commission_type,
    'completed_commission_rate_bps', v_commission_rate_bps,
    'completed_commission_cents', v_commission_cents,
    'completed_shop_share_cents', v_shop_share_cents
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_direct_appointment_scheduling_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := current_setting('role', true);
  v_scheduling_rpc boolean := current_setting('app.scheduling_rpc', true) = 'on';
  v_completion_rpc boolean := current_setting('app.commission_completion_rpc', true) = 'on';
BEGIN
  IF v_role IN ('none', 'postgres', 'service_role') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_scheduling_rpc THEN
      RAISE EXCEPTION 'appointment scheduling writes must use atomic RPC'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'appointment scheduling deletes are not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.staff_id IS DISTINCT FROM OLD.staff_id
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     )
     AND NOT v_scheduling_rpc THEN
    RAISE EXCEPTION 'appointment rescheduling must use atomic RPC'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.booked_price_cents IS DISTINCT FROM OLD.booked_price_cents
     AND NOT (
       v_scheduling_rpc
       AND OLD.status = 'confirmed'
       AND NEW.status = 'confirmed'
     ) THEN
    RAISE EXCEPTION 'booking price snapshot cannot be changed directly'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.final_price_cents IS DISTINCT FROM OLD.final_price_cents
       OR NEW.completed_price_cents IS DISTINCT FROM OLD.completed_price_cents
       OR NEW.completed_commission_type IS DISTINCT FROM OLD.completed_commission_type
       OR NEW.completed_commission_rate_bps IS DISTINCT FROM OLD.completed_commission_rate_bps
       OR NEW.completed_commission_cents IS DISTINCT FROM OLD.completed_commission_cents
       OR NEW.completed_shop_share_cents IS DISTINCT FROM OLD.completed_shop_share_cents
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     )
     AND NOT v_completion_rpc THEN
    RAISE EXCEPTION 'completed revenue snapshot cannot be changed directly'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (NEW.status = 'cancelled' AND v_scheduling_rpc)
       OR (NEW.status = 'completed' AND v_completion_rpc)
     ) THEN
    RAISE EXCEPTION 'appointment status transitions must use controlled RPC'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_direct_appointment_scheduling_writes()
  FROM PUBLIC, anon, authenticated;
