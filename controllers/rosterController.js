const Team = require('../models/Team');
const { canWrite } = require('../middleware/permissions');
const { sendPayoutWebhook } = require('../utils/discordWebhook');

// Record player payout from squad vault
exports.recordPayout = async (req, res) => {
  try {
    const { teamId, amount, userId, description, recipientName } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can issue member payouts' });
    }

    const payoutAmount = Number(amount);
    if (isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ message: 'Payout amount must be a positive number greater than 0' });
    }

    if (payoutAmount > team.balance) {
      return res.status(400).json({ message: 'Insufficient balance in squad vault' });
    }

    team.balance -= payoutAmount;
    team.transactions.push({
      type: 'payout',
      amount: payoutAmount,
      paidTo: userId,
      recipientName,
      description,
      performedBy: req.userId,
      status: 'completed'
    });

    await team.save();

    // Trigger asynchronous Discord alert
    sendPayoutWebhook(team, {
      amount: payoutAmount,
      recipientName: recipientName || 'Squad Member',
      description
    }, req.userId).catch(() => {});

    res.json({ message: 'Payout recorded', Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add manual / offline roster member
exports.addCustomMember = async (req, res) => {
  try {
    const { teamId, name, role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Player name is required' });
    }

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can add players to the roster' });
    }

    const totalRosterCount = (team.members?.length || 0) + (team.customMembers?.length || 0);
    if (totalRosterCount >= 6) {
      return res.status(400).json({ message: 'Squad roster is full (maximum 6 total players)' });
    }

    team.customMembers.push({
      name: name.trim(),
      role: role ? role.trim() : 'Assaulter'
    });

    await team.save();
    res.json({ message: 'Player added to squad', customMembers: team.customMembers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete manual / offline roster member
exports.removeCustomMember = async (req, res) => {
  try {
    const { teamId } = req.body;
    const { memberId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can remove players from the roster' });
    }

    team.customMembers = (team.customMembers || []).filter(
      (m) => m._id.toString() !== memberId
    );

    await team.save();
    res.json({ message: 'Player removed from squad', customMembers: team.customMembers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
