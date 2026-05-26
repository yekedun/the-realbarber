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
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return error("Kimlik doğrulama başarısız", 401);

  const admin = createAdminClient();

  const { data: existing } = await admin.from("shops")
    .select("id").or(`owner_user_id.eq.${user.id},owner_id.eq.${user.id}`)
    .maybeSingle();
  if (existing) return error("Bu hesaba zaten dükkan bağlı", 409);

  let body: { shop_name: string; phone: string };
  try {
    body = await req.json();
  } catch {
    return error("Geçersiz JSON");
  }

  const { shop_name, phone } = body;
  if (!shop_name?.trim()) return error("Dükkan adı zorunlu");
  if (!phone?.trim()) return error("Telefon zorunlu");

  const baseSlug = toSlug(shop_name.trim()) || user.id.slice(0, 8);
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: s } = await admin.from("shops").select("id").eq("slug", slug).maybeSingle();
    if (!s) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  let shop: { id: string; slug: string; status: string } | null = null;
  let insertErr: { code?: string; message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await admin.from("shops").insert({
      name: shop_name.trim(),
      slug,
      owner_user_id: user.id,
      status: "pending",
    }).select("id, slug, status").single();
    shop = result.data;
    insertErr = result.error;
    if (!insertErr) break;
    if (insertErr.code !== "23505") break;
    slug = `${baseSlug}-${suffix++}`;
  }

  if (insertErr || !shop) {
    return error("Dükkan oluşturulamadı: " + (insertErr?.message ?? "bilinmeyen hata"), 500);
  }

  const ownerName = user.user_metadata?.full_name ?? shop_name.trim();
  const ownerSlug = toSlug(ownerName);
  const { data: ownerStaff, error: updateStaffErr } = await admin
    .from("staff")
    .update({
      name: ownerName,
      phone: phone.trim(),
      role: "admin",
      is_active: true,
      slug: ownerSlug || null,
    })
    .eq("shop_id", shop.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateStaffErr) {
    await admin.from("shops").delete().eq("id", shop.id);
    return error("Dükkan sahibi personel kaydı güncellenemedi: " + updateStaffErr.message, 500);
  }

  const { error: staffErr } = ownerStaff
    ? { error: null }
    : await admin.from("staff").insert({
      shop_id: shop.id,
      user_id: user.id,
      name: ownerName,
      phone: phone.trim(),
      role: "admin",
      is_active: true,
      slug: ownerSlug || null,
    });
  if (staffErr) {
    await admin.from("shops").delete().eq("id", shop.id);
    return error("Dükkan sahibi personel kaydı oluşturulamadı: " + staffErr.message, 500);
  }

  const adminToken = Deno.env.get("ADMIN_EXPO_PUSH_TOKEN");
  if (adminToken) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: adminToken,
        title: "Yeni Dükkan Başvurusu",
        body: `${shop_name.trim()} - onay bekliyor`,
        data: { type: "new_shop", shopId: shop.id },
      }),
    }).catch(() => {});
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "emreyek29@gmail.com";
  const fromEmail = Deno.env.get("SYSTEM_FROM_EMAIL") ?? "sistem@siradaki.app";
  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: adminEmail,
        subject: `Yeni başvuru: ${shop_name.trim()}`,
        html: `<p><b>${shop_name.trim()}</b> dükkanı onay bekliyor.</p><p>Telefon: ${phone}</p><p>Slug: ${shop.slug}</p><p><a href="https://siradaki.app/admin">Admin panelini aç</a></p>`,
      }),
    }).catch(() => {});
  }

  return json({ shop }, 201);
});
