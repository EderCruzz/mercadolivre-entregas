const axios = require("axios");
const Token = require("../models/Token");

module.exports = async function getToken() {
  const token = await Token.findOne().sort({ createdAt: -1 });

  if (!token) {
    throw new Error("Token não encontrado");
  }

  if (Date.now() < token.expires_at) {
    return token.access_token;
  }

  console.log("Cron: renovando token");

  const response = await axios.post(
    "https://api.mercadolibre.com/oauth/token",
    {
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: token.refresh_token
    },
    { headers: { "Content-Type": "application/json" } }
  );

  token.access_token = response.data.access_token;
  token.refresh_token = response.data.refresh_token;
  token.expires_at = Date.now() + response.data.expires_in * 1000;

  await token.save();

  console.log("Token renovado automaticamente pelo cron");

  return token.access_token;
};
