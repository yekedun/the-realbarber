import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { json, error, corsOptions } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  // Only service role can trigger this (via pg_cron or manual call)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return error("Yetkisiz", 403);
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]!));
    if (payload.role !== "service_role") return error("Yetkisiz", 403);
  } catch {
    return error("Yetkisiz", 403);
  }

  const supabase = createAdminClient();
  const serviceUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Today's range in UTC (pg_cron fires at 05:00 UTC = 08:00 TR)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("staff_id, staff:staff_id(push_token, name)")
    .eq("status", "confirmed")
    .gte("starts_at", todayStart.toISOString())
    .lte("starts_at", todayEnd.toISOString());

  if (!appointments || appointments.length === 0) {
    return json({ sent: 0, reason: "no appointments today" });
  }

  // Group by staff
  const byStaff = new Map<string, { token: string; count: number }>();
  for (const appt of appointments) {
    const staff = appt.staff as any;
    if (!staff?.push_token) continue;
    const existing = byStaff.get(appt.staff_id);
    if (existing) {
      existing.count++;
    } else {
      byStaff.set(appt.staff_id, { token: staff.push_token, count: 1 });
    }
  }

  if (byStaff.size === 0) return json({ sent: 0, reason: "no tokens" });

  const messages = Array.from(byStaff.values()).map(({ token, count }) => ({
    to: token,
    title: "Günlük Özet",
    body: `Bugün ${count} randevun var. İyi çalışmalar!`,
    data: { type: "daily_summary" },
  }));

  const res = await fetch(`${serviceUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ messages }),
  });

  const result = await res.json();
  return json(result);
});
