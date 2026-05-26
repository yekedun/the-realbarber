import type { UserRole } from './supabase';

export type RootSegment = string | undefined;

export function isPublicAuthRoute(segment: RootSegment): boolean {
  return segment === '(auth)' || segment === 'invite';
}

export function pendingPathForRole(role: 'pending' | 'rejected'): string {
  return `/(auth)/pending?status=${role}`;
}

export function routeForRole(role: UserRole): string {
  if (role === 'owner') return '/(owner)';
  if (role === 'staff') return '/(app)';
  if (role === 'pending' || role === 'rejected') return pendingPathForRole(role);
  if (role === 'unknown') return '/(auth)/pending?status=unknown';
  return '/(auth)/google-onboarding';
}

export function shouldSkipRoleRouting(segment: RootSegment): boolean {
  return segment === '(owner)' || segment === '(app)' || segment === 'invite';
}
