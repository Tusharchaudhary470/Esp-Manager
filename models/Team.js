const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'withdraw', 'lobby'], required: true },
  amount: { type: Number, default : 0},
  description: { type: String },
  performedBy: { type: String },
  date: { type: Date, default: Date.now },
  entryFee: { type: Number, default: 0 },
profit: { type: Number, default: 0 },
status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
})

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String },
  entryFee: { type: Number },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' }
})

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  members: [{ type: String }],
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema],
  tournaments: [tournamentSchema]
}, { timestamps: true })

const Team = mongoose.model('Team', teamSchema)

module.exports = Team