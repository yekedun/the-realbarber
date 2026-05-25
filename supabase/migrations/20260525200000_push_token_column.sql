ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS push_token text;

COMMENT ON COLUMN public.staff.push_token IS
  'Expo push notification token. ExponentPushToken[...] formatında.';
