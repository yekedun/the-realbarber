-- Create invite_tokens table for barber invitations
CREATE TABLE IF NOT EXISTS invite_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX idx_invite_tokens_shop  ON invite_tokens(shop_id);
CREATE INDEX idx_invite_tokens_expires_at ON invite_tokens(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS staff_shop_user_unique_idx
  ON public.staff(shop_id, user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Shop owner can select their own tokens
CREATE POLICY "owner_select_own_tokens" ON invite_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = invite_tokens.shop_id
        AND (shops.owner_user_id = auth.uid() OR shops.owner_id = auth.uid())
    )
  );

-- Invite links contain unguessable UUID tokens. Allow invitees to pre-validate
-- unused, unexpired links from the mobile app before they authenticate.
CREATE POLICY "anyone_select_unused_tokens" ON invite_tokens
  FOR SELECT
  TO anon, authenticated
  USING (used_at IS NULL AND expires_at > NOW());

-- Shop owner can create tokens for their shop
CREATE POLICY "owner_insert_tokens" ON invite_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = invite_tokens.shop_id
        AND (shops.owner_user_id = auth.uid() OR shops.owner_id = auth.uid())
    )
  );
