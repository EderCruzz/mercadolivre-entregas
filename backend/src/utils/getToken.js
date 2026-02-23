const axios = require("axios");
const Token = require("../models/Token");

module.exports = async function getToken() {
  const token = await Token.findOne().sort({ createdAt: -1 });

  if (!token) {
    throw new Error("Token não encontrado");
  }

  const response = await axios.post(
    "https://api.mercadolibre.com/oauth/token",
    {
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
    },
    { headers: { "Content-Type": "application/json" } }
  );

  token.access_token = response.data.access_token;

  await token.save();

  return token.access_token;
};
