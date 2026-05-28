import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 600;

async function isRateLimited(ip: string): Promise<boolean> {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return false;

  const key = `rl:book:${ip}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(RATE_LIMIT_WINDOW_SEC), "NX"],
      ]),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const count: unknown = data?.[0]?.result;
    return typeof count === "number" && count > RATE_LIMIT_MAX;
  } catch (err) {
    console.error("Upstash rate limit check failed:", err);
    return false;
  }
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

interface BookAppointmentRequest {
  shop_slug: string;
  service_id: string;
  staff_id: string | null;
  starts_at: string;
  customer_name: string;
  customer_phone?: string;
  customer_notes?: string;
}

function mapRpcErrorStatus(code?: string): number {
  if (code === "P0001") return 409;
  if (code === "P0002") return 404;
  if (code === "22023") return 400;
  if (code === "P0004") return 429;
  return 500;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-\(\)]/g, "");
  return /^(\+90|0)?[5][0-9]{9}$/.test(digits) || /^[0-9]{10,15}$/.test(digits);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
    return error("Çok fazla istek. 10 dakika sonra tekrar deneyin.", 429, {
      code: "RATE_LIMITED",
      retry_after: RATE_LIMIT_WINDOW_SEC,
    });
  }

  let body: BookAppointmentRequest;
  try {
    body = await req.json();
  } catch {
    return error("Geçersiz JSON");
  }

  const {
    shop_slug,
    service_id,
    staff_id,
    starts_at,
    customer_name,
    customer_phone,
    customer_notes,
  } = body;

  if (!shop_slug || !service_id || !starts_at || !customer_name || !customer_phone) {
    return error("shop_slug, service_id, starts_at, customer_name, customer_phone zorunlu");
  }

  if (customer_name.trim().length < 2) {
    return error("İsim en az 2 karakter olmalı");
  }
  if (!isValidPhone(customer_phone.trim())) {
    return error("Geçersiz müşteri telefon numarası", 400);
  }

  const slotDate = new Date(starts_at);
  if (isNaN(slotDate.getTime())) return error("Gecersiz starts_at");
  if (slotDate.getTime() < Date.now() - 5 * 60_000) return error("Geçmiş bir saate randevu oluşturulamaz", 400);

  const supabase = createAdminClient();

  // Validate staff_id belongs to this shop (defense against cross-shop booking)
  if (staff_id) {
    const { data: shopCheck } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", shop_slug)
      .maybeSingle();
    if (!shopCheck) return error("Dükkan bulunamadı", 404);

    const { data: staffCheck } = await supabase
      .from("staff")
      .select("id")
      .eq("id", staff_id)
      .eq("shop_id", shopCheck.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!staffCheck) return error("Geçersiz personel", 403);
  }

  const { data, error: rpcError } = await supabase.rpc("create_appointment_atomic" as never, {
    p_shop_slug: shop_slug,
    p_shop_id: null,
    p_service_id: service_id,
    p_staff_id: staff_id ?? null,
    p_starts_at: starts_at,
    p_customer_name: customer_name,
    p_customer_phone: customer_phone ?? null,
    p_customer_notes: customer_notes ?? null,
    p_customer_user_id: null,
  } as never);

  if (rpcError) {
    const status = mapRpcErrorStatus(rpcError.code);
    if (status === 500) console.error("create_appointment_atomic failed:", rpcError);
    return error(rpcError.message ?? "Randevu oluşturulamadı", status, {
      code: status === 429 ? "RATE_LIMITED" : status === 409 ? "BOOKING_CONFLICT" : "BOOKING_ERROR",
      should_refetch_availability: status === 409,
      ...(status === 429 ? { retry_after: 600 } : {}),
    });
  }

  return json(data);
});
