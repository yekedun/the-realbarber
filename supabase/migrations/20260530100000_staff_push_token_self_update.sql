-- Allow staff members to update their own push_token and notification_prefs.
-- The staff_self_update RLS policy was dropped in 20260514080010 and the
-- column-level UPDATE grant was never added, causing notifications.ts to
-- silently fail when saving Expo push tokens.

-- Column-level UPDATE grant (authenticated only touches these two cols)
GRANT UPDATE (push_token, notification_prefs) ON public.staff TO authenticated;

-- RLS: staff can only update their own row
CREATE POLICY "staff_self_update_token"
  ON public.staff
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
