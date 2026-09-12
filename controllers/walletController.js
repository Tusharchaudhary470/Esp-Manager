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

// Delete transaction from team ledger (preserves current updated balance)
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

    // Remove transaction record from ledger WITHOUT altering vault balance
    team.transactions = team.transactions.filter((t) => t._id.toString() !== transactionId);
    await team.save();

    res.json({ message: 'Transaction record deleted', Balance: team.balance, transactions: team.transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit an existing transaction record (adjusts balance only for the delta of amount corrections)
exports.editTransaction = async (req, res) => {
  try {
    const { teamId, amount, description, entryFee, profit, status, recipientName } = req.body;
    const { transactionId } = req.params;

    const team = await Team.findOne({ _id: teamId });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (!canWrite(team, req.userId)) {
      return res.status(403).json({ message: 'Only team captain or co-captains can edit ledger transactions' });
    }

    const transaction = team.transactions.id(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    // Adjust balance based on the delta between previous and new values
    if (transaction.type === 'deposit') {
      if (amount !== undefined) {
        const oldAmt = Number(transaction.amount || 0);
        const newAmt = Number(amount);
        if (!isNaN(newAmt) && newAmt >= 0) {
          const delta = newAmt - oldAmt;
          team.balance += delta;
          transaction.amount = newAmt;
        }
      }
    } else if (transaction.type === 'withdraw' || transaction.type === 'payout') {
      if (amount !== undefined) {
        const oldAmt = Number(transaction.amount || 0);
        const newAmt = Number(amount);
        if (!isNaN(newAmt) && newAmt >= 0) {
          const delta = newAmt - oldAmt;
          team.balance -= delta;
          transaction.amount = newAmt;
        }
      }
    } else if (transaction.type === 'lobby') {
      const oldStatus = transaction.status;
      const newStatus = status || oldStatus;
      const oldEntry = Number(transaction.entryFee || 0);
      const oldProfit = Number(transaction.profit || 0);
      const newEntry = entryFee !== undefined ? Number(entryFee) : oldEntry;
      const newProfitVal = profit !== undefined ? Number(profit) : oldProfit;

      if (oldStatus === 'completed' && newStatus === 'completed') {
        const oldNet = oldProfit - oldEntry;
        const newNet = newProfitVal - newEntry;
        team.balance += (newNet - oldNet);
      } else if (oldStatus !== 'completed' && newStatus === 'completed') {
        team.balance += (newProfitVal - newEntry);
      } else if (oldStatus === 'completed' && newStatus !== 'completed') {
        team.balance -= (oldProfit - oldEntry);
      }

      transaction.entryFee = newEntry;
      transaction.profit = newProfitVal;
      transaction.status = newStatus;
    }

    if (description !== undefined) {
      transaction.description = description.trim();
    }
    if (recipientName !== undefined) {
      transaction.recipientName = recipientName.trim();
    }

    await team.save();
    res.json({ message: 'Transaction updated successfully', transaction, Balance: team.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
