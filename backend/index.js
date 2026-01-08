require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");

const app = express();

/* =======================
   MongoDB
======================= */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch(err => console.error("❌ Erro MongoDB:", err));

/* =======================
   Models
======================= */
const Token = require("./src/models/Token");
const Entrega = require("./src/models/Entrega");
const getToken = require("./src/utils/getToken");


const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

async function getAccessTokenFromDB() {
  const token = await Token.findOne().sort({ createdAt: -1 });

  if (!token) {
    throw new Error("Token não encontrado no MongoDB");
  }

  return token.access_token;
}

/* =======================
   Middlewares
======================= */
app.use(cors());
app.use(express.json());


/* =======================
   Rotas básicas
======================= */
app.get("/ping", (req, res) => {
  res.send("pong");
});

/* =======================
   OAuth Login
======================= */
app.get("/oauth/login", (req, res) => {
  const state = Math.random().toString(36).substring(2);

  const authUrl =
    `https://auth.mercadolivre.com.br/authorization` +
    `?response_type=code` +
    `&client_id=${process.env.ML_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}` +
    `&state=${state}`;

  res.redirect(authUrl);
});

/* =======================
   OAuth Callback
======================= */
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Código OAuth não recebido");
  }

  try {
    const response = await axios.post(
      "https://api.mercadolibre.com/oauth/token",
      {
        grant_type: "authorization_code",
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code,
        redirect_uri: process.env.ML_REDIRECT_URI
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const expiresAt = Date.now() + response.data.expires_in * 1000;

    // Remove token antigo
    await Token.deleteMany({});

    // Salva novo token
    await Token.create({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: expiresAt,
      user_id: response.data.user_id
    });

    console.log("✅ TOKEN SALVO NO MONGODB COM SUCESSO");

    res.send("Autorização concluída! Pode fechar esta página.");

  } catch (err) {
    console.error("❌ ERRO OAUTH:", err.response?.data || err.message);
    res.status(500).send("Erro no OAuth");
  }
});

/* =======================
   Mercado Livre - Usuário
======================= */
app.get("/ml/me", async (req, res) => {
  try {
    const accessToken = await getToken();

    const response = await axios.get(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("Erro ao buscar usuário:", err.message);
    res.status(500).json({
      error: "Erro ao buscar usuário Mercado Livre",
      details: err.message
    });
  }
});


/* =======================
   Mercado Livre - Pedidos
======================= */
app.get('/ml/orders', async (req, res) => {
  try {
    const accessToken = await getToken();

    const userResponse = await axios.get(
      'https://api.mercadolibre.com/users/me',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const buyerId = userResponse.data.id;

    const ordersResponse = await axios.get(
      `https://api.mercadolibre.com/orders/search?buyer=${buyerId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    res.json(ordersResponse.data);

  } catch (err) {
    console.error('Erro ao buscar compras:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erro ao buscar compras do Mercado Livre',
      details: err.message
    });
  }
});

app.get("/entregas", async (req, res) => {
  try {
    const statusFiltro = req.query.status;

    /* =======================
       1️⃣ VERIFICA CACHE
    ======================= */
    const cache = await Entrega.find().sort({ data_compra: -1 });

    if (cache.length > 0) {
      const cacheAge = Date.now() - new Date(cache[0].updatedAt).getTime();

      if (cacheAge < CACHE_TTL) {
        console.log("📦 Cache válido, retornando MongoDB");

        let entregasCache = cache;

        if (statusFiltro) {
          entregasCache = entregasCache.filter(e => {
            if (statusFiltro === "delivered") return e.status_entrega === "delivered";
            if (statusFiltro === "shipped") {
              return ["shipped", "ready_to_ship", "handling"].includes(e.status_entrega);
            }
            if (statusFiltro === "not_delivered") return e.status_entrega !== "delivered";
            return true;
          });
        }

        return res.json(entregasCache);
      }
    }

    console.log("🌐 Cache vencido, buscando na API");

    /* =======================
       2️⃣ TOKEN + PEDIDOS
    ======================= */
    const accessToken = await getToken();

    const userResponse = await axios.get(
      "https://api.mercadolibre.com/users/me",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const buyerId = userResponse.data.id;

    const ordersResponse = await axios.get(
      `https://api.mercadolibre.com/orders/search?buyer=${buyerId}&sort=date_desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    /* =======================
       3️⃣ FUNÇÃO GOOGLE IMAGES (SERPAPI)
    ======================= */
    async function buscarImagemGoogle(produto) {
      try {
        const response = await axios.get("https://serpapi.com/search.json", {
          params: {
            engine: "google_images",
            q: produto,
            api_key: process.env.SERPAPI_KEY,
            num: 1
          }
        });

        return response.data.images_results?.[0]?.original || null;

      } catch (err) {
        console.warn("⚠️ Falha ao buscar imagem:", produto);
        return null;
      }
    }

    /* =======================
       4️⃣ MAPEIA ENTREGAS
    ======================= */
    const entregas = await Promise.all(
      ordersResponse.data.results.map(async (order) => {
        const item = order.order_items?.[0]?.item;
        const produto = item?.title || "Produto não identificado";

        let statusEntrega = "não informado";
        let dataEntrega = null;
        let rastreio = null;
        let transportadora = "Mercado Envios";

        /* 📦 SHIPMENT */
        if (order.shipping?.id) {
          try {
            const shipment = await axios.get(
              `https://api.mercadolibre.com/shipments/${order.shipping.id}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            statusEntrega = shipment.data.status || statusEntrega;
            dataEntrega = shipment.data.delivered_at || null;
            rastreio = shipment.data.tracking_number || null;
            transportadora =
              shipment.data.shipping_option?.name || transportadora;
          } catch {}
        }

        /* 🖼️ IMAGEM GOOGLE (GARANTIDA) */
        const image = await buscarImagemGoogle(produto);

        return {
          pedido_id: order.id,
          produto,
          image, // ✅ AGORA SEMPRE VEM (ou fallback no front)
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

    /* =======================
       5️⃣ ATUALIZA CACHE
    ======================= */
    await Entrega.deleteMany({});
    await Entrega.insertMany(entregas);

    console.log("💾 Cache atualizado com imagens do Google");

    res.json(entregas);

  } catch (err) {
    console.error("❌ ERRO /entregas:", err.message);
    res.status(500).json({
      error: "Erro ao buscar entregas",
      details: err.message
    });
  }
});


app.get("/entregas/cache", async (req, res) => {
  try {
    const entregas = await Entrega.find().sort({ data_compra: -1 });
    res.json(entregas);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao buscar entregas do cache",
      details: err.message
    });
  }
});

app.get("/public/entregas", async (req, res) => {
  try {
    const entregas = await Entrega.find().sort({ data_compra: -1 });
    res.json(entregas);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao buscar entregas públicas",
      details: err.message
    });
  }
});

const startCron = require("./src/cron/updateEntregas");
startCron();

/* =======================
   Server
======================= */
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
