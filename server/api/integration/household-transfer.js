'use strict';

/** True when userId is primary or associate on this membership (#235). */
export function householdIncludesUserId(membership, userId) {
  const id = userId != null ? String(userId).trim() : '';
  if (!id || !membership || !Array.isArray(membership.members)) {
    return false;
  }
  return membership.members.some(
    (member) => String(member.userId).trim() === id
  );
}
