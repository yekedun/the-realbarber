-- ============================================================
-- staff_schedules: Personel bazlı haftalık çalışma saatleri
-- day_of_week: 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id      uuid        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week   int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working    boolean     NOT NULL DEFAULT true,
  work_start    time        NOT NULL DEFAULT '09:00',
  work_end      time        NOT NULL DEFAULT '19:00',
  break_start   time        NULL,
  break_end     time        NULL,
  -- Mola tanımlıysa başlangıç < bitiş zorunlu
  CONSTRAINT break_order CHECK (
    (break_start IS NULL AND break_end IS NULL)
    OR (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start < break_end)
  ),
  -- Çalışma saatleri tutarlı olmalı
  CONSTRAINT work_order CHECK (work_start < work_end),
  -- Aynı personel için aynı gün tek kayıt
  UNIQUE (staff_id, day_of_week)
);

-- İndeks: staff_id + day_of_week sorguları için
CREATE INDEX IF NOT EXISTS staff_schedules_staff_day_idx
  ON public.staff_schedules (staff_id, day_of_week);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

-- Dükkan sahibi: dükkana ait tüm personelin saatlerini okuyup yazabilir
CREATE POLICY "owner_manage_schedules" ON public.staff_schedules
FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM public.staff s
    JOIN public.shops sh ON sh.id = s.shop_id
    WHERE sh.owner_id = auth.uid()
  )
);

-- Personelin kendisi: kendi çalışma saatlerini okuyup düzenleyebilir
CREATE POLICY "staff_own_schedule" ON public.staff_schedules
FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE user_id = auth.uid()
  )
);

-- Anon/müşteri: sadece okuyabilir (müsaitlik hesaplaması için)
CREATE POLICY "anon_read_schedules" ON public.staff_schedules
FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE is_active = true
  )
);

-- ── get_occupied_ranges güncelleme ───────────────────────────────────────────
-- Mola saatlerini de "dolu" aralık olarak ekler; böylece
-- computeAvailableSlots() mola saatlerini otomatik kapalı gösterir.

DROP FUNCTION IF EXISTS public.get_occupied_ranges(uuid, date);

CREATE OR REPLACE FUNCTION public.get_occupied_ranges(
  p_staff_id uuid,
  p_date     date
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  -- 1. Onaylanmış randevular
  SELECT starts_at, ends_at
  FROM public.appointments
  WHERE staff_id = p_staff_id
    AND status   = 'confirmed'
    AND starts_at >= p_date::timestamptz
    AND starts_at <  (p_date + 1)::timestamptz

  UNION ALL

  -- 2. Bloklar (walk-in, mola vb.)
  SELECT starts_at, ends_at
  FROM public.blocks
  WHERE staff_id = p_staff_id
    AND starts_at >= p_date::timestamptz
    AND starts_at <  (p_date + 1)::timestamptz

  UNION ALL

  -- 3. Personel o gün çalışmıyorsa tüm günü dolu say
  --    (is_working = false → 00:00–24:00 bloğu)
  SELECT
    p_date::timestamptz                     AS starts_at,
    (p_date + 1)::timestamptz              AS ends_at
  FROM public.staff_schedules
  WHERE staff_id    = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_date)::int
    AND is_working  = false

  UNION ALL

  -- 4. Mola saatleri → break_start/break_end aralığını dolu say
  SELECT
    (p_date + break_start)::timestamptz   AS starts_at,
    (p_date + break_end)::timestamptz     AS ends_at
  FROM public.staff_schedules
  WHERE staff_id    = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_date)::int
    AND is_working  = true
    AND break_start IS NOT NULL
    AND break_end   IS NOT NULL

  ORDER BY starts_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_occupied_ranges(uuid, date) TO anon, authenticated;

-- ── get_staff_day_hours: Yeni yardımcı fonksiyon ─────────────────────────────
-- Edge function'ın çalışma penceresi bilgisini çekmesi için
-- (work_start, work_end, is_working) döner. Kayıt yoksa NULL döner.

CREATE OR REPLACE FUNCTION public.get_staff_day_hours(
  p_staff_id  uuid,
  p_date      date
)
RETURNS TABLE (
  is_working  boolean,
  work_start  time,
  work_end    time
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT is_working, work_start, work_end
  FROM public.staff_schedules
  WHERE staff_id    = p_staff_id
    AND day_of_week = EXTRACT(DOW FROM p_date)::int
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_day_hours(uuid, date) TO anon, authenticated;
