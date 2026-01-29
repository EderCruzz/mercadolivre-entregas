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
    if (err.response?.status === 429) {
      console.warn("⚠️ SerpAPI: limite atingido");
      return null;
    }

    console.error("Erro Google Images:", err.message);
    return null;
  }
}

async function buscarPrevisaoEntrega(shippingId, accessToken) {
  if (!shippingId) return null;

  try {
    const response = await axios.get(
      `https://api.mercadolibre.com/shipments/${shippingId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    return (
      response.data?.promised_delivery_time?.date ||
      response.data?.estimated_delivery_time?.date ||
      response.data?.estimated_delivery_time?.to ||
      null
    );

  } catch (err) {
    console.warn("⚠️ Erro ao buscar previsão de entrega:", shippingId);
    return null;
  }
}

async function buscarDetalhePedido(orderId, accessToken) {
  try {
    const response = await axios.get(
      `https://api.mercadolibre.com/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    return response.data;
  } catch (err) {
    console.warn("⚠️ Erro ao buscar detalhe do pedido:", orderId);
    return null;
  }
}

app.get("/entregas/sync", async (req, res) => {
  try {
    /* =======================
       1️⃣ CACHE ATUAL
    ======================= */
    const cache = await Entrega.find();

    /* =======================
       2️⃣ API MERCADO LIVRE
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

    const entregasMap = new Map();

    const hoje = new Date();
    const limiteBuscaImagem = new Date();
    limiteBuscaImagem.setDate(hoje.getDate() - 20);

    for (const order of ordersResponse.data.results) {
      const cachedEntrega = cache.find(c => c.pedido_id === order.id);
      const item = order.order_items?.[0];

      const produto = item?.item?.title || "Produto não identificado";

      const vendedor =
        item?.seller?.nickname ||
        order.seller?.nickname ||
        cachedEntrega?.vendedor ||
        "Vendedor não identificado";

      let image = cachedEntrega?.image ?? null;

      if (!image && item?.item?.thumbnail) {
        image = item.item.thumbnail;
      }

      const dataCompra = new Date(order.date_created);

      const podeBuscarImagem =
        dataCompra >= limiteBuscaImagem && !cachedEntrega?.image && !image;

      if (podeBuscarImagem) {
        image = await buscarImagemGoogle(produto);
      }

      entregasMap.set(order.id, {
        pedido_id: order.id,
        produto,
        image,
        quantidade: item?.quantity ?? 1,
        vendedor,
        centro_custo: cachedEntrega?.centro_custo ?? null,
        palavra_chave: cachedEntrega?.palavra_chave ?? null,
        conferente: cachedEntrega?.conferente ?? null,
        data_recebimento: cachedEntrega?.data_recebimento ?? null,
        status_pedido: order.status,
        data_compra: order.date_created
      });
    }

    const entregasUnicas = Array.from(entregasMap.values());

    /* =======================
       3️⃣ ATUALIZA MONGO
       ⚠️ NÃO TOCA EM previsao_entrega
    ======================= */
    await Entrega.bulkWrite(
      entregasUnicas.map(e => ({
        updateOne: {
          filter: { pedido_id: e.pedido_id },
          update: {
            $set: {
              produto: e.produto,
              quantidade: e.quantidade,
              centro_custo: e.centro_custo,
              conferente: e.conferente,
              data_recebimento: e.data_recebimento,
              status_pedido: e.status_pedido,
              data_compra: e.data_compra,
              vendedor: e.vendedor,
              image: e.image,
              palavra_chave: e.palavra_chave
            }
          },
          upsert: true
        }
      }))
    );

    res.json({
      message: "Entregas sincronizadas com sucesso",
      total: entregasUnicas.length
    });

  } catch (err) {
    console.error("❌ ERRO /entregas/sync:", err);
    res.status(500).json({ error: "Erro ao sincronizar entregas" });
  }
});

app.get("/entregas", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const PER_PAGE = 20;
    const skip = (page - 1) * PER_PAGE;
    const view = req.query.view;

    let filtro = {};

    if (view === "triagem") {
      filtro = { centro_custo: null };
    }

    if (view === "classificados") {
      filtro = {
        centro_custo: { $ne: null },
        conferente: null
      };
    }

    if (view === "entregues") {
      filtro = { conferente: { $ne: null } };
    }

    const total = await Entrega.countDocuments(filtro);

    const entregas = await Entrega.find(filtro)
      .sort({ data_compra: -1 })
      .skip(skip)
      .limit(PER_PAGE);

    res.json({
      page,
      perPage: PER_PAGE,
      total,
      totalPages: Math.ceil(total / PER_PAGE),
      data: entregas
    });

  } catch (err) {
    console.error(err);
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

app.put("/entregas/:pedido_id/recebimento", async (req, res) => {
  try {
    const { pedido_id } = req.params;
    const { conferente } = req.body;

    if (!conferente || !conferente.trim()) {
      return res.status(400).json({ error: "Conferente obrigatório" });
    }

    const entrega = await Entrega.findOneAndUpdate(
      { pedido_id: Number(pedido_id) },
      {
        conferente: conferente.trim(),
        data_recebimento: new Date()
      },
      { new: true }
    );

    if (!entrega) {
      return res.status(404).json({ error: "Entrega não encontrada" });
    }

    res.json(entrega);

  } catch (err) {
    console.error("Erro ao confirmar recebimento:", err);
    res.status(500).json({ error: "Erro ao confirmar recebimento" });
  }
});

app.put("/entregas/:pedido_id/previsao-entrega", async (req, res) => {
  try {
    const { pedido_id } = req.params;
    const { previsao_entrega } = req.body;

    if (!previsao_entrega) {
      return res.status(400).json({
        error: "Previsão de entrega é obrigatória"
      });
    }

    const entrega = await Entrega.findOneAndUpdate(
      { pedido_id: Number(pedido_id) },
      { previsao_entrega: new Date(previsao_entrega) },
      { new: true }
    );

    if (!entrega) {
      return res.status(404).json({
        error: "Entrega não encontrada"
      });
    }

    res.json(entrega);

  } catch (err) {
    console.error("Erro ao salvar previsão de entrega:", err);
    res.status(500).json({
      error: "Erro ao salvar previsão de entrega"
    });
  }
});

app.put("/entregas/:pedido_id/palavra-chave", async (req, res) => {
  try {
    const { pedido_id } = req.params;
    const { palavra_chave } = req.body;

    if (!palavra_chave || !palavra_chave.trim()) {
      return res.status(400).json({
        error: "Palavra-chave é obrigatória"
      });
    }

    const entrega = await Entrega.findOneAndUpdate(
      { pedido_id: Number(pedido_id) },
      { palavra_chave: palavra_chave.trim() },
      { new: true }
    );

    if (!entrega) {
      return res.status(404).json({
        error: "Entrega não encontrada"
      });
    }

    res.json({
      message: "Palavra-chave salva com sucesso",
      entrega
    });

  } catch (err) {
    console.error("Erro ao salvar palavra-chave:", err);
    res.status(500).json({
      error: "Erro ao salvar palavra-chave"
    });
  }
});

// const startCron = require("./src/cron/updateEntregas");
// startCron();

/* =======================
   Server
======================= */
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
