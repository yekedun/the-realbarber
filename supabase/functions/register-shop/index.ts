import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

function toSlug(name: string): string {
  return name
    .toLowerCase()
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

  // Zaten bir dükkanı varsa engelle
  const { data: existing } = await admin.from("shops")
    .select("id").or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
    .maybeSingle();
  if (existing) return error("Bu hesaba zaten dükkan bağlı", 409);

  let body: { shop_name: string; phone: string };
  try { body = await req.json(); } catch { return error("Geçersiz JSON"); }

  const { shop_name, phone } = body;
  if (!shop_name?.trim()) return error("Dükkan adı zorunlu");
  if (!phone?.trim()) return error("Telefon zorunlu");

  // Slug çakışmasız üret
  const baseSlug = toSlug(shop_name.trim());
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: s } = await admin.from("shops").select("id").eq("slug", slug).maybeSingle();
    if (!s) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data: shop, error: insertErr } = await admin.from("shops").insert({
    name: shop_name.trim(),
    slug,
    owner_user_id: user.id,
    status: "pending",
  }).select("id, slug, status").single();

  if (insertErr) return error("Dükkan oluşturulamadı: " + insertErr.message, 500);

  // Sahibi staff tablosuna da ekle (kendisi de berber)
  const ownerSlug = toSlug(user.user_metadata?.full_name ?? shop_name.trim());
  await admin.from("staff").insert({
    shop_id: shop.id,
    user_id: user.id,
    name: user.user_metadata?.full_name ?? shop_name.trim(),
    phone: phone.trim(),
    role: "owner",
    is_active: true,
    slug: ownerSlug || null,
  });

  // Admin push bildirimi (token Supabase secret'ta)
  const adminToken = Deno.env.get("ADMIN_EXPO_PUSH_TOKEN");
  if (adminToken) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: adminToken,
        title: "Yeni Dükkan Başvurusu",
        body: `${shop_name.trim()} — onay bekliyor`,
        data: { type: "new_shop", shopId: shop.id },
      }),
    }).catch(() => {});
  }

  // Admin email (Resend — opsiyonel)
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "sistem@siradaki.app",
        to: "emreyek29@gmail.com",
        subject: `Yeni başvuru: ${shop_name.trim()}`,
        html: `<p><b>${shop_name.trim()}</b> dükkanı onay bekliyor.</p><p>Telefon: ${phone}</p><p>Slug: ${slug}</p><p><a href="https://siradaki.app/admin">Admin panelini aç →</a></p>`,
      }),
    }).catch(() => {});
  }

  return json({ shop }, 201);
});
