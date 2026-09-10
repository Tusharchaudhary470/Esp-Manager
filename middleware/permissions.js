/**
 * RBAC Helper: Determines if a user has write authorization for a squad.
 * Authorized if:
 * 1. User is the primary Captain / Owner (or first member as fallback for legacy teams)
 * 2. User is in the squad's `admins` array (delegated Co-Captain)
 */
function canWrite(team, userId) {
  if (!team || !userId) return false;
  const uId = userId.toString();

  // 1. Primary Captain check
  const captainId = team.captain ? team.captain.toString() : (team.members && team.members[0] ? team.members[0].toString() : null);
  if (captainId && captainId === uId) return true;

  // 2. Co-Captain / Admin check
  if (Array.isArray(team.admins)) {
    const isAdmin = team.admins.some((adminId) => adminId && adminId.toString() === uId);
    if (isAdmin) return true;
  }

  return false;
}

/**
 * RBAC Helper: Determines if a user is the primary Captain / Owner.
 * Required for promoting/demoting Co-Captains.
 */
function isCaptain(team, userId) {
  if (!team || !userId) return false;
  const uId = userId.toString();
  const captainId = team.captain ? team.captain.toString() : (team.members && team.members[0] ? team.members[0].toString() : null);
  return Boolean(captainId && captainId === uId);
}

module.exports = {
  canWrite,
  isCaptain
};
