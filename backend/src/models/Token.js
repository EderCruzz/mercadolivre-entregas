const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema({
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  expires_at: { type: Number, required: true },
  user_id: { type: Number, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model("Token", TokenSchema);
