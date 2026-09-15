const Team = require('../models/Team');
const User = require('../models/User');
const { canWrite, isCaptain } = require('../middleware/permissions');
const { isValidDiscordWebhook, sendTestWebhook } = require('../utils/discordWebhook');

// Create a new team
exports.createTeam = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Squad name is required' });
    }

    // Check if user has Pro privileges
    const user = await User.findById(req.userId);
    const isProUser = (user && (user.isPro || (user.proExpiresAt && new Date(user.proExpiresAt) > new Date()))) ||
      Boolean(await Team.exists({ captain: req.userId, isPro: true }));

    const code = Math.random().toString(36).substring(2, 7).toUpperCase();

    const team = new Team({
      name: name.trim(),
      code,
      captain: req.userId,
      admins: [],
      members: [req.userId],
      memberRoles: [{
        user: req.userId,
        role: 'IGL'
      }],
      joinRequests: [],
      customMembers: [],
      isPro: isProUser || false
    });

    await team.save();
    res.json({ message: 'Team created', team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Request to join team via invite code (places user in Pending Join Requests)
exports.joinTeam = async (req, res) => {
  try {
    const { code } = req.body;
    const team = await Team.findOne({ code: code.toUpperCase() });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Check if already a squad member
    if (team.members.map((m) => m.toString()).includes(req.userId.toString())) {
      return res.status(400).json({ message: 'You are already in this squad' });
    }

    // Check 6-member hard capacity limit
    if (team.members.length >= 6) {
      return res.status(400).json({ message: 'This squad has reached the maximum capacity of 6 members' });
    }

    // Check if user already submitted a pending join request
    const alreadyRequested = (team.joinRequests || []).some(
      (r) => r.user && r.user.toString() === req.userId.toString()
    );
    if (alreadyRequested) {
      return res.status(400).json({ message: 'Your join request is already pending review by the team captain' });
    }

    // If auto-approval is enabled, enroll directly into the squad
    if (team.autoApproveJoin) {
      team.members.push(req.userId);
      if (!team.memberRoles) team.memberRoles = [];
      team.memberRoles.push({ user: req.userId, role: 'Assaulter' });
      await team.save();

      return res.json({
        message: `Welcome to ${team.name}! Your enlistment was auto-approved.`,
        isAutoApproved: true,
        teamId: team._id
      });
    }

    // Otherwise submit join request for captain review
    team.joinRequests.push({
      user: req.userId,
      date: new Date()
    });
    await team.save();

    res.json({
      message: `Join request submitted for ${team.name}! Waiting for the squad captain to review and accept.`,
      isPending: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Accept pending join request (Captain or Co-Captain only)
exports.acceptJoinRequest = async (req, res) => {
  try {
    const { teamId, requestingUserId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can accept join requests' });
    }

    if (team.members.length >= 6) {
      return res.status(400).json({ message: 'Squad is full (maximum 6 members). Cannot accept new members.' });
    }

    // Remove from join requests
    team.joinRequests = (team.joinRequests || []).filter(
      (r) => r.user && r.user.toString() !== requestingUserId.toString()
    );

    // Add to members if not already present
    if (!team.members.map((m) => m.toString()).includes(requestingUserId.toString())) {
      team.members.push(requestingUserId);

      // Assign default tactical role
      if (!team.memberRoles) team.memberRoles = [];
      const hasRole = team.memberRoles.some((mr) => mr.user.toString() === requestingUserId.toString());
      if (!hasRole) {
        team.memberRoles.push({ user: requestingUserId, role: 'Assaulter' });
      }
    }

    await team.save();
    res.json({ message: 'Member accepted into squad', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reject pending join request (Captain or Co-Captain only)
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { teamId, requestingUserId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can reject join requests' });
    }

    team.joinRequests = (team.joinRequests || []).filter(
      (r) => r.user && r.user.toString() !== requestingUserId.toString()
    );

    await team.save();
    res.json({ message: 'Join request rejected', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Promote member to Co-Captain (Captain/Owner only)
exports.promoteMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!isCaptain(team, req.userId)) {
      return res.status(403).json({ message: 'Only the squad captain can promote members to co-captain' });
    }

    if (!team.admins) team.admins = [];
    if (!team.admins.map((id) => id.toString()).includes(memberId.toString())) {
      team.admins.push(memberId);
    }

    await team.save();
    res.json({ message: 'Member promoted to Co-Captain', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Demote Co-Captain back to standard member (Captain/Owner only)
exports.demoteMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!isCaptain(team, req.userId)) {
      return res.status(403).json({ message: 'Only the squad captain can revoke co-captain privileges' });
    }

    team.admins = (team.admins || []).filter((id) => id.toString() !== memberId.toString());

    await team.save();
    res.json({ message: 'Co-Captain privileges revoked', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a member's tactical combat role (IGL, Assaulter, Sniper, Rusher, Supporter)
exports.updateMemberRole = async (req, res) => {
  try {
    const { teamId, memberId, role, isCustom } = req.body;
    const validRoles = ['IGL', 'Assaulter', 'Sniper', 'Rusher', 'Supporter'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can assign tactical roles' });
    }

    if (isCustom) {
      const customMember = team.customMembers.id(memberId);
      if (!customMember) return res.status(404).json({ message: 'Custom player not found' });
      customMember.role = role;
      team.markModified('customMembers');
    } else {
      if (!team.memberRoles) team.memberRoles = [];
      const mIdStr = memberId.toString();
      const existing = team.memberRoles.find(
        (mr) => mr.user && (mr.user._id || mr.user).toString() === mIdStr
      );
      if (existing) {
        existing.role = role;
      } else {
        team.memberRoles.push({ user: memberId, role });
      }
      team.markModified('memberRoles');
    }

    await team.save();

    const populatedTeam = await Team.findOne({ _id: teamId })
      .populate('members', 'username')
      .populate('captain', 'username')
      .populate('admins', 'username')
      .populate('joinRequests.user', 'username')
      .lean();

    res.json({ message: `Tactical role updated to ${role}`, team: populatedTeam });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all teams for authenticated user
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find({ members: req.userId })
      .populate('members', 'username')
      .populate('captain', 'username')
      .populate('admins', 'username')
      .populate('joinRequests.user', 'username')
      .lean();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single team details by team ID
exports.getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findOne({ _id: teamId })
      .populate('members', 'username')
      .populate('captain', 'username')
      .populate('admins', 'username')
      .populate('joinRequests.user', 'username')
      .lean();
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // Check if authenticated user is actually an active member of this squad
    const isMember = (team.members || []).some(
      (m) => (m._id ? m._id.toString() : m.toString()) === req.userId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this squad' });
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get squads where current user has a pending join request
exports.getMyPendingRequests = async (req, res) => {
  try {
    const teams = await Team.find({ 'joinRequests.user': req.userId })
      .select('name code captain createdAt joinRequests')
      .populate('captain', 'username')
      .lean();

    const formatted = teams.map((t) => {
      const userReq = (t.joinRequests || []).find(
        (r) => r.user && r.user.toString() === req.userId.toString()
      );
      return {
        _id: t._id,
        name: t.name,
        code: t.code,
        captainName: t.captain?.username || 'Captain',
        requestDate: userReq?.date || t.createdAt
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel a user's own pending join request
exports.cancelJoinRequest = async (req, res) => {
  try {
    const { teamId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    team.joinRequests = (team.joinRequests || []).filter(
      (r) => r.user && r.user.toString() !== req.userId.toString()
    );

    await team.save();
    res.json({ message: 'Join request cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update squad settings (autoApproveJoin, discordWebhookUrl, webhookNotifications)
exports.updateTeamSettings = async (req, res) => {
  try {
    const { teamId, autoApproveJoin, discordWebhookUrl, webhookNotifications } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can change settings' });
    }

    if (autoApproveJoin !== undefined) {
      team.autoApproveJoin = Boolean(autoApproveJoin);
    }

    if (discordWebhookUrl !== undefined) {
      const trimmedUrl = (discordWebhookUrl || '').trim();
      if (trimmedUrl && !isValidDiscordWebhook(trimmedUrl)) {
        return res.status(400).json({ 
          message: 'Invalid Discord Webhook URL. It must begin with https://discord.com/api/webhooks/...' 
        });
      }
      team.discordWebhookUrl = trimmedUrl;
    }

    if (webhookNotifications !== undefined && typeof webhookNotifications === 'object') {
      const current = team.webhookNotifications ? team.webhookNotifications.toObject() : {};
      team.webhookNotifications = {
        ...current,
        ...webhookNotifications
      };
    }

    await team.save();
    res.json({
      message: 'Squad settings updated successfully',
      team
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Test squad Discord webhook connectivity
exports.testDiscordWebhook = async (req, res) => {
  try {
    const { teamId, webhookUrl } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only squad captain or co-captains can test webhook settings' });
    }

    const targetUrl = (webhookUrl || team.discordWebhookUrl || '').trim();
    if (!isValidDiscordWebhook(targetUrl)) {
      return res.status(400).json({ 
        message: 'Invalid Discord Webhook URL. Must begin with https://discord.com/api/webhooks/...' 
      });
    }

    const success = await sendTestWebhook(targetUrl, team.name);
    if (!success) {
      return res.status(502).json({ 
        message: 'Failed to deliver test ping to Discord. Please check webhook URL channel permissions.' 
      });
    }

    res.json({ message: 'Test ping delivered to Discord channel successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Member voluntarily leaves the squad
exports.leaveTeam = async (req, res) => {
  try {
    const { teamId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const isEnlisted = team.members.some((m) => m.toString() === req.userId.toString());
    if (!isEnlisted) {
      return res.status(400).json({ message: 'You are not an active member of this squad' });
    }

    // If user is the captain, prevent leaving if other members exist
    const isOwner = team.captain && team.captain.toString() === req.userId.toString();
    if (isOwner && team.members.length > 1) {
      return res.status(400).json({
        message: 'Squad captain cannot leave while other members are enlisted. Promote or transfer captaincy first.'
      });
    }

    // Remove user from members, admins, memberRoles
    team.members = team.members.filter((m) => m.toString() !== req.userId.toString());
    team.admins = (team.admins || []).filter((a) => a.toString() !== req.userId.toString());
    team.memberRoles = (team.memberRoles || []).filter(
      (mr) => mr.user && mr.user.toString() !== req.userId.toString()
    );

    if (team.members.length === 0) {
      await Team.deleteOne({ _id: teamId });
      return res.json({ message: 'Squad disbanded successfully' });
    }

    await team.save();
    res.json({ message: 'You have left the squad' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Captain kicks an enlisted member from the squad
exports.kickMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!isCaptain(team, req.userId)) {
      return res.status(403).json({ message: 'Only the squad captain can kick members' });
    }

    if (team.captain && team.captain.toString() === memberId.toString()) {
      return res.status(400).json({ message: 'Cannot kick the squad captain' });
    }

    const isEnlisted = team.members.some((m) => m.toString() === memberId.toString());
    if (!isEnlisted) {
      return res.status(400).json({ message: 'User is not an active member of this squad' });
    }

    team.members = team.members.filter((m) => m.toString() !== memberId.toString());
    team.admins = (team.admins || []).filter((a) => a.toString() !== memberId.toString());
    team.memberRoles = (team.memberRoles || []).filter(
      (mr) => mr.user && mr.user.toString() !== memberId.toString()
    );

    await team.save();
    res.json({ message: 'Member has been kicked from the squad', team });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Captain permanently disbands and deletes the squad
exports.deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Squad not found' });

    if (!isCaptain(team, req.userId)) {
      return res.status(403).json({ message: 'Only the squad captain can disband this squad' });
    }

    await Team.deleteOne({ _id: teamId });
    await User.updateMany(
      { teams: teamId },
      { $pull: { teams: teamId } }
    );

    res.json({ message: `Squad "${team.name}" has been permanently disbanded.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

