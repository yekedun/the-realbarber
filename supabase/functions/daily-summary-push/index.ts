import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { json, error, corsOptions } from "../_shared/cors.ts";

/**
 * Daily summary push notification.
 *
 * pg_cron, '*\/15 * * * *' ile her 15 dakikada bir tetikler. Bu fonksiyon
 * her shop icin Europe/Istanbul saatine gore "bugunku acilis - 15dk" slotunu
 * hesaplar ve sadece o slotta isabet eden shop'larin staff'ina bildirim gonderir.
 *
 * Filtreler:
 *  - Shop bugun acik mi? (working_hours[gun].enabled)
 *  - Staff'in bugun confirmed randevusu var mi?
 *  - Staff'in notification_prefs.daily_summary tercihi (default true)
 */

type WorkingHoursDay = { open?: string; close?: string; enabled?: boolean };
type WorkingHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", WorkingHoursDay>>;

const DOW_KEYS: Array<keyof Required<WorkingHours>> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nowInIstanbul(): { year: number; month: number; day: number; hour: number; minute: number; dow: number } {
  // Use a fixed reference date to format parts in TR timezone.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = parseInt(get("hour"), 10);
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: hour === 24 ? 0 : hour, // en-US 'h12: false' bazi versiyonlarda 24 dondurebilir
    minute: parseInt(get("minute"), 10),
    dow: weekdayMap[get("weekday")] ?? 0,
  };
}

function parseHHMM(s: string | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function istanbulDayBoundsUtc(now: { year: number; month: number; day: number }): { start: Date; end: Date } {
  // Europe/Istanbul = UTC+3 (yil boyu, DST yok). Yerel gun baslangici = UTC 21:00 onceki gun.
  // end = bir sonraki gunun UTC baslangici; sorgu .lt(end) ile kullanilir (exclusive).
  const startUtcMs = Date.UTC(now.year, now.month - 1, now.day, 0, 0, 0, 0) - 3 * 3600 * 1000;
  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 3600 * 1000),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return error("Yetkisiz", 403);
  const token = authHeader.slice(7);
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!svcKey) {
    console.error("[daily-summary-push] SUPABASE_SERVICE_ROLE_KEY env var missing");
    return error("Sunucu yapılandırma hatası", 500);
  }
  const enc = new TextEncoder();
  const tokenBytes = enc.encode(token);
  const keyBytes   = enc.encode(svcKey);
  let mismatch = tokenBytes.length !== keyBytes.length ? 1 : 0;
  const len = Math.min(tokenBytes.length, keyBytes.length);
  for (let i = 0; i < len; i++) mismatch |= tokenBytes[i] ^ keyBytes[i];
  if (mismatch !== 0) return error("Yetkisiz", 403);

  const supabase = createAdminClient();
  const serviceUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const tr = nowInIstanbul();
  const currentSlotMin = tr.hour * 60 + tr.minute - (tr.minute % 15); // 15dk slot tabani
  const dayKey = DOW_KEYS[tr.dow];

  // 1) Bugun acilis - 15dk slot'u currentSlotMin'e esit olan shop'lari sec.
  const { data: shops, error: shopsErr } = await supabase
    .from("shops")
    .select("id, working_hours");
  if (shopsErr) {
    console.error("[daily-summary] shops query failed:", shopsErr);
    return error("Sorgu hatasi", 500);
  }

  const matchingShopIds: string[] = [];
  for (const shop of shops ?? []) {
    const wh = (shop.working_hours as WorkingHours | null) ?? {};
    const today = wh[dayKey];
    if (!today?.enabled) continue;
    const openingMin = parseHHMM(today.open);
    if (openingMin === null) continue;
    const targetMin = openingMin - 15;
    if (targetMin < 0) continue;
    const targetSlot = targetMin - (targetMin % 15);
    if (targetSlot === currentSlotMin) matchingShopIds.push(shop.id as string);
  }

  if (matchingShopIds.length === 0) {
    return json({ sent: 0, reason: "no shop matches this 15-min slot", slot: currentSlotMin });
  }

  // 2a) Matching shop'lardaki staff kayitlarini cek (push_token + pref).
  const { data: staffRows, error: staffErr } = await supabase
    .from("staff")
    .select("id, push_token, shop_id, notification_prefs")
    .in("shop_id", matchingShopIds);
  if (staffErr) {
    console.error("[daily-summary] staff query failed:", staffErr);
    return error("Sorgu hatasi", 500);
  }

  // daily_summary tercihi false olan staff'i erken elendir.
  const eligibleStaff = (staffRows ?? []).filter((s: any) => {
    if (!s.push_token) return false;
    const prefs = s.notification_prefs ?? {};
    return prefs.daily_summary !== false;
  });
  if (eligibleStaff.length === 0) {
    return json({ sent: 0, reason: "no eligible staff in matching shops" });
  }

  // 2b) Bugunku randevulari topla (Europe/Istanbul gun siniri).
  // PostgREST nested join'da .in("staff.shop_id") filtreleme desteklenmez;
  // bunun yerine staff_id listesi uzerinden dogrudan appointments sorguluyoruz.
  const eligibleStaffIds = eligibleStaff.map((s: any) => s.id as string);
  const { start, end } = istanbulDayBoundsUtc(tr);
  const { data: appointments, error: apptErr } = await supabase
    .from("appointments")
    .select("staff_id")
    .eq("status", "confirmed")
    .in("staff_id", eligibleStaffIds)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString()); // lt: ustaki -1ms hack'inden kacin
  if (apptErr) {
    console.error("[daily-summary] appointments query failed:", apptErr);
    return error("Sorgu hatasi", 500);
  }

  if (!appointments || appointments.length === 0) {
    return json({ sent: 0, reason: "no appointments today for matched shops" });
  }

  // 3) Staff bazinda randevu say.
  const staffById = new Map<string, any>(eligibleStaff.map((s: any) => [s.id, s]));
  const byStaff = new Map<string, { token: string; count: number }>();
  for (const appt of appointments) {
    const sid = appt.staff_id as string;
    const staffMember = staffById.get(sid);
    if (!staffMember) continue;
    const existing = byStaff.get(sid);
    if (existing) {
      existing.count++;
    } else {
      byStaff.set(sid, { token: staffMember.push_token, count: 1 });
    }
  }

  if (byStaff.size === 0) return json({ sent: 0, reason: "no eligible staff tokens" });

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
  return json({ sent: messages.length, ...result });
});
