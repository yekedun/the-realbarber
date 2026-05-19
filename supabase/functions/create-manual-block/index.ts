import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

interface CreateManualBlockRequest {
  staff_id?: string;
  duration_min?: number;
  reason?: "walkin" | "break" | "personal";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Giriş gerekli", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return error("Geçersiz oturum", 401);

  let body: CreateManualBlockRequest;
  try {
    body = await req.json();
  } catch {
    return error("Geçersiz JSON");
  }

  const staffId = body.staff_id;
  const durationMin = body.duration_min;
  const reason = body.reason ?? "break";

  if (!staffId) return error("staff_id zorunlu");
  if (!durationMin || durationMin < 5 || durationMin > 480) {
    return error("duration_min 5-480 dakika arasında olmalı");
  }

  const supabase = createAdminClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("id, user_id, shop_id")
    .eq("id", staffId)
    .eq("is_active", true)
    .single();

  if (!staff) return error("Personel bulunamadı", 404);

  const { data: shop } = await supabase
    .from("shops")
    .select("owner_id, owner_user_id")
    .eq("id", staff.shop_id)
    .single();

  const isOwner = shop?.owner_id === user.id || shop?.owner_user_id === user.id;
  const isSelf = staff.user_id === user.id;

  if (!isOwner && !isSelf) {
    return error("Bu personel için blok oluşturma yetkiniz yok", 403);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMin * 60_000);

  const { data: block, error: rpcError } = await supabase.rpc("create_block_atomic" as never, {
    p_staff_id: staff.id,
    p_starts_at: now.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_reason: reason,
    p_created_via: "app",
  } as never);

  if (rpcError) {
    const status = rpcError.code === "P0001" ? 409 : rpcError.code === "P0002" ? 404 : 500;
    if (status === 500) console.error("create_block_atomic failed:", rpcError);
    return error(rpcError.message ?? "Blok oluşturulamadı", status);
  }

  return json(block, 201);
});
