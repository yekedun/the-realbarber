import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json, bodyGuard } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions(req);
  if (req.method !== "POST") return error("Method not allowed", 405);

  const guard = bodyGuard(req);
  if (guard) return guard;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Oturum gerekli", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
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

  // Pre-flight: verify the appointment exists and is cancellable.
  // Runs as authenticated user — RLS allows staff/owner to read
  // appointments in their own shop only.
  const { data: appt } = await userClient
    .from("appointments")
    .select("status, customer_user_id, customer_name, customer_phone")
    .eq("id", appointment_id)
    .maybeSingle();

  if (!appt) return error("Randevu bulunamadı", 404);
  if (appt.status === "cancelled") return error("Randevu zaten iptal edilmiş", 400);
  if (appt.status === "completed") return error("Tamamlanan randevu iptal edilemez", 400);

  // Atomic cancellation via RPC.
  // cancel_appointment_atomic authorizes: assigned staff, shop owner, admin staff.
  // No minimum notice period is enforced for staff/owner cancellations.
  const { error: rpcError } = await userClient.rpc(
    "cancel_appointment_atomic" as never,
    { p_appointment_id: appointment_id } as never,
  );

  if (rpcError) {
    if (rpcError.code === "P0002" || rpcError.code === "42501") {
      return error("Randevu bulunamadı veya yetkiniz yok", 404);
    }
    if (rpcError.code === "22023") {
      return error(rpcError.message ?? "Bu randevu iptal edilemiyor", 400);
    }
    console.error("[staff-cancel] cancel_appointment_atomic failed:", rpcError);
    return error("İptal işlemi başarısız", 500);
  }

  // Best-effort: notify customer if they have a push token.
  // Customers who booked via the customer app have a user_id; we look up
  // their push_token from the staff table (covers barbers booking each other)
  // or from a future customer_profiles table. Fire-and-forget — never blocks cancel.
  if (appt?.customer_user_id) {
    try {
      const admin = createAdminClient();
      const { data: customerStaff } = await admin
        .from("staff")
        .select("push_token")
        .eq("user_id", appt.customer_user_id)
        .not("push_token", "is", null)
        .limit(1)
        .maybeSingle();

      if (customerStaff?.push_token) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: customerStaff.push_token,
            title: "Randevunuz İptal Edildi",
            body: `${appt.customer_name ?? "Randevunuz"} iptal edildi. Yeni randevu almak için uygulamayı açın.`,
            data: { type: "appointment_cancelled" },
          }),
        }).catch((e) => console.warn("[staff-cancel] customer push failed:", e));
      }
    } catch (e) {
      console.warn("[staff-cancel] customer notification lookup failed:", e);
    }
  }

  return json({ success: true });
});
