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
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const PER_PAGE = 10;
    const skip = (page - 1) * PER_PAGE;

    const statusFiltro = req.query.status;

    /* =======================
       1️⃣ CACHE
    ======================= */
    const cache = await Entrega.find().sort({ data_compra: -1 });

    if (cache.length > 0) {
      const cacheAge = Date.now() - new Date(cache[0].updatedAt).getTime();

      if (cacheAge < CACHE_TTL) {
        console.log("📦 Cache válido, retornando MongoDB (paginado)");

        let entregasCache = cache;

        if (statusFiltro) {
          entregasCache = entregasCache.filter(e => {
            if (statusFiltro === "delivered") return e.status_entrega === "delivered";
            if (statusFiltro === "shipped")
              return ["shipped", "ready_to_ship", "handling"].includes(e.status_entrega);
            if (statusFiltro === "not_delivered")
              return e.status_entrega !== "delivered";
            return true;
          });
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

    console.log("🌐 Cache vencido, buscando na API");

    /* =======================
       2️⃣ TOKEN + ORDERS
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
       3️⃣ GOOGLE IMAGES
    ======================= */
    async function buscarImagemGoogle(produto) {
      try {
        const response = await axios.get("https://serpapi.com/search.json", {
          params: {
            engine: "google_images",
            q: produto,
            api_key: process.env.SERPAPI_KEY,
            ijn: 0
          },
          timeout: 20000
        });

        return (
          response.data.images_results?.[0]?.original ||
          response.data.images_results?.[0]?.thumbnail ||
          null
        );
      } catch {
        return null;
      }
    }

    /* =======================
       4️⃣ MAPEAMENTO + DEDUP
    ======================= */
    const entregasMap = new Map();

    for (const order of ordersResponse.data.results) {
      if (entregasMap.has(order.id)) continue;

      const orderItem = order.order_items?.[0];
      const item = orderItem?.item;

      const produto = item?.title || "Produto não identificado";
      const quantidade = Number(orderItem?.quantity ?? 1);

      let statusEntrega = "não informado";
      let dataEntrega = null;
      let rastreio = null;
      let transportadora = "Mercado Envios";

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

      const cachedEntrega = cache.find(c => c.pedido_id === order.id);

      /* 🖼️ IMAGEM */
      let image = cachedEntrega?.image ?? null;
      if (!image) image = await buscarImagemGoogle(produto);

      /* 🏪 VENDEDOR REAL (ETIQUETA DO ML) */
      let vendedor =
        orderItem?.seller?.nickname ||
        order.seller?.nickname ||
        cachedEntrega?.vendedor ||
        null;

      if (!vendedor && item?.seller_id) {
        try {
          const sellerResponse = await axios.get(
            `https://api.mercadolibre.com/users/${item.seller_id}`
          );
          vendedor = sellerResponse.data.nickname;
        } catch {}
      }

      if (!vendedor) vendedor = "Vendedor não identificado";

      entregasMap.set(order.id, {
        pedido_id: order.id,
        produto,
        image,
        quantidade,
        vendedor,
        status_pedido: order.status,
        valor: order.total_amount,
        data_compra: order.date_created,
        status_entrega: statusEntrega,
        data_entrega: dataEntrega,
        transportadora,
        rastreio
      });
    }

    const entregasUnicas = Array.from(entregasMap.values());

    /* =======================
       5️⃣ ATUALIZA CACHE (FORÇANDO CAMPOS)
    ======================= */
    await Entrega.deleteMany({});

    await Entrega.insertMany(
      entregasUnicas.map(e => ({
        pedido_id: e.pedido_id,
        produto: e.produto,
        image: e.image,
        quantidade: e.quantidade,
        vendedor: e.vendedor,
        status_pedido: e.status_pedido,
        valor: e.valor,
        data_compra: e.data_compra,
        status_entrega: e.status_entrega,
        data_entrega: e.data_entrega,
        transportadora: e.transportadora,
        rastreio: e.rastreio
      }))
    );

    const total = entregasUnicas.length;
    const totalPages = Math.ceil(total / PER_PAGE);
    const paginated = entregasUnicas.slice(skip, skip + PER_PAGE);

    console.log("💾 Cache atualizado com vendedor REAL, quantidade e imagens");

    res.json({
      page,
      perPage: PER_PAGE,
      total,
      totalPages,
      data: paginated
    });

  } catch (err) {
    console.error("❌ ERRO /entregas:", err.message);
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
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const PER_PAGE = 10;
    const skip = (page - 1) * PER_PAGE;

    const total = await Entrega.countDocuments();

    const entregas = await Entrega.find()
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
