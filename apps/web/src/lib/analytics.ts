// 'use client' keeps posthog-js out of the server bundle entirely
'use client';

import posthog from 'posthog-js';

let initialized = false;

function getClient(): typeof posthog | null {
  if (typeof window === 'undefined') return null;
  if (initialized) return posthog;

  const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';
  if (!key) return null;

  posthog.init(key, { api_host: host, person_profiles: 'identified_only' });
  initialized = true;
  return posthog;
}

export function trackWebEvent(event: string, properties?: Record<string, unknown>) {
  // `as any`: posthog-js capture expects JsonType, not Record<string, unknown> — structural cast only
  getClient()?.capture(event, properties as any);
}
