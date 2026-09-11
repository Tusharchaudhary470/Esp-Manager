const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'withdraw', 'lobby', 'payout'], required: true },
  amount: { type: Number, default: 0 },
  description: { type: String },
  performedBy: { type: String },
  entryFee: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  paidTo: { type: mongoose.Schema.Types.Mixed },
  recipientName: { type: String },
  date: { type: Date, default: Date.now }
});

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String },
  entryFee: { type: Number },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' }
});

const customMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, default: 'Assaulter' },
  dateAdded: { type: Date, default: Date.now }
});

const memberRoleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String, 
    enum: ['IGL', 'Assaulter', 'Sniper', 'Rusher', 'Supporter'], 
    default: 'Assaulter' 
  }
}, { _id: false });

const joinRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now }
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberRoles: [memberRoleSchema],
  joinRequests: [joinRequestSchema],
  customMembers: [customMemberSchema],
  autoApproveJoin: { type: Boolean, default: false },
  discordWebhookUrl: { type: String, default: '' },
  webhookNotifications: {
    matchResults: { type: Boolean, default: true },
    payouts: { type: Boolean, default: true },
    treasury: { type: Boolean, default: true },
    tournaments: { type: Boolean, default: true }
  },
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema],
  tournaments: [tournamentSchema]
}, { timestamps: true });

teamSchema.index({ members: 1 });
teamSchema.index({ 'joinRequests.user': 1 });

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
