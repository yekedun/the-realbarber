-- Owner summary and earnings screens read completed appointment revenue
-- snapshots. Row visibility is still controlled by appointments RLS; this only
-- grants column-level SELECT privileges that were revoked in commission
-- hardening.

GRANT SELECT (
  completed_price_cents,
  completed_commission_cents,
  completed_shop_share_cents
) ON public.appointments TO authenticated;
