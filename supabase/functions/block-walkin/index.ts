import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient, sha256 } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

type LegacyBlockWalkinRequest = {
  staff_id?: string;
  barber_id?: string;
  duration_min: number;
  reason?: "walkin" | "break" | "personal";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  const rawToken = authHeader?.replace("Bearer ", "").trim();

  if (!rawToken) return error("Authorization header eksik", 401);

  const supabase = createAdminClient();
  const tokenHash = await sha256(rawToken);

  const { data: widgetToken } = await supabase
    .from("widget_tokens")
    .select("id, shop_id, expires_at, last_used_at")
    .eq("token_hash", tokenHash)
    .single();

  if (!widgetToken) return error("Gecersiz token", 401);
  if (widgetToken.expires_at && new Date(widgetToken.expires_at) < new Date()) {
    return error("Token suresi dolmus", 401);
  }
  // Per-token cooldown using already-fetched last_used_at (no extra DB round-trip).
  if (widgetToken.last_used_at) {
    const msSinceLastUse = Date.now() - new Date(widgetToken.last_used_at).getTime();
    if (msSinceLastUse < 2_000) {
      return error("Çok hızlı istek. Lütfen bir saniye bekleyin.", 429);
    }
  }

  let body: LegacyBlockWalkinRequest;
  try {
    body = await req.json();
  } catch {
    return error("Gecersiz JSON");
  }

  const { duration_min, reason = "walkin" } = body;
  let staff_id = body.staff_id ?? body.barber_id;

  if (!duration_min || duration_min < 5 || duration_min > 480) {
    return error("duration_min 5-480 dakika arasinda olmali");
  }

  if (!staff_id) {
    const { data: activeStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("shop_id", widgetToken.shop_id)
      .eq("is_active", true);

    if (!activeStaff || activeStaff.length === 0) return error("Aktif personel bulunamadi", 404);
    if (activeStaff.length > 1) return error("staff_id zorunlu", 400);
    staff_id = activeStaff[0]!.id;
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staff_id)
    .eq("shop_id", widgetToken.shop_id)
    .eq("is_active", true)
    .single();

  if (!staff) return error("Personel bu dukkana ait degil", 403);

  const now = new Date();
  const endsAt = new Date(now.getTime() + duration_min * 60_000);

  const { data: block, error: rpcError } = await supabase.rpc("create_block_atomic" as never, {
    p_staff_id: staff.id,
    p_starts_at: now.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_reason: reason,
    p_created_via: "widget",
  } as never);

  if (rpcError) {
    const status = rpcError.code === "P0001" ? 409 : rpcError.code === "22023" ? 400 : 500;
    if (status === 500) console.error("create_block_atomic failed:", rpcError);
    return error(rpcError.message ?? "Blok olusturulamadi", status, {
      code: status === 409 ? "BLOCK_CONFLICT" : "BLOCK_ERROR",
      should_refetch_availability: status === 409,
    });
  }

  await supabase
    .from("widget_tokens")
    .update({ last_used_at: now.toISOString() })
    .eq("id", widgetToken.id);

  return json(block, 201);
});
