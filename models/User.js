const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  isPro: { type: Boolean, default: false },
  proExpiresAt: { type: Date, default: null }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)

module.exports = User