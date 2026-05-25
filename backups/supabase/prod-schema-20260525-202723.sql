


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."staff_role" AS ENUM (
    'admin',
    'staff'
);


ALTER TYPE "public"."staff_role" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."assign_any_staff"("p_shop_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_staff_id uuid;
  r record;
BEGIN
  FOR r IN
    SELECT s.id
    FROM public.staff s
    WHERE s.shop_id = p_shop_id
      AND s.is_active = true
    ORDER BY (
      SELECT COUNT(*)
      FROM public.appointments a
      WHERE a.staff_id = s.id
        AND a.status <> 'cancelled'
        AND a.starts_at >= date_trunc('day', p_starts_at)
        AND a.starts_at < date_trunc('day', p_starts_at) + interval '1 day'
    ), s.created_at, s.id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(r.id::text));
    IF public.staff_is_inside_work_window(r.id, p_starts_at, p_ends_at)
       AND NOT public.schedule_has_conflict(r.id, p_starts_at, p_ends_at) THEN
      v_staff_id := r.id;
      EXIT;
    END IF;
  END LOOP;

  RETURN v_staff_id;
END;
$$;


ALTER FUNCTION "public"."assign_any_staff"("p_shop_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_appointment_atomic"("p_appointment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    PERFORM pg_advisory_xact_lock(('x' || md5(v_row.staff_id::text))::bit(64)::bigint);
    PERFORM set_config('app.scheduling_rpc', 'on', true);

    UPDATE public.appointments
       SET status = 'cancelled'
     WHERE id = p_appointment_id;

    PERFORM set_config('app.scheduling_rpc', 'off', true);
  END IF;

  RETURN jsonb_build_object('appointment_id', p_appointment_id, 'status', 'cancelled');
END;
$$;


ALTER FUNCTION "public"."cancel_appointment_atomic"("p_appointment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_appointment_with_revenue"("p_appointment_id" "uuid", "p_final_price_cents" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."complete_appointment_with_revenue"("p_appointment_id" "uuid", "p_final_price_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment_atomic"("p_shop_slug" "text" DEFAULT NULL::"text", "p_shop_id" "uuid" DEFAULT NULL::"uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_starts_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_customer_name" "text" DEFAULT NULL::"text", "p_customer_phone" "text" DEFAULT NULL::"text", "p_customer_notes" "text" DEFAULT NULL::"text", "p_customer_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_appointment_atomic"("p_shop_slug" "text", "p_shop_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text", "p_customer_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_block_atomic"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_reason" "text" DEFAULT 'walkin'::"text", "p_created_via" "text" DEFAULT 'app'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_block_id uuid;
  v_role text := current_setting('role', true);
  v_uid uuid := auth.uid();
BEGIN
  IF p_staff_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'Gecersiz blok bilgisi' USING ERRCODE = '22023';
  END IF;

  IF v_role NOT IN ('postgres', 'service_role') THEN
    IF v_uid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.staff st
      JOIN public.shops sh ON sh.id = st.shop_id
      WHERE st.id = p_staff_id
        AND st.is_active = true
        AND (
          st.user_id = v_uid
          OR sh.owner_user_id = v_uid
          OR sh.owner_id = v_uid
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
      RAISE EXCEPTION 'not allowed to create block' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(('x' || md5(p_staff_id::text))::bit(64)::bigint);

  IF public.schedule_has_conflict(p_staff_id, p_starts_at, p_ends_at) THEN
    RAISE EXCEPTION 'Bu saat dolu; cakisan randevu veya blok var' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.scheduling_rpc', 'on', true);

  INSERT INTO public.blocks (staff_id, starts_at, ends_at, reason, created_via)
  VALUES (p_staff_id, p_starts_at, p_ends_at, p_reason, p_created_via)
  RETURNING id INTO v_block_id;

  PERFORM set_config('app.scheduling_rpc', 'off', true);

  RETURN json_build_object('block_id', v_block_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at);
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Bu saat dolu; cakisan randevu veya blok var' USING ERRCODE = 'P0001';
END;
$$;


ALTER FUNCTION "public"."create_block_atomic"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_reason" "text", "p_created_via" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_owner_staff"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner_id   uuid;
  v_owner_name text;
  v_base_slug  text;
  v_slug       text;
  v_suffix     int := 0;
BEGIN
  v_owner_id := COALESCE(NEW.owner_user_id, NEW.owner_id);

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Owner zaten bu dükkanın staff'ında varsa bir şey yapma
  IF EXISTS (
    SELECT 1
    FROM public.staff st
    WHERE st.shop_id = NEW.id
      AND st.user_id = v_owner_id
  ) THEN
    RETURN NEW;
  END IF;

  v_owner_name := COALESCE(NULLIF(NEW.display_name, ''), NULLIF(NEW.name, ''), 'Dukkan Sahibi');
  v_base_slug  := public.slugify(v_owner_name);

  -- Aynı dükkan içinde çakışma yoksa base slug'ı kullan, varsa -2, -3 ... ekle
  v_slug := v_base_slug;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.staff
      WHERE shop_id = NEW.id AND slug = v_slug
    );
    v_suffix := v_suffix + 1;
    v_slug   := v_base_slug || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.staff (shop_id, user_id, name, slug, role, is_active)
  VALUES (NEW.id, v_owner_id, v_owner_name, v_slug, 'admin'::public.staff_role, true);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_owner_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_commission_report"("p_shop_id" "uuid", "p_from" "date", "p_to" "date", "p_staff_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_timezone text;
  v_start timestamptz;
  v_end timestamptz;
  v_rows jsonb;
  v_total_revenue integer;
  v_total_commission integer;
  v_total_shop_share integer;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'invalid report date range' USING ERRCODE = '22023';
  END IF;

  SELECT timezone INTO v_timezone
  FROM public.shops
  WHERE id = p_shop_id
    AND commission_enabled = true
    AND (
      owner_user_id = (SELECT auth.uid())
      OR owner_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.staff admin_staff
        WHERE admin_staff.shop_id = p_shop_id
          AND admin_staff.user_id = (SELECT auth.uid())
          AND admin_staff.role = 'admin'
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'commission report is not available' USING ERRCODE = '42501';
  END IF;

  v_start := p_from::timestamp AT TIME ZONE v_timezone;
  v_end := (p_to + 1)::timestamp AT TIME ZONE v_timezone;

  WITH per_staff AS (
    SELECT
      st.id AS staff_id,
      st.name AS staff_name,
      COUNT(a.id)::integer AS completed_count,
      COALESCE(SUM(a.completed_price_cents), 0)::integer AS gross_revenue_cents,
      COALESCE(SUM(a.completed_commission_cents), 0)::integer AS commission_cents,
      COALESCE(SUM(a.completed_shop_share_cents), 0)::integer AS shop_share_cents
    FROM public.staff st
    LEFT JOIN public.appointments a
      ON a.staff_id = st.id
     AND a.status = 'completed'
     AND a.completed_at >= v_start
     AND a.completed_at < v_end
    WHERE st.shop_id = p_shop_id
      AND (p_staff_id IS NULL OR st.id = p_staff_id)
    GROUP BY st.id, st.name
    ORDER BY st.name
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'staff_id', staff_id,
      'staff_name', staff_name,
      'completed_count', completed_count,
      'gross_revenue_cents', gross_revenue_cents,
      'commission_cents', commission_cents,
      'shop_share_cents', shop_share_cents
    )), '[]'::jsonb),
    COALESCE(SUM(gross_revenue_cents), 0)::integer,
    COALESCE(SUM(commission_cents), 0)::integer,
    COALESCE(SUM(shop_share_cents), 0)::integer
  INTO v_rows, v_total_revenue, v_total_commission, v_total_shop_share
  FROM per_staff;

  RETURN jsonb_build_object(
    'shop_id', p_shop_id,
    'from', p_from,
    'to', p_to,
    'total_revenue_cents', v_total_revenue,
    'total_commission_cents', v_total_commission,
    'total_shop_share_cents', v_total_shop_share,
    'staff', v_rows
  );
END;
$$;


ALTER FUNCTION "public"."get_commission_report"("p_shop_id" "uuid", "p_from" "date", "p_to" "date", "p_staff_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_occupied_ranges"("p_staff_id" "uuid", "p_date" "date") RETURNS TABLE("starts_at" timestamp with time zone, "ends_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH staff_shop AS (
    SELECT s.id, sh.timezone
    FROM public.staff s
    JOIN public.shops sh ON sh.id = s.shop_id
    WHERE s.id = p_staff_id
  ),
  bounds AS (
    SELECT b.starts_at AS day_start, b.ends_at AS day_end, ss.timezone
    FROM staff_shop ss
    CROSS JOIN LATERAL public.schedule_day_bounds(p_date, ss.timezone) b
  )
  SELECT a.starts_at, a.ends_at
  FROM public.appointments a
  CROSS JOIN bounds b
  WHERE a.staff_id = p_staff_id
    AND a.status <> 'cancelled'
    AND a.starts_at < b.day_end
    AND a.ends_at > b.day_start

  UNION ALL

  SELECT bl.starts_at, bl.ends_at
  FROM public.blocks bl
  CROSS JOIN bounds b
  WHERE bl.staff_id = p_staff_id
    AND bl.starts_at < b.day_end
    AND bl.ends_at > b.day_start

  UNION ALL

  SELECT b.day_start, b.day_end
  FROM public.staff_schedules ss
  CROSS JOIN bounds b
  WHERE ss.staff_id = p_staff_id
    AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
    AND ss.is_working = false

  UNION ALL

  SELECT
    (p_date + ss.break_start)::timestamp AT TIME ZONE b.timezone,
    (p_date + ss.break_end)::timestamp AT TIME ZONE b.timezone
  FROM public.staff_schedules ss
  CROSS JOIN bounds b
  WHERE ss.staff_id = p_staff_id
    AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
    AND ss.is_working = true
    AND ss.break_start IS NOT NULL
    AND ss.break_end IS NOT NULL

  ORDER BY starts_at;
$$;


ALTER FUNCTION "public"."get_occupied_ranges"("p_staff_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("id" "uuid", "staff_id" "uuid", "status" "text", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone, "booked_price_cents" integer, "completed_price_cents" integer, "completed_commission_cents" integer, "completed_shop_share_cents" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    RAISE EXCEPTION 'not allowed to read shop revenue' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.staff_id,
    a.status,
    a.starts_at,
    a.ends_at,
    a.booked_price_cents,
    a.completed_price_cents,
    a.completed_commission_cents,
    a.completed_shop_share_cents
  FROM public.appointments a
  JOIN public.staff st ON st.id = a.staff_id
  WHERE st.shop_id = p_shop_id
    AND a.starts_at >= p_from
    AND a.starts_at < p_to
    AND a.status <> 'cancelled'
    AND (p_staff_ids IS NULL OR a.staff_id = ANY(p_staff_ids));
END;
$$;


ALTER FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_dashboard_stats"("p_shop_id" "uuid", "p_today" "date", "p_staff_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_range_start timestamptz := p_today::timestamptz - interval '30 days';
  v_range_end   timestamptz := p_today::timestamptz + interval '30 days';
  v_today_start timestamptz := p_today::timestamptz;
  v_today_end   timestamptz := (p_today + 1)::timestamptz;
  
  v_total_today int;
  v_completed_today int;
  v_cancelled_today int;
  v_revenue_today numeric;
  v_top_staff text;
  v_busiest_day text;
  v_busiest_count int;
  v_staff_stats json;
BEGIN
  -- Bugün Toplam, Tamamlanan, İptal ve Tahmini Ciro
  SELECT 
    COUNT(*), 
    COALESCE(SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.status != 'cancelled' THEN srv.price_cents ELSE 0 END), 0) / 100.0
  INTO v_total_today, v_completed_today, v_cancelled_today, v_revenue_today
  FROM public.appointments a
  JOIN public.staff st ON a.staff_id = st.id
  LEFT JOIN public.services srv ON a.service_id = srv.id
  WHERE st.shop_id = p_shop_id 
    AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
    AND a.starts_at >= v_today_start 
    AND a.starts_at < v_today_end;

  -- 30 Günlük En Çok Tercih Edilen (Top Staff)
  SELECT st.name INTO v_top_staff
  FROM public.appointments a
  JOIN public.staff st ON a.staff_id = st.id
  WHERE st.shop_id = p_shop_id 
    AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
    AND a.starts_at >= v_range_start 
    AND a.starts_at < v_range_end
    AND a.status != 'cancelled'
  GROUP BY st.id, st.name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- 30 Günlük En Yoğun Gün
  SELECT to_char(a.starts_at, 'YYYY-MM-DD'), COUNT(*) INTO v_busiest_day, v_busiest_count
  FROM public.appointments a
  JOIN public.staff st ON a.staff_id = st.id
  WHERE st.shop_id = p_shop_id 
    AND (p_staff_id IS NULL OR a.staff_id = p_staff_id)
    AND a.starts_at >= v_range_start 
    AND a.starts_at < v_range_end
    AND a.status != 'cancelled'
  GROUP BY to_char(a.starts_at, 'YYYY-MM-DD')
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Personel bazlı bugünün geçerli randevu sayıları (staffStats)
  SELECT json_agg(json_build_object('id', st.id, 'name', st.name, 'count', COALESCE(counts.c, 0)))
  INTO v_staff_stats
  FROM public.staff st
  LEFT JOIN (
    SELECT staff_id, COUNT(*) as c
    FROM public.appointments
    WHERE status != 'cancelled'
      AND starts_at >= v_today_start
      AND starts_at < v_today_end
    GROUP BY staff_id
  ) counts ON counts.staff_id = st.id
  WHERE st.shop_id = p_shop_id
    AND (p_staff_id IS NULL OR st.id = p_staff_id)
    AND st.is_active = true;

  RETURN json_build_object(
    'total', v_total_today,
    'completed', v_completed_today,
    'cancelled', v_cancelled_today,
    'revenue', v_revenue_today,
    'topStaff', v_top_staff,
    'busiestDay', json_build_object('date', v_busiest_day, 'count', COALESCE(v_busiest_count, 0)),
    'staffStats', COALESCE(v_staff_stats, '[]'::json)
  );
END;
$$;


ALTER FUNCTION "public"."get_shop_dashboard_stats"("p_shop_id" "uuid", "p_today" "date", "p_staff_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shop_occupied_ranges"("p_shop_id" "uuid", "p_date" "date") RETURNS TABLE("staff_id" "uuid", "starts_at" timestamp with time zone, "ends_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH shop_bounds AS (
    SELECT sh.timezone, b.starts_at AS day_start, b.ends_at AS day_end
    FROM public.shops sh
    CROSS JOIN LATERAL public.schedule_day_bounds(p_date, sh.timezone) b
    WHERE sh.id = p_shop_id
  )
  SELECT a.staff_id, a.starts_at, a.ends_at
  FROM public.appointments a
  JOIN public.staff s ON s.id = a.staff_id
  CROSS JOIN shop_bounds b
  WHERE s.shop_id = p_shop_id
    AND s.is_active = true
    AND a.status <> 'cancelled'
    AND a.starts_at < b.day_end
    AND a.ends_at > b.day_start

  UNION ALL

  SELECT bl.staff_id, bl.starts_at, bl.ends_at
  FROM public.blocks bl
  JOIN public.staff s ON s.id = bl.staff_id
  CROSS JOIN shop_bounds b
  WHERE s.shop_id = p_shop_id
    AND s.is_active = true
    AND bl.starts_at < b.day_end
    AND bl.ends_at > b.day_start

  UNION ALL

  SELECT ss.staff_id, b.day_start, b.day_end
  FROM public.staff_schedules ss
  JOIN public.staff s ON s.id = ss.staff_id
  CROSS JOIN shop_bounds b
  WHERE s.shop_id = p_shop_id
    AND s.is_active = true
    AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
    AND ss.is_working = false

  UNION ALL

  SELECT
    ss.staff_id,
    (p_date + ss.break_start)::timestamp AT TIME ZONE b.timezone,
    (p_date + ss.break_end)::timestamp AT TIME ZONE b.timezone
  FROM public.staff_schedules ss
  JOIN public.staff s ON s.id = ss.staff_id
  CROSS JOIN shop_bounds b
  WHERE s.shop_id = p_shop_id
    AND s.is_active = true
    AND ss.day_of_week = EXTRACT(DOW FROM p_date)::int
    AND ss.is_working = true
    AND ss.break_start IS NOT NULL
    AND ss.break_end IS NOT NULL;
$$;


ALTER FUNCTION "public"."get_shop_occupied_ranges"("p_shop_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_commission_configs"("p_shop_id" "uuid") RETURNS TABLE("staff_id" "uuid", "commission_type" "text", "commission_rate_bps" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_staff_commission_configs"("p_shop_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_day_hours"("p_staff_id" "uuid", "p_date" "date") RETURNS TABLE("is_working" boolean, "work_start" time without time zone, "work_end" time without time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT is_working, work_start, work_end
  FROM public.staff_schedules
  WHERE staff_id    = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_date)::int
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_staff_day_hours"("p_staff_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_direct_appointment_scheduling_writes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."prevent_direct_appointment_scheduling_writes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_day_bounds"("p_date" "date", "p_timezone" "text", OUT "starts_at" timestamp with time zone, OUT "ends_at" timestamp with time zone) RETURNS "record"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p_date::timestamp AT TIME ZONE p_timezone,
    (p_date + 1)::timestamp AT TIME ZONE p_timezone;
$$;


ALTER FUNCTION "public"."schedule_day_bounds"("p_date" "date", "p_timezone" "text", OUT "starts_at" timestamp with time zone, OUT "ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_has_conflict"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_ignore_appointment_id" "uuid" DEFAULT NULL::"uuid", "p_ignore_block_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH staff_ctx AS (
    SELECT
      s.id                                                      AS staff_id,
      sh.timezone,
      (p_starts_at AT TIME ZONE sh.timezone)::date             AS local_date
    FROM public.staff s
    JOIN public.shops sh ON sh.id = s.shop_id
    WHERE s.id = p_staff_id
  ),
  -- Tek staff_schedules taraması: kapalı gün ve mola aralıklarını birlikte üretir.
  schedule_ranges AS (
    SELECT
      CASE
        WHEN ss.is_working = false THEN b.starts_at
        ELSE (sc.local_date + ss.break_start)::timestamp AT TIME ZONE sc.timezone
      END AS starts_at,
      CASE
        WHEN ss.is_working = false THEN b.ends_at
        ELSE (sc.local_date + ss.break_end)::timestamp AT TIME ZONE sc.timezone
      END AS ends_at
    FROM public.staff_schedules ss
    JOIN  staff_ctx sc ON sc.staff_id = ss.staff_id
    LEFT JOIN LATERAL public.schedule_day_bounds(sc.local_date, sc.timezone) b ON true
    WHERE ss.day_of_week = EXTRACT(DOW FROM sc.local_date)::int
      AND (
        ss.is_working = false
        OR (
          ss.is_working = true
          AND ss.break_start IS NOT NULL
          AND ss.break_end   IS NOT NULL
        )
      )
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.staff_id = p_staff_id
      AND a.status  <> 'cancelled'
      AND (p_ignore_appointment_id IS NULL OR a.id <> p_ignore_appointment_id)
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  )
  OR EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE b.staff_id = p_staff_id
      AND (p_ignore_block_id IS NULL OR b.id <> p_ignore_block_id)
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  )
  OR EXISTS (
    SELECT 1
    FROM schedule_ranges r
    WHERE tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  );
$$;


ALTER FUNCTION "public"."schedule_has_conflict"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_ignore_appointment_id" "uuid", "p_ignore_block_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT trim(both '-' from
    regexp_replace(
      lower(translate(
        p_text,
        'çğıöşüÇĞİÖŞÜ',
        'cgiosuCGIOSU'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  )
$$;


ALTER FUNCTION "public"."slugify"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_is_inside_work_window"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH ctx AS (
    SELECT
      s.id AS staff_id,
      sh.timezone,
      sh.working_hours,
      (p_starts_at AT TIME ZONE sh.timezone)::date AS local_date,
      EXTRACT(DOW FROM p_starts_at AT TIME ZONE sh.timezone)::int AS dow
    FROM public.staff s
    JOIN public.shops sh ON sh.id = s.shop_id
    WHERE s.id = p_staff_id
  ),
  day_ctx AS (
    SELECT
      ctx.*,
      CASE ctx.dow
        WHEN 0 THEN 'sun'
        WHEN 1 THEN 'mon'
        WHEN 2 THEN 'tue'
        WHEN 3 THEN 'wed'
        WHEN 4 THEN 'thu'
        WHEN 5 THEN 'fri'
        WHEN 6 THEN 'sat'
      END AS wh_key
    FROM ctx
  ),
  schedule AS (
    SELECT
      dc.timezone,
      dc.local_date,
      COALESCE(ss.is_working, ((dc.working_hours -> dc.wh_key ->> 'enabled')::boolean), false) AS is_working,
      COALESCE(ss.work_start, (dc.working_hours -> dc.wh_key ->> 'open')::time) AS work_start,
      COALESCE(ss.work_end, (dc.working_hours -> dc.wh_key ->> 'close')::time) AS work_end
    FROM day_ctx dc
    LEFT JOIN public.staff_schedules ss
      ON ss.staff_id = dc.staff_id
     AND ss.day_of_week = EXTRACT(DOW FROM dc.local_date)::int
  )
  SELECT COALESCE(bool_and(
    is_working
    AND work_start IS NOT NULL
    AND work_end IS NOT NULL
    AND p_starts_at >= ((local_date + work_start)::timestamp AT TIME ZONE timezone)
    AND p_ends_at <= ((local_date + work_end)::timestamp AT TIME ZONE timezone)
  ), false)
  FROM schedule;
$$;


ALTER FUNCTION "public"."staff_is_inside_work_window"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_appointment_slots"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.appointment_slots WHERE appointment_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (NEW.status = 'confirmed') THEN
    INSERT INTO public.appointment_slots (appointment_id, staff_id, starts_at, ends_at)
    VALUES (NEW.id, NEW.staff_id, NEW.starts_at, NEW.ends_at)
    ON CONFLICT (appointment_id) DO UPDATE
      SET staff_id  = EXCLUDED.staff_id,
          starts_at = EXCLUDED.starts_at,
          ends_at   = EXCLUDED.ends_at;
  ELSE
    DELETE FROM public.appointment_slots WHERE appointment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_appointment_slots"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_block_slots"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.block_slots (block_id, staff_id, starts_at, ends_at)
    VALUES (NEW.id, NEW.staff_id, NEW.starts_at, NEW.ends_at)
    ON CONFLICT (block_id) DO UPDATE SET
      staff_id = EXCLUDED.staff_id,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.block_slots
       SET staff_id = NEW.staff_id,
           starts_at = NEW.starts_at,
           ends_at = NEW.ends_at
     WHERE block_id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.block_slots WHERE block_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_block_slots"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_appointment_atomic"("p_appointment_id" "uuid", "p_staff_id" "uuid", "p_service_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text" DEFAULT NULL::"text", "p_customer_notes" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  PERFORM pg_advisory_xact_lock(('x' || md5(p_staff_id::text))::bit(64)::bigint);

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


ALTER FUNCTION "public"."update_appointment_atomic"("p_appointment_id" "uuid", "p_staff_id" "uuid", "p_service_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_commission_config"("p_staff_id" "uuid", "p_commission_type" "text", "p_commission_rate_bps" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_staff_commission_config"("p_staff_id" "uuid", "p_commission_type" "text", "p_commission_rate_bps" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "public"."appointment_slots" (
    "appointment_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."appointment_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_user_id" "uuid",
    "customer_notes" "text",
    "final_price_cents" integer,
    "completed_price_cents" integer,
    "completed_commission_type" "text",
    "completed_commission_rate_bps" integer,
    "completed_commission_cents" integer,
    "completed_shop_share_cents" integer,
    "completed_at" timestamp with time zone,
    "booked_price_cents" integer,
    CONSTRAINT "appointments_booked_price_cents_check" CHECK ((("booked_price_cents" IS NULL) OR ("booked_price_cents" >= 0))),
    CONSTRAINT "appointments_check" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "appointments_completed_commission_cents_check" CHECK ((("completed_commission_cents" IS NULL) OR ("completed_commission_cents" >= 0))),
    CONSTRAINT "appointments_completed_commission_rate_bps_check" CHECK ((("completed_commission_rate_bps" IS NULL) OR (("completed_commission_rate_bps" >= 0) AND ("completed_commission_rate_bps" <= 10000)))),
    CONSTRAINT "appointments_completed_commission_type_check" CHECK ((("completed_commission_type" IS NULL) OR ("completed_commission_type" = ANY (ARRAY['none'::"text", 'percentage'::"text"])))),
    CONSTRAINT "appointments_completed_price_cents_check" CHECK ((("completed_price_cents" IS NULL) OR ("completed_price_cents" >= 0))),
    CONSTRAINT "appointments_completed_shop_share_cents_check" CHECK ((("completed_shop_share_cents" IS NULL) OR ("completed_shop_share_cents" >= 0))),
    CONSTRAINT "appointments_customer_name_check" CHECK (("char_length"("customer_name") >= 2)),
    CONSTRAINT "appointments_final_price_cents_check" CHECK ((("final_price_cents" IS NULL) OR ("final_price_cents" >= 0))),
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['confirmed'::"text", 'cancelled'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."appointments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."block_slots" (
    "block_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."block_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "reason" "text" DEFAULT 'walkin'::"text" NOT NULL,
    "created_via" "text" DEFAULT 'app'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocks_check" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "blocks_created_via_check" CHECK (("created_via" = ANY (ARRAY['widget'::"text", 'app'::"text", 'web'::"text"]))),
    CONSTRAINT "blocks_reason_check" CHECK (("reason" = ANY (ARRAY['walkin'::"text", 'break'::"text", 'personal'::"text"])))
);

ALTER TABLE ONLY "public"."blocks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "duration_min" integer NOT NULL,
    "price_cents" integer,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "services_duration_min_check" CHECK ((("duration_min" > 0) AND ("duration_min" <= 480))),
    CONSTRAINT "services_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "timezone" "text" DEFAULT 'Europe/Istanbul'::"text" NOT NULL,
    "working_hours" "jsonb" DEFAULT "jsonb_build_object"('mon', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', true), 'tue', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', true), 'wed', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', true), 'thu', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', true), 'fri', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', true), 'sat', "jsonb_build_object"('open', '10:00', 'close', '17:00', 'enabled', true), 'sun', "jsonb_build_object"('open', '09:00', 'close', '19:00', 'enabled', false)) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_id" "uuid",
    "name" "text",
    "address" "text",
    "commission_enabled" boolean DEFAULT false NOT NULL,
    "phone" "text"
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "role" "public"."staff_role" DEFAULT 'staff'::"public"."staff_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commission_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "commission_rate_bps" integer,
    "slug" "text",
    "email" "text",
    "push_token" "text",
    CONSTRAINT "staff_commission_rate_bps_check" CHECK ((("commission_rate_bps" IS NULL) OR (("commission_rate_bps" >= 0) AND ("commission_rate_bps" <= 10000)))),
    CONSTRAINT "staff_commission_type_check" CHECK (("commission_type" = ANY (ARRAY['none'::"text", 'percentage'::"text"])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff"."push_token" IS 'Expo push notification token. ExponentPushToken[...] formatında.';



CREATE TABLE IF NOT EXISTS "public"."staff_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_working" boolean DEFAULT true NOT NULL,
    "work_start" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "work_end" time without time zone DEFAULT '19:00:00'::time without time zone NOT NULL,
    "break_start" time without time zone,
    "break_end" time without time zone,
    CONSTRAINT "break_order" CHECK (((("break_start" IS NULL) AND ("break_end" IS NULL)) OR (("break_start" IS NOT NULL) AND ("break_end" IS NOT NULL) AND ("break_start" < "break_end")))),
    CONSTRAINT "staff_schedules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "work_order" CHECK (("work_start" < "work_end"))
);


ALTER TABLE "public"."staff_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shop_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "label" "text" DEFAULT 'Widget'::"text" NOT NULL,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."widget_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_pkey" PRIMARY KEY ("appointment_id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING "gist" ("staff_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&) WHERE (("status" <> 'cancelled'::"text"));



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."block_slots"
    ADD CONSTRAINT "block_slots_pkey" PRIMARY KEY ("block_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_no_overlap" EXCLUDE USING "gist" ("staff_id" WITH =, "tstzrange"("starts_at", "ends_at", '[)'::"text") WITH &&);



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_day_of_week_key" UNIQUE ("staff_id", "day_of_week");



ALTER TABLE ONLY "public"."widget_tokens"
    ADD CONSTRAINT "widget_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_tokens"
    ADD CONSTRAINT "widget_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "idx_users_created_at_desc" ON "auth"."users" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_users_email" ON "auth"."users" USING "btree" ("email");



CREATE INDEX "idx_users_last_sign_in_at_desc" ON "auth"."users" USING "btree" ("last_sign_in_at" DESC);



CREATE INDEX "idx_users_name" ON "auth"."users" USING "btree" ((("raw_user_meta_data" ->> 'name'::"text"))) WHERE (("raw_user_meta_data" ->> 'name'::"text") IS NOT NULL);



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "appointments_customer_phone_created_at_idx" ON "public"."appointments" USING "btree" ("customer_phone", "created_at") WHERE ("customer_phone" IS NOT NULL);



CREATE INDEX "appointments_service_id_idx" ON "public"."appointments" USING "btree" ("service_id");



CREATE INDEX "idx_appointment_slots_barber" ON "public"."appointment_slots" USING "btree" ("staff_id");



CREATE INDEX "idx_appointments_barber_starts" ON "public"."appointments" USING "btree" ("staff_id", "starts_at");



CREATE INDEX "idx_appointments_barber_status" ON "public"."appointments" USING "btree" ("staff_id", "status");



CREATE INDEX "idx_appointments_customer" ON "public"."appointments" USING "btree" ("customer_user_id");



CREATE INDEX "idx_appointments_staff_completed_at" ON "public"."appointments" USING "btree" ("staff_id", "completed_at") WHERE ("status" = 'completed'::"text");



CREATE INDEX "idx_block_slots_staff" ON "public"."block_slots" USING "btree" ("staff_id");



CREATE INDEX "idx_blocks_barber_starts" ON "public"."blocks" USING "btree" ("staff_id", "starts_at");



CREATE INDEX "idx_services_shop_active" ON "public"."services" USING "btree" ("shop_id", "is_active");



CREATE INDEX "idx_services_shop_order" ON "public"."services" USING "btree" ("shop_id", "display_order");



CREATE INDEX "idx_shops_owner" ON "public"."shops" USING "btree" ("owner_user_id");



CREATE INDEX "idx_shops_slug" ON "public"."shops" USING "btree" ("slug");



CREATE INDEX "idx_widget_tokens_hash" ON "public"."widget_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_widget_tokens_shop" ON "public"."widget_tokens" USING "btree" ("shop_id");



CREATE INDEX "shops_owner_id_idx" ON "public"."shops" USING "btree" ("owner_id");



CREATE UNIQUE INDEX "shops_owner_user_id_unique_idx" ON "public"."shops" USING "btree" ("owner_user_id") WHERE ("owner_user_id" IS NOT NULL);



CREATE INDEX "staff_schedules_staff_day_idx" ON "public"."staff_schedules" USING "btree" ("staff_id", "day_of_week");



CREATE UNIQUE INDEX "staff_shop_slug_uniq" ON "public"."staff" USING "btree" ("shop_id", "slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "staff_user_id_idx" ON "public"."staff" USING "btree" ("user_id");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE OR REPLACE TRIGGER "appointments_prevent_direct_scheduling_writes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_direct_appointment_scheduling_writes"();



CREATE OR REPLACE TRIGGER "appointments_sync_slots" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_appointment_slots"();



CREATE OR REPLACE TRIGGER "blocks_sync_slots" AFTER INSERT OR DELETE OR UPDATE ON "public"."blocks" FOR EACH ROW EXECUTE FUNCTION "public"."sync_block_slots"();



CREATE OR REPLACE TRIGGER "shops_ensure_owner_staff" AFTER INSERT OR UPDATE OF "owner_user_id", "owner_id", "display_name", "name" ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_owner_staff"();



CREATE OR REPLACE TRIGGER "shops_updated_at" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_slots"
    ADD CONSTRAINT "appointment_slots_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_slots"
    ADD CONSTRAINT "block_slots_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."block_slots"
    ADD CONSTRAINT "block_slots_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedules"
    ADD CONSTRAINT "staff_schedules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."widget_tokens"
    ADD CONSTRAINT "widget_tokens_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointment_slots_public_read" ON "public"."appointment_slots" FOR SELECT USING (true);



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_scheduling_select" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("customer_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "appointments_scheduling_update" ON "public"."appointments" FOR UPDATE TO "authenticated" USING (((("customer_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'confirmed'::"text") AND ("starts_at" > "now"())) OR ("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((("customer_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'cancelled'::"text")) OR ("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."block_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "block_slots_public_read" ON "public"."block_slots" FOR SELECT USING (true);



ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blocks_scheduling_select" ON "public"."blocks" FOR SELECT TO "authenticated" USING (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_public_or_owner_select" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "services_shop_owner_delete" ON "public"."services" FOR DELETE TO "authenticated" USING (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "services_shop_owner_insert" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "services_shop_owner_update" ON "public"."services" FOR UPDATE TO "authenticated" USING (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shops_owner_delete" ON "public"."shops" FOR DELETE TO "authenticated" USING ((("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("owner_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "shops_owner_insert" ON "public"."shops" FOR INSERT TO "authenticated" WITH CHECK (("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "shops_owner_update" ON "public"."shops" FOR UPDATE TO "authenticated" USING ((("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("owner_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("owner_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "shops_public_read" ON "public"."shops" FOR SELECT USING (true);



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_schedules_scheduling_delete" ON "public"."staff_schedules" FOR DELETE TO "authenticated" USING (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_schedules_scheduling_insert" ON "public"."staff_schedules" FOR INSERT TO "authenticated" WITH CHECK (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_schedules_scheduling_select" ON "public"."staff_schedules" FOR SELECT TO "authenticated", "anon" USING (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     LEFT JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."is_active" = true) OR ("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_schedules_scheduling_update" ON "public"."staff_schedules" FOR UPDATE TO "authenticated" USING (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (("staff_id" IN ( SELECT "st"."id"
   FROM ("public"."staff" "st"
     JOIN "public"."shops" "sh" ON (("sh"."id" = "st"."shop_id")))
  WHERE (("st"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_scheduling_delete" ON "public"."staff" FOR DELETE TO "authenticated" USING (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_scheduling_insert" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "staff_scheduling_select" ON "public"."staff" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "staff_scheduling_update" ON "public"."staff" FOR UPDATE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."widget_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "widget_tokens_shop_owner_delete" ON "public"."widget_tokens" FOR DELETE TO "authenticated" USING (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "widget_tokens_shop_owner_insert" ON "public"."widget_tokens" FOR INSERT TO "authenticated" WITH CHECK (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "widget_tokens_shop_owner_select" ON "public"."widget_tokens" FOR SELECT TO "authenticated" USING (("shop_id" IN ( SELECT "sh"."id"
   FROM "public"."shops" "sh"
  WHERE (("sh"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("sh"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "public"."assign_any_staff"("p_shop_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_any_staff"("p_shop_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_appointment_atomic"("p_appointment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_appointment_atomic"("p_appointment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_appointment_atomic"("p_appointment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."complete_appointment_with_revenue"("p_appointment_id" "uuid", "p_final_price_cents" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_appointment_with_revenue"("p_appointment_id" "uuid", "p_final_price_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_appointment_with_revenue"("p_appointment_id" "uuid", "p_final_price_cents" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_appointment_atomic"("p_shop_slug" "text", "p_shop_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text", "p_customer_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_appointment_atomic"("p_shop_slug" "text", "p_shop_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text", "p_customer_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment_atomic"("p_shop_slug" "text", "p_shop_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text", "p_customer_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_block_atomic"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_reason" "text", "p_created_via" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_block_atomic"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_reason" "text", "p_created_via" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_owner_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_owner_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_owner_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_commission_report"("p_shop_id" "uuid", "p_from" "date", "p_to" "date", "p_staff_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_commission_report"("p_shop_id" "uuid", "p_from" "date", "p_to" "date", "p_staff_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_commission_report"("p_shop_id" "uuid", "p_from" "date", "p_to" "date", "p_staff_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_occupied_ranges"("p_staff_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_occupied_ranges"("p_staff_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_appointments_revenue"("p_shop_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_staff_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_dashboard_stats"("p_shop_id" "uuid", "p_today" "date", "p_staff_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_dashboard_stats"("p_shop_id" "uuid", "p_today" "date", "p_staff_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_dashboard_stats"("p_shop_id" "uuid", "p_today" "date", "p_staff_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shop_occupied_ranges"("p_shop_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shop_occupied_ranges"("p_shop_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shop_occupied_ranges"("p_shop_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_commission_configs"("p_shop_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_commission_configs"("p_shop_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_commission_configs"("p_shop_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_staff_day_hours"("p_staff_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_staff_day_hours"("p_staff_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_direct_appointment_scheduling_writes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_direct_appointment_scheduling_writes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_day_bounds"("p_date" "date", "p_timezone" "text", OUT "starts_at" timestamp with time zone, OUT "ends_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_day_bounds"("p_date" "date", "p_timezone" "text", OUT "starts_at" timestamp with time zone, OUT "ends_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_day_bounds"("p_date" "date", "p_timezone" "text", OUT "starts_at" timestamp with time zone, OUT "ends_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_has_conflict"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_ignore_appointment_id" "uuid", "p_ignore_block_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_has_conflict"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_ignore_appointment_id" "uuid", "p_ignore_block_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify"("p_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify"("p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify"("p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_is_inside_work_window"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_is_inside_work_window"("p_staff_id" "uuid", "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_appointment_slots"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_appointment_slots"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_block_slots"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_block_slots"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_appointment_atomic"("p_appointment_id" "uuid", "p_staff_id" "uuid", "p_service_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_appointment_atomic"("p_appointment_id" "uuid", "p_staff_id" "uuid", "p_service_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_appointment_atomic"("p_appointment_id" "uuid", "p_staff_id" "uuid", "p_service_id" "uuid", "p_starts_at" timestamp with time zone, "p_customer_name" "text", "p_customer_phone" "text", "p_customer_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff_commission_config"("p_staff_id" "uuid", "p_commission_type" "text", "p_commission_rate_bps" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff_commission_config"("p_staff_id" "uuid", "p_commission_type" "text", "p_commission_rate_bps" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff_commission_config"("p_staff_id" "uuid", "p_commission_type" "text", "p_commission_rate_bps" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



GRANT ALL ON TABLE "public"."appointment_slots" TO "anon";
GRANT ALL ON TABLE "public"."appointment_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_slots" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."appointments" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("staff_id") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("service_id") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("customer_name") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("customer_phone") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("starts_at") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("ends_at") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("notes") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("customer_user_id") ON TABLE "public"."appointments" TO "authenticated";



GRANT SELECT("customer_notes") ON TABLE "public"."appointments" TO "authenticated";



GRANT ALL ON TABLE "public"."block_slots" TO "anon";
GRANT ALL ON TABLE "public"."block_slots" TO "authenticated";
GRANT ALL ON TABLE "public"."block_slots" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."shops" TO "anon";
GRANT ALL ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."staff" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("id") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("shop_id") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("shop_id") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("user_id") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("name") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("role") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("is_active") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("is_active") ON TABLE "public"."staff" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."staff" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."staff" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_schedules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."widget_tokens" TO "anon";
GRANT ALL ON TABLE "public"."widget_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_tokens" TO "service_role";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";




