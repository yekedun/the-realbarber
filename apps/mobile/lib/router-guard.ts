import type { UserRole } from './supabase';
import type { Href } from 'expo-router';

export type RootSegment = string | undefined;

export function isPublicAuthRoute(segment: RootSegment): boolean {
  return segment === '(auth)' || segment === 'invite';
}

export function pendingPathForRole(role: 'pending' | 'rejected'): Href {
  return `/(auth)/pending?status=${role}` as Href;
}

export function routeForRole(role: UserRole): Href {
  if (role === 'owner') return '/(owner)' as Href;
  if (role === 'staff') return '/(app)' as Href;
  if (role === 'pending' || role === 'rejected') return pendingPathForRole(role);
  if (role === 'unknown') return '/(auth)/pending?status=unknown' as Href;
  return '/(auth)/google-onboarding' as Href;
}

export function shouldSkipRoleRouting(segment: RootSegment): boolean {
  return segment === '(owner)' || segment === '(app)' || segment === 'invite';
}
