import { buildOwnerRoleFilter } from '../lib/supabase-role';

describe('buildOwnerRoleFilter', () => {
  it('matches both current owner_user_id and legacy owner_id', () => {
    expect(buildOwnerRoleFilter('user-1')).toBe('owner_user_id.eq.user-1,owner_id.eq.user-1');
  });
});
