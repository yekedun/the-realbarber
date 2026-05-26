export function buildOwnerRoleFilter(userId: string): string {
  return `owner_user_id.eq.${userId},owner_id.eq.${userId}`;
}

export function isMissingStatusColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.message?.includes('shops.status') === true;
}

export function isMissingColumnError(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  return error.code === '42703' && error.message?.includes(column) === true;
}
