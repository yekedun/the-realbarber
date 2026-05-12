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
BEGIN
  IF p_final_price_cents IS NOT NULL AND p_final_price_cents < 0 THEN
    RAISE EXCEPTION 'final price cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT
    a.id,
    a.status,
    a.starts_at,
    a.final_price_cents,
    a.completed_price_cents,
    a.completed_commission_type,
    a.completed_commission_rate_bps,
    a.completed_commission_cents,
    a.completed_shop_share_cents,
    a.staff_id,
    st.shop_id,
    st.commission_type,
    st.commission_rate_bps,
    sh.commission_enabled,
    sv.price_cents
  INTO v_row
  FROM public.appointments a
  JOIN public.staff st ON st.id = a.staff_id
  JOIN public.shops sh ON sh.id = st.shop_id
  LEFT JOIN public.services sv ON sv.id = a.service_id
  WHERE a.id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'P0002';
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff st
    JOIN public.shops sh ON sh.id = st.shop_id
    WHERE st.id = v_row.staff_id
      AND (
        st.user_id = (SELECT auth.uid())
        OR sh.owner_user_id = (SELECT auth.uid())
        OR sh.owner_id = (SELECT auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'not allowed to complete appointment' USING ERRCODE = '42501';
  END IF;

  v_gross := COALESCE(p_final_price_cents, v_row.final_price_cents, v_row.price_cents, 0);

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
  WHERE id = p_appointment_id;

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

CREATE OR REPLACE FUNCTION public.get_staff_commission_configs(p_shop_id uuid)
RETURNS TABLE (staff_id uuid, commission_type text, commission_rate_bps integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shops sh
    WHERE sh.id = p_shop_id
      AND (
        sh.owner_user_id = (SELECT auth.uid())
        OR sh.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.staff admin_staff
          WHERE admin_staff.shop_id = p_shop_id
            AND admin_staff.user_id = (SELECT auth.uid())
            AND admin_staff.role = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not allowed to read commission config' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT st.id, st.commission_type, st.commission_rate_bps
  FROM public.staff st
  WHERE st.shop_id = p_shop_id
  ORDER BY st.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_staff_commission_config(
  p_staff_id uuid,
  p_commission_type text,
  p_commission_rate_bps integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  IF p_commission_type NOT IN ('none', 'percentage') THEN
    RAISE EXCEPTION 'invalid commission type' USING ERRCODE = '22023';
  END IF;

  IF p_commission_type = 'percentage'
     AND (p_commission_rate_bps IS NULL OR p_commission_rate_bps < 0 OR p_commission_rate_bps > 10000) THEN
    RAISE EXCEPTION 'invalid commission rate' USING ERRCODE = '22023';
  END IF;

  SELECT shop_id INTO v_shop_id FROM public.staff WHERE id = p_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'staff not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops sh
    WHERE sh.id = v_shop_id
      AND (
        sh.owner_user_id = (SELECT auth.uid())
        OR sh.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.staff admin_staff
          WHERE admin_staff.shop_id = v_shop_id
            AND admin_staff.user_id = (SELECT auth.uid())
            AND admin_staff.role = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'not allowed to update commission config' USING ERRCODE = '42501';
  END IF;

  UPDATE public.staff
  SET
    commission_type = p_commission_type,
    commission_rate_bps = CASE WHEN p_commission_type = 'percentage' THEN p_commission_rate_bps ELSE NULL END
  WHERE id = p_staff_id;
END;
$$;

REVOKE SELECT ON public.staff FROM anon, authenticated;
GRANT SELECT (id, shop_id, user_id, name, role, is_active, created_at) ON public.staff TO anon, authenticated;

REVOKE SELECT ON public.appointments FROM anon, authenticated;
GRANT SELECT (
  id,
  staff_id,
  service_id,
  customer_name,
  customer_phone,
  customer_user_id,
  customer_notes,
  starts_at,
  ends_at,
  status,
  notes,
  created_at
) ON public.appointments TO authenticated;

GRANT EXECUTE ON FUNCTION public.complete_appointment_with_revenue(uuid, integer) TO authenticated;
ALTER FUNCTION public.get_commission_report(uuid, date, date, uuid) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_staff_commission_configs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_commission_config(uuid, text, integer) TO authenticated;
