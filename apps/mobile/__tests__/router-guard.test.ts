import {
  isPublicAuthRoute,
  pendingPathForRole,
  routeForRole,
  shouldSkipRoleRouting,
} from '../lib/router-guard';

describe('router guard helpers', () => {
  it('keeps unauthenticated invite deep links on the invite route', () => {
    expect(isPublicAuthRoute('invite')).toBe(true);
  });

  it('routes pending and rejected users to distinct pending screen states', () => {
    expect(pendingPathForRole('pending')).toBe('/(auth)/pending?status=pending');
    expect(pendingPathForRole('rejected')).toBe('/(auth)/pending?status=rejected');
  });

  it('maps roles to their app entry route', () => {
    expect(routeForRole('owner')).toBe('/(owner)');
    expect(routeForRole('staff')).toBe('/(app)');
    expect(routeForRole('unknown')).toBe('/(auth)/pending?status=unknown');
    expect(routeForRole('new_user')).toBe('/(auth)/google-onboarding');
  });

  it('does not re-run role routing while already in app groups or accepting an invite', () => {
    expect(shouldSkipRoleRouting('(owner)')).toBe(true);
    expect(shouldSkipRoleRouting('(app)')).toBe(true);
    expect(shouldSkipRoleRouting('invite')).toBe(true);
    expect(shouldSkipRoleRouting('(auth)')).toBe(false);
  });
});
