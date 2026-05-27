import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { json, error, corsOptions } from "../_shared/cors.ts";

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface SendPushRequest {
  messages: PushMessage[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsOptions();
  if (req.method !== "POST") return error("Method not allowed", 405);

  // Only internal edge function callers (service role key).
  // Timing-safe comparison against SUPABASE_SERVICE_ROLE_KEY env var.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return error("Yetkisiz", 403);
  const token = authHeader.slice(7);
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!svcKey) {
    console.error("[send-push] SUPABASE_SERVICE_ROLE_KEY env var missing");
    return error("Sunucu yapılandırma hatası", 500);
  }
  const enc = new TextEncoder();
  const tokenBytes = enc.encode(token);
  const keyBytes   = enc.encode(svcKey);
  let mismatch = tokenBytes.length !== keyBytes.length ? 1 : 0;
  const len = Math.min(tokenBytes.length, keyBytes.length);
  for (let i = 0; i < len; i++) mismatch |= tokenBytes[i] ^ keyBytes[i];
  if (mismatch !== 0) return error("Yetkisiz", 403);

  let body: SendPushRequest;
  try {
    body = await req.json();
  } catch {
    return error("Gecersiz JSON");
  }

  if (!body.messages || body.messages.length === 0) {
    return json({ sent: 0, errors: [] });
  }

  // Batch into chunks of 100 (Expo limit)
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < body.messages.length; i += 100) {
    chunks.push(body.messages.slice(i, i + 100));
  }

  let totalSent = 0;
  const errors: string[] = [];

  for (const chunk of chunks) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      errors.push(`Expo API error: ${res.status}`);
      continue;
    }

    const result = await res.json() as { data: Array<{ status: string }> };
    const sent = result.data?.filter(d => d.status === "ok").length ?? 0;
    totalSent += sent;
  }

  if (errors.length > 0) {
    console.error("Push send errors:", errors);
  }

  return json({ sent: totalSent, errors });
});
