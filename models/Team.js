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

const tournamentLineupSchema = new mongoose.Schema({
  playerName: { type: String, required: true },
  role: { type: String, default: 'Starter' },
  memberType: { type: String, enum: ['user', 'custom'], default: 'user' }
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String },
  entryFee: { type: Number },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
  lineup: [tournamentLineupSchema]
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

const strategySlideSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String, default: 'Phase 1: Overview' },
  mapImage: { type: String, default: null },
  rotation: { type: Number, default: 0 },
  zoomLevel: { type: Number, default: 1 },
  panOffset: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  isCropped: { type: Boolean, default: false },
  markers: [mongoose.Schema.Types.Mixed],
  arrows: [mongoose.Schema.Types.Mixed],
  zones: [mongoose.Schema.Types.Mixed],
  labeledCircles: [mongoose.Schema.Types.Mixed],
  pencilPaths: [mongoose.Schema.Types.Mixed],
  textAnnotations: [mongoose.Schema.Types.Mixed]
}, { _id: false });

const strategySchema = new mongoose.Schema({
  title: { type: String, required: true },
  game: { type: String, default: 'Custom / Any Game' },
  mapName: { type: String, required: true },
  customImage: { type: String, default: null },
  notes: { type: String, default: '' },
  slides: [strategySlideSchema],
  markers: [mongoose.Schema.Types.Mixed],
  arrows: [mongoose.Schema.Types.Mixed],
  zones: [mongoose.Schema.Types.Mixed],
  labeledCircles: [mongoose.Schema.Types.Mixed],
  pencilPaths: [mongoose.Schema.Types.Mixed],
  textAnnotations: [mongoose.Schema.Types.Mixed],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
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
  tournaments: [tournamentSchema],
  strategies: [strategySchema],
  isPro: { type: Boolean, default: false },
  proExpiresAt: { type: Date, default: null }
}, { timestamps: true });

teamSchema.index({ members: 1 });
teamSchema.index({ 'joinRequests.user': 1 });

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
