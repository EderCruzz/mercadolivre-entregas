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


// const CACHE_TTL = 1000 * 60 * 1440; // 1 dia

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
  try {
    const res = await axios.get(
      `https://api.mercadolibre.com/shipments/${shippingId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    return (
      res.data.promised_delivery_date ||
      res.data.estimated_delivery_date?.date ||
      null
    );
  } catch (err) {
    console.warn("⚠️ Erro ao buscar previsão de entrega:", err.message);
    return null;
  }
}

app.get("/entregas", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const PER_PAGE = 20;
    const skip = (page - 1) * PER_PAGE;

    const centroCustoFiltro = req.query.centro_custo;
    const recebidoFiltro = req.query.recebido;

    /* =======================
       1️⃣ CACHE (somente leitura, sem TTL)
    ======================= */
    const cache = await Entrega.find().sort({ data_compra: -1 });

    /* =======================
       1️⃣ CACHE
    ======================= */

    /*
    const cache = await Entrega.find().sort({ data_compra: -1 });

    if (cache.length > 0) {
      const cacheAge = Date.now() - new Date(cache[0].updatedAt).getTime();

      if (cacheAge < CACHE_TTL) {
        let entregasCache = cache;

        if (centroCustoFiltro === "pendente") {
          entregasCache = entregasCache.filter(e => !e.centro_custo);
        }

        if (centroCustoFiltro === "definido") {
          entregasCache = entregasCache.filter(e => e.centro_custo);
        }

        if (recebidoFiltro === "sim") {
          entregasCache = entregasCache.filter(e => e.conferente);
        }

        if (recebidoFiltro === "nao") {
          entregasCache = entregasCache.filter(e => !e.conferente);
        }

        const total = entregasCache.length;
        const totalPages = Math.ceil(total / PER_PAGE);
        const paginated = entregasCache.slice(skip, skip + PER_PAGE);

        return res.json({
          page,
          perPage: PER_PAGE,
          total,
          totalPages,
          data: paginated
        });
      }
    }
      */

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
    limiteBuscaImagem.setDate(hoje.getDate() - 40);

    for (const order of ordersResponse.data.results) {
      const cachedEntrega = cache.find(c => c.pedido_id === order.id);
      const item = order.order_items?.[0];

      const produto = item?.item?.title || "Produto não identificado";

      /* 🏪 VENDEDOR (fallback forte) */
      const vendedor =
        item?.seller?.nickname ||
        order.seller?.nickname ||
        cachedEntrega?.vendedor ||
        "Vendedor não identificado";

      /* 🖼️ IMAGEM (preserva cache, mas não perde) */
      let image = cachedEntrega?.image ?? null;

      // Thumbnail do Mercado Livre
      if (!image && item?.item?.thumbnail) {
        image = item.item.thumbnail;
      }

      // 🔒 Busca no Google SÓ se nunca teve imagem antes
      const dataCompra = new Date(order.date_created);

      const podeBuscarImagem =
        dataCompra >= limiteBuscaImagem && !cachedEntrega?.image && !image;

      if (podeBuscarImagem) {
        image = await buscarImagemGoogle(produto);
      }

      /* 📦 PREVISÃO DE ENTREGA */
      const shippingId = order.shipping?.id;
      let previsao_entrega = cachedEntrega?.previsao_entrega ?? null;

      // busca só se ainda não existir no cache
      if (!previsao_entrega && shippingId) {
        previsao_entrega = await buscarPrevisaoEntrega(
          shippingId,
          accessToken
        );
      }

      entregasMap.set(order.id, {
        pedido_id: order.id,
        produto,
        image,
        quantidade: item?.quantity ?? 1,
        vendedor,
        centro_custo: cachedEntrega?.centro_custo ?? null,
        conferente: cachedEntrega?.conferente ?? null,
        data_recebimento: cachedEntrega?.data_recebimento ?? null,
        previsao_entrega, // 👈 NOVO CAMPO
        status_pedido: order.status,
        data_compra: order.date_created
      });
    }

    const entregasUnicas = Array.from(entregasMap.values());

    /* =======================
   FILTRO POR ABA (VIEW)
    ======================= */
    const view = req.query.view;

    let entregasFiltradas = entregasUnicas;

    if (view === "triagem") {
      entregasFiltradas = entregasUnicas.filter(e => !e.centro_custo);
    }

    if (view === "classificados") {
      entregasFiltradas = entregasUnicas.filter(
        e => e.centro_custo && !e.conferente
      );
    }

    if (view === "entregues") {
      entregasFiltradas = entregasUnicas.filter(e => e.conferente);
    }

    /* =======================
       3️⃣ ATUALIZA CACHE
    ======================= */
    await Entrega.bulkWrite(
      entregasUnicas.map(e => {
        const update = {
          pedido_id: e.pedido_id,
          produto: e.produto,
          quantidade: e.quantidade,
          centro_custo: e.centro_custo,
          conferente: e.conferente,
          data_recebimento: e.data_recebimento,
          status_pedido: e.status_pedido,
          data_compra: e.data_compra,
          previsao_entrega: e.previsao_entrega // 👈 AQUI
        };

        // ✅ SÓ atualiza imagem se NÃO for null
        if (e.image) {
          update.image = e.image;
        }

        // ✅ SÓ atualiza vendedor se NÃO for null
        if (e.vendedor) {
          update.vendedor = e.vendedor;
        }

        return {
          updateOne: {
            filter: { pedido_id: e.pedido_id },
            update: { $set: update },
            upsert: true
          }
        };
      })
    );

    res.json({
      page,
      perPage: PER_PAGE,
      total: entregasFiltradas.length,
      totalPages: Math.ceil(entregasFiltradas.length / PER_PAGE),
      data: entregasFiltradas.slice(skip, skip + PER_PAGE)
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

// const startCron = require("./src/cron/updateEntregas");
// startCron();

/* =======================
   Server
======================= */
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
