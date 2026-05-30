-- Final-state lock down for mirror slot tables.
-- They exist for trigger-maintained scheduling invalidation and must not be
-- directly readable by anon clients across all shops.

DROP POLICY IF EXISTS "appointment_slots_public_read" ON public.appointment_slots;
DROP POLICY IF EXISTS "block_slots_public_read" ON public.block_slots;

DROP POLICY IF EXISTS "appointment_slots_staff_or_owner_read" ON public.appointment_slots;
CREATE POLICY "appointment_slots_staff_or_owner_read"
ON public.appointment_slots
FOR SELECT TO authenticated
USING (
  staff_id IN (
    SELECT st.id
    FROM public.staff st
    JOIN public.shops sh ON sh.id = st.shop_id
    WHERE st.user_id = (SELECT auth.uid())
       OR sh.owner_user_id = (SELECT auth.uid())
       OR sh.owner_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "block_slots_staff_or_owner_read" ON public.block_slots;
CREATE POLICY "block_slots_staff_or_owner_read"
ON public.block_slots
FOR SELECT TO authenticated
USING (
  staff_id IN (
    SELECT st.id
    FROM public.staff st
    JOIN public.shops sh ON sh.id = st.shop_id
    WHERE st.user_id = (SELECT auth.uid())
       OR sh.owner_user_id = (SELECT auth.uid())
       OR sh.owner_id = (SELECT auth.uid())
  )
);
