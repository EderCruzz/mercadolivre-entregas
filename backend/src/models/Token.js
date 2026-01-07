const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  expires_at: Number,
  user_id: String
});

module.exports = mongoose.model("Token", TokenSchema);
