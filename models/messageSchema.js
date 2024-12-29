// models/messageSchema.js

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  avatar: {
    type: String, // URL or path to the avatar image
    default: '',   // Default avatar if not provided
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true, // Add index for faster queries
  },
});

// Optional: Create an index on timestamp for efficient sorting
messageSchema.index({ timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);
