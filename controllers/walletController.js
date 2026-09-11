const Team = require('../models/Team');
const { canWrite } = require('../middleware/permissions');
const { sendTreasuryWebhook, sendMatchWebhook } = require('../utils/discordWebhook');

// Deposit funds to team vault
exports.deposit = async (req, res) => {
  try {
    const { amount, teamId, description } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can deposit funds' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Deposit amount must be a positive number greater than 0' });
    }

    team.balance = team.balance + parsedAmount;
    team.transactions.push({
      type: 'deposit',
      amount: parsedAmount,
      description: description ? description.trim() : 'Manual Deposit',
      performedBy: req.userId,
      status: 'completed'
    });

    await team.save();

    // Trigger asynchronous Discord alert
    sendTreasuryWebhook(team, {
      type: 'deposit',
      amount: parsedAmount,
      description: description ? description.trim() : 'Manual Deposit'
    }, req.userId).catch(() => {});

    res.json({ Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Withdraw funds from team vault
exports.withdraw = async (req, res) => {
  try {
    const { amount, teamId, description } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can withdraw funds' });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Withdrawal amount must be a positive number greater than 0' });
    }

    if (parsedAmount > team.balance) {
      return res.status(400).json({ message: 'Insufficient funds in squad treasury' });
    }

    team.balance -= parsedAmount;
    team.transactions.push({
      type: 'withdraw',
      amount: parsedAmount,
      description,
      performedBy: req.userId,
      status: 'completed'
    });

    await team.save();

    // Trigger asynchronous Discord alert
    sendTreasuryWebhook(team, {
      type: 'withdraw',
      amount: parsedAmount,
      description: description ? description.trim() : 'Manual Withdrawal'
    }, req.userId).catch(() => {});

    res.json({ Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Record competitive match lobby (pending or completed)
exports.recordLobby = async (req, res) => {
  try {
    const { teamId, entryFee, profit, description, status } = req.body;
    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can record match stakes' });
    }

    team.transactions.push({
      type: 'lobby',
      entryFee: Number(entryFee || 0),
      description,
      performedBy: req.userId,
      profit: Number(profit || 0),
      status: status || 'pending'
    });

    await team.save();

    if (status !== 'completed') {
      return res.json({ message: 'Transaction still pending' });
    }

    team.balance = team.balance + ((Number(profit) || 0) - (Number(entryFee) || 0));
    await team.save();

    // Trigger asynchronous Discord alert for completed match
    sendMatchWebhook(team, {
      entryFee: Number(entryFee || 0),
      profit: Number(profit || 0),
      description
    }, req.userId).catch(() => {});

    res.json({ Balance: team.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Settle pending match lobby reward and reconcile net profit
exports.settleLobby = async (req, res) => {
  try {
    const { teamId, profit, entryFee } = req.body;
    const { transactionId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can settle match rewards' });
    }

    const transaction = team.transactions.id(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    transaction.profit = Number(profit);
    transaction.status = 'completed';
    transaction.entryFee = Number(entryFee);

    team.balance = team.balance + (Number(profit) - Number(entryFee));
    await team.save();

    // Trigger asynchronous Discord alert for settled match
    sendMatchWebhook(team, {
      entryFee: Number(entryFee || 0),
      profit: Number(profit || 0),
      description: transaction.description
    }, req.userId).catch(() => {});

    res.json({ Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete transaction from team ledger
exports.deleteTransaction = async (req, res) => {
  try {
    const { teamId } = req.body;
    const { transactionId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can delete ledger transactions' });
    }

    const transaction = team.transactions.id(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.type === 'deposit') {
      team.balance = team.balance - transaction.amount;
    } else if (transaction.type === 'withdraw') {
      team.balance = team.balance + transaction.amount;
    } else if (transaction.type === 'lobby' && transaction.status === 'completed') {
      team.balance = team.balance - ((transaction.profit || 0) - (transaction.entryFee || 0));
    }

    team.transactions = team.transactions.filter((t) => t._id.toString() !== transactionId);
    await team.save();

    res.json({ Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
