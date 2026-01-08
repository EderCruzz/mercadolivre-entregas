const cron = require("node-cron");
const axios = require("axios");
const Entrega = require("../models/Entrega");
const Token = require("../models/Token");

const getToken = require("../utils/getToken"); // vamos criar abaixo

const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

module.exports = () => {
  cron.schedule("*/30 * * * *", async () => {
    console.log("⏰ Cron iniciado: atualização de entregas");

    try {
      // Verifica cache
      const cache = await Entrega.find().sort({ updatedAt: -1 });

      if (cache.length > 0) {
        const cacheAge = Date.now() - new Date(cache[0].updatedAt).getTime();
        if (cacheAge < CACHE_TTL) {
          console.log("📦 Cache ainda válido, cron ignorado");
          return;
        }
      }

      console.log("🌐 Cache vencido, atualizando via API");

      const accessToken = await getToken();

      const userResponse = await axios.get(
        "https://api.mercadolibre.com/users/me",
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const buyerId = userResponse.data.id;

      const ordersResponse = await axios.get(
        `https://api.mercadolibre.com/orders/search?buyer=${buyerId}&sort=date_desc`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const entregas = await Promise.all(
        ordersResponse.data.results.map(async (order) => {
          const item = order.order_items?.[0]?.item;

          let statusEntrega = "não informado";
          let dataEntrega = null;
          let rastreio = null;
          let transportadora = "Mercado Envios";

          if (order.shipping?.id) {
            try {
              const shipmentResponse = await axios.get(
                `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` }
                }
              );

              statusEntrega = shipmentResponse.data.status || statusEntrega;
              dataEntrega = shipmentResponse.data.delivered_at || null;
              rastreio = shipmentResponse.data.tracking_number || null;
              transportadora =
                shipmentResponse.data.shipping_option?.name || transportadora;

            } catch {
              // ignora falha de shipment individual
            }
          }

          return {
            pedido_id: order.id,
            produto: item?.title || "Produto não identificado",
            status_pedido: order.status,
            valor: order.total_amount,
            data_compra: order.date_created,
            status_entrega: statusEntrega,
            data_entrega: dataEntrega,
            transportadora,
            rastreio
          };
        })
      );

      await Entrega.deleteMany({});
      await Entrega.insertMany(entregas);

      console.log("✅ Cache atualizado com sucesso pelo cron");

    } catch (err) {
      console.error("❌ Erro no cron:", err.message);
    }
  });
};
