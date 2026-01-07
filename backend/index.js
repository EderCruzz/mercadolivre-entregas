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
   Utils
======================= */
async function getToken() {
  const token = await Token.findOne().sort({ createdAt: -1 });

  if (!token) {
    throw new Error("Token não encontrado. Faça o login OAuth novamente.");
  }

  if (Date.now() > token.expires_at) {
    throw new Error("Token expirado. Faça o login OAuth novamente.");
  }

  return token.access_token;
}


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
    // 1️⃣ Busca token no MongoDB
    const tokenDoc = await Token.findOne();
    if (!tokenDoc) {
      return res.status(401).json({ error: 'Token não encontrado' });
    }

    const accessToken = tokenDoc.access_token;

    // 2️⃣ Descobre quem é o usuário (buyer)
    const userResponse = await axios.get(
      'https://api.mercadolibre.com/users/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const buyerId = userResponse.data.id;

    // 3️⃣ Busca COMPRAS (orders como comprador)
    const ordersResponse = await axios.get(
      `https://api.mercadolibre.com/orders/search?buyer=${buyerId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    res.json(ordersResponse.data);

  } catch (err) {
    console.error('Erro ao buscar compras:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erro ao buscar compras do Mercado Livre',
      details: err.response?.data || err.message
    });
  }
});


app.get("/entregas", async (req, res) => {
  try {
    const statusFiltro = req.query.status;

    const tokenDoc = await Token.findOne();
    if (!tokenDoc) {
      return res.status(401).json({ error: "Token não encontrado" });
    }

    const accessToken = tokenDoc.access_token;

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

    let entregas = ordersResponse.data.results.map(order => {
      const item = order.order_items?.[0]?.item;

      // 🎯 Heurística realista
      let statusEntrega = "em processamento";

      if (order.status === "paid") {
        const dias = (Date.now() - new Date(order.date_created)) / (1000 * 60 * 60 * 24);
        statusEntrega = dias > 7 ? "provavelmente entregue" : "em transporte";
      }

      if (order.status === "cancelled") {
        statusEntrega = "cancelado";
      }

      return {
        pedido_id: order.id,

        produto: item?.title || "Produto não identificado",

        imagem:
          item?.pictures?.[0]?.secure_url ||
          item?.thumbnail ||
          null,

        vendedor: order.seller?.nickname || "Vendedor",

        palavra_chave:
          order.tags?.find(t => t.startsWith("keyword_"))
            ?.replace("keyword_", "") ||
          null,

        status_pedido: order.status,

        status_entrega: statusEntrega,

        data_compra: order.date_created,

        data_entrega:
          shipmentResponse?.data?.date_delivered || null,

        transportadora,

        rastreio,

        valor: order.total_amount
      };
    });

    // 🔍 Filtro
    if (statusFiltro) {
      entregas = entregas.filter(e => {
        if (statusFiltro === "delivered") return e.status_entrega === "provavelmente entregue";
        if (statusFiltro === "shipped") return e.status_entrega === "em transporte";
        if (statusFiltro === "not_delivered") return e.status_entrega !== "provavelmente entregue";
        return true;
      });
    }
    await Entrega.deleteMany({});
    await Entrega.insertMany(entregas);

    res.json(entregas);

  } catch (err) {
    console.error("Erro em /entregas:", err.message);
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
    const response = await axios.get(
      "https://mercadolivre-entregas.onrender.com/entregas"
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar entregas públicas" });
  }
});


/* =======================
   Server
======================= */
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
