import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

export function initAnalytics(
  apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
  host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
) {
  if (client) return;
  if (!apiKey) return;
  client = new PostHog(apiKey, { host });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  // `as any`: PostHog SDK expects PostHogCustomEventName, not string — structural cast only
  client?.capture(event, properties as any);
}

export function identifyUser(userId: string) {
  // UUIDs are opaque random identifiers — no PII, KVKK-compliant
  client?.identify(userId);
}

export function resetAnalytics() {
  client?.reset();
}
