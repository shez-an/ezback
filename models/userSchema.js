

const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  jackpotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Jackpot', required: true }, // Reference to the Jackpot
  deposited: { type: Number, required: true }, // Amount deposited in the game
  totalWon: { type: Number, required: true }, // Amount won in the game
  profit: { type: Number, required: true }, // Profit from the game
  chance: { type: String, required: true }, // Winning chance (e.g., "25%")
  gamemode: { type: String, required: true }, // Gamemode (e.g., "Classic")
  winningTrade: { type: String }, // Trade ID or URL (optional, primarily for winners)
  isWinner: { type: Boolean, default: false }, // Flag to indicate if the user won
  timestamp: { type: Date, default: Date.now }, // When the game was played
});

const userSchema = new mongoose.Schema({
  steamId: { type: String, required: true, unique: true }, // Steam ID64 of the user
  username: { type: String, required: true }, // Username or display name
  profileUrl: { type: String }, // Steam profile URL
  tradeUrl: { type: String }, // Steam Trade URL
  avatar: { // User's avatar images
    small: { type: String },
    medium: { type: String },
    large: { type: String },
  },
  inventory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }], // Array of item references owned by the user
  deposited: { type: Number, default: 0 }, // Total deposited amount
  totalWon: { type: Number, default: 0 }, // Total won amount
  profit: { type: Number, default: 0 }, // Total profit
  token: { type: String }, // Token for authentication
  gameHistory: [gameHistorySchema], // Array of game history objects
  createdAt: { type: Date, default: Date.now }, // Timestamp for when the user registered
});

module.exports = mongoose.model('User', userSchema);
