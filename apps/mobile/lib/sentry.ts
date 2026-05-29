import type { Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react-native';

let initialized = false;

/* c8 ignore next 4 */
export function __resetSentryForTest() {
  initialized = false;
}

export function initSentry(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN) {
  if (initialized) return;
  if (!dsn) return;

  initialized = true;
  Sentry.init({
    dsn,
    enabled: true,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

export function setSentryUserFromSession(session: Session | null) {
  if (!session) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: session.user.id,
    email: session.user.email ?? undefined,
  });
}

export function captureSentryVerificationError() {
  Sentry.captureException(new Error('Sentry mobile verification error'));
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;