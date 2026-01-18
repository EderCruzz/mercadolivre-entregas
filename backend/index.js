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

async function buscarImagemGoogle(produto) {
  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google_images",
        q: produto,
        api_key: process.env.SERPAPI_KEY,
        ijn: 0
      },
      timeout: 15000
    });

    return (
      response.data.images_results?.[0]?.original ||
      response.data.images_results?.[0]?.thumbnail ||
      null
    );
  } catch (err) {
    console.error("Erro Google Images:", err.message);
    return null;
  }
}

app.get("/entregas", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const PER_PAGE = 10;
    const skip = (page - 1) * PER_PAGE;

    const centroCustoFiltro = req.query.centro_custo;
    const recebidoFiltro = req.query.recebido;

    /* =======================
       1️⃣ CACHE BASE
    ======================= */
    const cache = await Entrega.find().sort({ data_compra: -1 });

    let entregasBase = cache;

    if (centroCustoFiltro === "pendente") {
      entregasBase = entregasBase.filter(e => !e.centro_custo);
    }

    if (centroCustoFiltro === "definido") {
      entregasBase = entregasBase.filter(e => e.centro_custo);
    }

    if (recebidoFiltro === "sim") {
      entregasBase = entregasBase.filter(e => e.conferente);
    }

    if (recebidoFiltro === "nao") {
      entregasBase = entregasBase.filter(e => !e.conferente);
    }

    /* =======================
       2️⃣ GARANTE DADOS CRÍTICOS
    ======================= */
    const accessToken = await getToken();

    for (const entrega of entregasBase) {
      let precisaSalvar = false;

      // 🔹 VENDEDOR
      if (!entrega.vendedor) {
        try {
          const orderRes = await axios.get(
            `https://api.mercadolibre.com/orders/${entrega.pedido_id}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          entrega.vendedor =
            orderRes.data.order_items?.[0]?.seller?.nickname ||
            orderRes.data.seller?.nickname ||
            "Vendedor não identificado";

          precisaSalvar = true;
        } catch {}
      }

      // 🔹 IMAGEM
      if (!entrega.image) {
        let image = null;

        try {
          const orderRes = await axios.get(
            `https://api.mercadolibre.com/orders/${entrega.pedido_id}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          image = orderRes.data.order_items?.[0]?.item?.thumbnail || null;
        } catch {}

        if (!image) {
          image = await buscarImagemGoogle(entrega.produto);
        }

        entrega.image = image;
        precisaSalvar = true;
      }

      if (precisaSalvar) {
        await Entrega.updateOne(
          { _id: entrega._id },
          { $set: { image: entrega.image, vendedor: entrega.vendedor } }
        );
      }
    }

    const total = entregasBase.length;
    const totalPages = Math.ceil(total / PER_PAGE);
    const paginated = entregasBase.slice(skip, skip + PER_PAGE);

    res.json({
      page,
      perPage: PER_PAGE,
      total,
      totalPages,
      data: paginated
    });

  } catch (err) {
    console.error("❌ ERRO /entregas:", err);
    res.status(500).json({ error: "Erro ao buscar entregas" });
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

app.patch("/entregas/:id/centro-custo", async (req, res) => {
  try {
    const { id } = req.params;
    const { centro_custo } = req.body;

    if (!centro_custo) {
      return res.status(400).json({ error: "Centro de custo obrigatório" });
    }

    const entrega = await Entrega.findByIdAndUpdate(
      id,
      { centro_custo },
      { new: true }
    );

    res.json(entrega);
  } catch (err) {
    res.status(500).json({
      error: "Erro ao salvar centro de custo",
      details: err.message
    });
  }
});

app.put("/entregas/:pedido_id/centro-custo", async (req, res) => {
  try {
    const { pedido_id } = req.params;
    const { centro_custo } = req.body;

    if (!centro_custo || !centro_custo.trim()) {
      return res.status(400).json({
        error: "Centro de custo é obrigatório"
      });
    }

    const entrega = await Entrega.findOneAndUpdate(
      { pedido_id: Number(pedido_id) },
      { centro_custo: centro_custo.trim() },
      { new: true }
    );

    if (!entrega) {
      return res.status(404).json({
        error: "Entrega não encontrada"
      });
    }

    res.json({
      message: "Centro de custo salvo com sucesso",
      entrega
    });

  } catch (err) {
    console.error("Erro ao salvar centro de custo:", err);
    res.status(500).json({
      error: "Erro ao salvar centro de custo"
    });
  }
});

app.put("/entregas/:id/recebimento", async (req, res) => {
  try {
    const { conferente } = req.body;

    if (!conferente) {
      return res.status(400).json({ error: "Conferente obrigatório" });
    }

    const entrega = await Entrega.findByIdAndUpdate(
      req.params.id,
      {
        conferente,
        data_recebimento: new Date()
      },
      { new: true }
    );

    res.json(entrega);
  } catch (err) {
    res.status(500).json({ error: "Erro ao confirmar recebimento" });
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
