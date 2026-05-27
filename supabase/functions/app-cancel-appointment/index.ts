import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";
import { MIN_CANCEL_NOTICE_MINUTES } from "@berber/shared/constants";

async function sendCancelNotification(
  appointmentId: string,
  serviceUrl: string,
  serviceKey: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("customer_name, starts_at, staff_id, staff:staff_id(push_token, shop_id, user_id, notification_prefs)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appt) return;
  const staffMember = appt.staff as any;
  const shopId: string | null = staffMember?.shop_id ?? null;

  const timeStr = new Date(appt.starts_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

  // Hangi push_token'lara gonderecegimizi belirle.
  // - Atanan personel: kural olarak zorunlu (toggle yok).
  //   Ancak personel ayni zamanda dukkan sahibi ise, owner'in cancellation
  //   tercihini uygula (default true).
  // - Dukkan sahibi (personel'den farkliysa): notification_prefs.cancellation
  //   true ise gonder.
  const tokens = new Set<string>();

  let ownerUserId: string | null = null;
  if (shopId) {
    const { data: shop } = await supabase
      .from("shops")
      .select("owner_user_id")
      .eq("id", shopId)
      .maybeSingle();
    ownerUserId = (shop as any)?.owner_user_id ?? null;
  }

  const staffIsOwner = ownerUserId !== null && staffMember?.user_id === ownerUserId;
  const staffPrefs = staffMember?.notification_prefs ?? {};

  if (staffMember?.push_token) {
    if (staffIsOwner) {
      if (staffPrefs.cancellation !== false) tokens.add(staffMember.push_token);
    } else {
      tokens.add(staffMember.push_token);
    }
  }

  if (shopId && ownerUserId && !staffIsOwner) {
    const { data: ownerStaff } = await supabase
      .from("staff")
      .select("push_token, notification_prefs")
      .eq("shop_id", shopId)
      .eq("user_id", ownerUserId)
      .maybeSingle();
    const ownerPrefs = (ownerStaff as any)?.notification_prefs ?? {};
    if (
      ownerStaff?.push_token &&
      ownerStaff.push_token !== staffMember?.push_token &&
      ownerPrefs.cancellation !== false
    ) {
      tokens.add(ownerStaff.push_token);
    }
  }

  if (tokens.size === 0) return;

  const messages = Array.from(tokens).map((to) => ({
    to,
    title: "Randevu İptal Edildi",
    body: `${appt.customer_name} — ${timeStr} randevusunu iptal etti`,
    data: { appointmentId },
  }));

  await fetch(`${serviceUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ messages }),
  }).catch((e) => console.error("[cancel] Push failed:", e));
}

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
      `Randevuya ${MIN_CANCEL_NOTICE_MINUTES} dakikadan az kaldığı için iptal edilemez. Lütfen dükkan ile iletişime geçin.`,
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

  // Fire-and-forget: notify assigned staff + owner (per prefs)
  const svcUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  sendCancelNotification(appointment_id, svcUrl, svcKey).catch(
    (e) => console.error("[cancel] Notification dispatch error:", e)
  );

  return json({ success: true });
});
