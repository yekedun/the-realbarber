'use client';

import type PostHog from 'posthog-js';

let _posthog: typeof PostHog | null = null;

function getClient(): typeof PostHog | null {
  if (typeof window === 'undefined') return null;
  if (_posthog) return _posthog;

  const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';
  if (!key) return null;

  // Lazy import so the module is only loaded client-side
  const { default: posthog } = require('posthog-js') as { default: typeof PostHog };
  posthog.init(key, { api_host: host, person_profiles: 'identified_only' });
  _posthog = posthog;
  return _posthog;
}

export function trackWebEvent(event: string, properties?: Record<string, unknown>) {
  getClient()?.capture(event, properties as any);
}
