import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsOptions, error, json } from "../_shared/cors.ts";
import { MIN_CANCEL_NOTICE_MINUTES } from "@berber/shared/constants";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Oturum gerekli", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return error("Oturum doğrulanamadı", 401);

  let body: { appointment_id: string };
  try {
    body = await req.json();
  } catch {
    return error("Geçersiz JSON");
  }

  const { appointment_id } = body;
  if (!appointment_id) return error("appointment_id zorunlu");

  // Pre-flight read: enforce minimum notice period before touching state.
  // RLS (customer_user_id = auth.uid()) + explicit filter together ensure
  // another customer's appointment returns null, not a 403.
  const { data: appointment } = await userClient
    .from("appointments")
    .select("starts_at, status")
    .eq("id", appointment_id)
    .eq("customer_user_id", user.id)
    .single();

  if (!appointment) return error("Randevu bulunamadı", 404);
  if (appointment.status === "cancelled") return error("Randevu zaten iptal edilmiş", 400);

  const minCancelMs = MIN_CANCEL_NOTICE_MINUTES * 60_000;
  if (new Date(appointment.starts_at).getTime() - Date.now() < minCancelMs) {
    return error(
      `Randevuya ${MIN_CANCEL_NOTICE_MINUTES / 60} saatten az kaldığı için iptal edilemez. Lütfen dükkan ile iletişime geçin.`,
      409
    );
  }

  // Atomic cancellation: advisory lock + status guard happen inside the RPC.
  // Running as authenticated user so cancel_appointment_atomic enforces
  // customer_user_id ownership server-side.
  const { error: rpcError } = await userClient.rpc("cancel_appointment_atomic" as never, {
    p_appointment_id: appointment_id,
  } as never);

  if (rpcError) {
    if (rpcError.code === "P0002" || rpcError.code === "42501") {
      return error("Randevu bulunamadı", 404);
    }
    if (rpcError.code === "22023") {
      return error(rpcError.message ?? "Bu randevu iptal edilemiyor", 400);
    }
    console.error("cancel_appointment_atomic failed:", rpcError);
    return error("İptal işlemi başarısız", 500);
  }

  return json({ success: true });
});
