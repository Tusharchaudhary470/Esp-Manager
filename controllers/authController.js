const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');

// User Registration
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();

    res.json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// User Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Wrong password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Change Username
exports.changeUsername = async (req, res) => {
  try {
    const { newUsername, password } = req.body;
    if (!newUsername || !newUsername.trim()) {
      return res.status(400).json({ message: 'New username is required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Current password is required to change username' });
    }

    const trimmedNewUsername = newUsername.trim();
    if (trimmedNewUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    if (user.username.toLowerCase() === trimmedNewUsername.toLowerCase()) {
      return res.status(400).json({ message: 'New username cannot be the same as current username' });
    }

    const existingUser = await User.findOne({ username: trimmedNewUsername });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken by another player' });
    }

    user.username = trimmedNewUsername;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ message: 'Username updated successfully', username: user.username, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Permanently Delete Account & Personal Data (DPDP Act 2023 Right to Erasure)
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Current password is required to delete account' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password. Account deletion aborted.' });
    }

    const userIdStr = req.userId.toString();

    // 1. Find all teams user is involved in
    const teams = await Team.find({
      $or: [
        { captain: req.userId },
        { members: req.userId }
      ]
    });

    for (const team of teams) {
      const isCaptain = team.captain && team.captain.toString() === userIdStr;
      const otherMembers = (team.members || []).filter(m => m.toString() !== userIdStr);

      if (isCaptain) {
        if (otherMembers.length === 0) {
          // Sole captain / sole member -> permanently delete the squad
          await Team.deleteOne({ _id: team._id });
          await User.updateMany(
            { teams: team._id },
            { $pull: { teams: team._id } }
          );
        } else {
          // Reassign captaincy to first admin or first remaining member
          const remainingAdmins = (team.admins || []).filter(a => a.toString() !== userIdStr);
          const newCaptain = remainingAdmins.length > 0 ? remainingAdmins[0] : otherMembers[0];

          team.captain = newCaptain;
          team.members = otherMembers;
          team.admins = remainingAdmins;
          team.memberRoles = (team.memberRoles || []).filter(mr => mr.user && mr.user.toString() !== userIdStr);
          await team.save();
        }
      } else {
        // Normal member/admin -> remove from members, admins, memberRoles
        team.members = otherMembers;
        team.admins = (team.admins || []).filter(a => a.toString() !== userIdStr);
        team.memberRoles = (team.memberRoles || []).filter(mr => mr.user && mr.user.toString() !== userIdStr);
        await team.save();
      }
    }

    // 2. Remove user from all joinRequests across all teams
    await Team.updateMany(
      { 'joinRequests.user': req.userId },
      { $pull: { joinRequests: { user: req.userId } } }
    );

    // 3. Permanently delete the user document
    await User.deleteOne({ _id: req.userId });

    res.json({ message: 'Account and all associated personal data have been permanently deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
