export function buildOwnerRoleFilter(userId: string): string {
  return `owner_user_id.eq.${userId},owner_id.eq.${userId}`;
}
