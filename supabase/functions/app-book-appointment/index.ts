import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { corsOptions, error, json } from "../_shared/cors.ts";

interface BookRequest {
  shop_slug: string;
  service_id: string;
  staff_id?: string | null;
  barber_id?: string | null;
  starts_at: string;
  customer_name: string;
  customer_phone?: string | null;
}

function mapRpcErrorStatus(code?: string): number {
  if (code === "P0001") return 409;
  if (code === "P0002") return 404;
  if (code === "22023") return 400;
  return 500;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("Giris gerekli", 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) return error("Gecersiz oturum", 401);

  let body: BookRequest;
  try {
    body = await req.json();
  } catch {
    return error("Gecersiz JSON");
  }

  const { shop_slug, service_id, starts_at, customer_name, customer_phone } = body;
  const staff_id = body.staff_id ?? body.barber_id ?? null;

  if (!shop_slug || !service_id || !starts_at || !customer_name) {
    return error("shop_slug, service_id, starts_at, customer_name zorunlu");
  }
  if (customer_name.trim().length < 2) return error("Isim en az 2 karakter olmali");

  const slotDate = new Date(starts_at);
  if (isNaN(slotDate.getTime())) return error("Gecersiz starts_at");

  const supabase = createAdminClient();

  const { data, error: rpcError } = await supabase.rpc("create_appointment_atomic" as never, {
    p_shop_slug: shop_slug,
    p_shop_id: null,
    p_service_id: service_id,
    p_staff_id: staff_id,
    p_starts_at: starts_at,
    p_customer_name: customer_name,
    p_customer_phone: customer_phone ?? null,
    p_customer_notes: null,
    p_customer_user_id: user.id,
  } as never);

  if (rpcError) {
    const status = mapRpcErrorStatus(rpcError.code);
    if (status === 500) console.error("create_appointment_atomic failed:", rpcError);
    return error(rpcError.message ?? "Randevu olusturulamadi", status, {
      code: status === 409 ? "BOOKING_CONFLICT" : "BOOKING_ERROR",
      should_refetch_availability: status === 409,
    });
  }

  return json(data);
});
