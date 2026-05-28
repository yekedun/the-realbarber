-- Guard: reject bookings for non-active shops.
-- create_appointment_atomic fetches the shop but never checked status after
-- 20260526100000_shop_status.sql introduced the status column.

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

  IF p_starts_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Geçmiş bir saate randevu oluşturulamaz' USING ERRCODE = '22023';
  END IF;

  IF p_customer_phone IS NOT NULL AND trim(p_customer_phone) <> '' THEN
    IF (
      SELECT COUNT(*)
      FROM public.appointments
      WHERE customer_phone = trim(p_customer_phone)
        AND created_at > now() - interval '10 minutes'
    ) >= 5 THEN
      RAISE EXCEPTION 'Çok fazla randevu isteği. Lütfen birkaç dakika bekleyin.' USING ERRCODE = 'P0004';
    END IF;
  END IF;

  SELECT * INTO v_shop
  FROM public.shops
  WHERE (p_shop_id IS NOT NULL AND id = p_shop_id)
     OR (p_shop_id IS NULL AND slug = p_shop_slug)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dukkan bulunamadi' USING ERRCODE = 'P0002';
  END IF;

  -- Reject bookings for shops that are not active
  IF v_shop.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Bu dükkan şu anda randevu kabul etmiyor' USING ERRCODE = 'P0002';
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
    PERFORM pg_advisory_xact_lock(('x' || md5(v_staff_id::text))::bit(64)::bigint);
    IF NOT public.staff_is_inside_work_window(v_staff_id, p_starts_at, v_ends_at)
       OR public.schedule_has_conflict(v_staff_id, p_starts_at, v_ends_at) THEN
      RAISE EXCEPTION 'Secilen saatte musait personel yok' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(('x' || md5(v_staff_id::text))::bit(64)::bigint);

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