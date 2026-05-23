-- Fix: shops UPDATE ve DELETE policy'lerini hem owner_user_id hem owner_id için çalıştır.
-- Arka plan: migration 20260508 owner_id kolonunu ekledi ama bazı hesaplar bu kolona yazıldı.
-- RLS SELECT public_read olduğu için okuma zaten çalışıyor; yazma policy'leri güncelleniyor.

DROP POLICY IF EXISTS "shops_owner_update" ON public.shops;
DROP POLICY IF EXISTS "shops_owner_delete" ON public.shops;

CREATE POLICY "shops_owner_update" ON public.shops
FOR UPDATE TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR owner_id    = (SELECT auth.uid())
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  OR owner_id    = (SELECT auth.uid())
);

CREATE POLICY "shops_owner_delete" ON public.shops
FOR DELETE TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  OR owner_id    = (SELECT auth.uid())
);
