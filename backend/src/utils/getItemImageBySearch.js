const axios = require("axios");

module.exports = async function getItemImageBySearch(produto) {
  if (!produto) return null;

  try {
    const response = await axios.get(
      "https://api.mercadolibre.com/sites/MLB/search",
      {
        params: {
          q: produto,
          limit: 1
        }
      }
    );

    const item = response.data.results?.[0];

    if (!item) return null;

    // Preferir thumbnail grande se existir
    return (
      item.thumbnail?.replace("-I.jpg", "-O.jpg") ||
      item.thumbnail ||
      null
    );

  } catch (err) {
    console.warn("⚠️ Falha ao buscar imagem por search:", produto);
    return null;
  }
};
