import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

function isMissingStatusColumnError(err: { code?: string; message?: string } | null): boolean {
  return err?.code === "42703" || err?.message?.includes("shops.status") === true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Authorization header eksik", 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return error("Kimlik doğrulama başarısız", 401);

  const admin = createAdminClient();

  let { data: shop, error: shopErr } = await admin
    .from("shops")
    .select("id, status")
    .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
    .maybeSingle();
  if (isMissingStatusColumnError(shopErr)) {
    const fallback = await admin
      .from("shops")
      .select("id")
      .or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
      .maybeSingle();
    shop = fallback.data ? { ...fallback.data, status: "active" } : null;
    shopErr = fallback.error;
  }

  if (shopErr) return error("Dükkan bilgisi okunamadı: " + shopErr.message, 500);
  if (!shop) return error("Dükkan sahibi yetkisi gerekli", 403);
  if (shop.status !== "active") return error("Dükkan aktif olmadan davet oluşturulamaz", 403);

  const { data: tokenRow, error: tokenErr } = await admin
    .from("invite_tokens")
    .insert({ shop_id: shop.id, created_by: user.id })
    .select("token")
    .single();

  if (tokenErr) return error("Token oluşturulamadı: " + tokenErr.message, 500);

  const publicInviteBaseUrl = Deno.env.get("PUBLIC_INVITE_BASE_URL") ?? "https://siradaki.app/invite";
  const inviteLink = `${publicInviteBaseUrl.replace(/\/$/, "")}/${tokenRow.token}`;

  return json({ invite_link: inviteLink, token: tokenRow.token }, 201);
});
