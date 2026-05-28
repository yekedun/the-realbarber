-- user_id is an auth.users FK. Exposing it to any authenticated user enables
-- cross-shop auth ID enumeration. Internal operations (admin panel, edge functions)
-- use service_role and do not need this column in the client grant.
REVOKE SELECT (user_id) ON public.staff FROM authenticated;
