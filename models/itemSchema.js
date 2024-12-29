const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the item (market_hash_name)
  iconUrl: { type: String, required: true }, // URL to the item's icon image
  price: { type: String, required: true }, // Price of the item in USD or other currency
  tradable: { type: Boolean, default: true }, // Whether the item is tradable
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the owner (User) of the item
  assetId: { type: String, required: true }, // Steam asset ID for the item
  appId: { type: Number, default: 252490 }, // Steam App ID (e.g., 730 for CS:GO, 252490 for Rust)
  contextId: { type: Number, default: 2 }, // Context ID (usually 2 for Steam inventories)
  createdAt: { type: Date, default: Date.now }, // Timestamp for when the item was added to the system
  // quantity: {type: String, required: true}
});

module.exports = mongoose.model('Item', itemSchema);
