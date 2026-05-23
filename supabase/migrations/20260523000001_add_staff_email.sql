-- Personele iletişim e-postası ekle. user_id'den bağımsız — davet akışı değil.
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text;
