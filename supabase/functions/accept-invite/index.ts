import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

function toSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[çÇ]/g, "c").replace(/[ğĞ]/g, "g").replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o").replace(/[şŞ]/g, "s").replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Authorization header eksik", 401);

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) return error("Kimlik doğrulama başarısız", 401);

  const admin = createAdminClient();

  let body: { token: string };
  try { body = await req.json(); } catch { return error("Geçersiz JSON"); }

  const { token } = body;
  if (!token) return error("Token zorunlu");

  const { data: inviteRow } = await admin
    .from("invite_tokens")
    .select("id, shop_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!inviteRow) return error("Geçersiz token", 404);
  if (inviteRow.used_at) return error("Token zaten kullanılmış", 409);
  if (new Date(inviteRow.expires_at) < new Date()) return error("Token süresi dolmuş", 410);

  const { data: existing } = await admin.from("staff")
    .select("id").eq("user_id", user.id).eq("shop_id", inviteRow.shop_id).maybeSingle();
  if (existing) return json({ staff: existing }, 200);

  await admin.from("invite_tokens")
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq("id", inviteRow.id);

  const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "berber";
  const baseSlug = toSlug(name) || user.id.slice(0, 8);
  let slug = baseSlug; let suffix = 2;
  while (true) {
    const { data: s } = await admin.from("staff").select("id")
      .eq("shop_id", inviteRow.shop_id).eq("slug", slug).maybeSingle();
    if (!s) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data: staffMember, error: insertErr } = await admin.from("staff").insert({
    shop_id: inviteRow.shop_id,
    user_id: user.id,
    name,
    role: "staff",
    is_active: true,
    slug: slug || null,
  }).select("id, name").single();

  if (insertErr) return error("Staff kaydı oluşturulamadı: " + insertErr.message, 500);

  return json({ staff: staffMember }, 201);
});
