-- Add `phone` column to `public.shops`.
-- The mobile settings.tsx ProfileEditorSheet has had a Telefon field since
-- launch and the form selects/updates `shops.phone`, but the column was never
-- added — every owner hit "column shops.phone does not exist" (42703) on
-- shop load, leaving shopId null and the "Lütfen bekleyin. Dükkan bilgileri
-- yükleniyor." alert permanent.

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone text;
