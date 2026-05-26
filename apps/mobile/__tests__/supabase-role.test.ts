import { buildOwnerRoleFilter, isMissingColumnError, isMissingStatusColumnError } from '../lib/supabase-role';

describe('buildOwnerRoleFilter', () => {
  it('matches both current owner_user_id and legacy owner_id', () => {
    expect(buildOwnerRoleFilter('user-1')).toBe('owner_user_id.eq.user-1,owner_id.eq.user-1');
  });
});

describe('isMissingColumnError', () => {
  it('detects the requested missing column without matching unrelated 42703 errors', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column staff.phone does not exist' }, 'staff.phone')).toBe(true);
    expect(isMissingColumnError({ code: '42703', message: 'column shops.status does not exist' }, 'staff.phone')).toBe(false);
  });
});

describe('isMissingStatusColumnError', () => {
  it('detects legacy databases where shops.status is not migrated yet', () => {
    expect(isMissingStatusColumnError({ code: '42703' })).toBe(true);
    expect(isMissingStatusColumnError({ message: 'column shops.status does not exist' })).toBe(true);
  });

  it('does not hide unrelated role lookup errors', () => {
    expect(isMissingStatusColumnError({ code: 'PGRST301', message: 'JWT expired' })).toBe(false);
    expect(isMissingStatusColumnError(null)).toBe(false);
  });
});
