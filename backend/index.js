require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// MOCK por enquanto
app.get('/entregas', (req, res) => {
  res.json([
    {
      id: 1,
      item: 'Monitor LG 27"',
      status: 'Saiu para entrega',
      previsao: '2026-01-08',
      palavraChave: 'PORTARIA',
      rastreio: 'BR123456789'
    }
  ]);
});

const axios = require('axios');

const CLIENT_ID = process.env.ML_CLIENT_ID;
const CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REDIRECT_URI = 'https://mercadolivre-entregas.onrender.com/oauth/callback';

// TESTE SIMPLES (diagnóstico)
app.get('/ping', (req, res) => {
  res.send('pong');
});

// LOGIN OAUTH
app.get('/oauth/login', (req, res) => {
  const state = Math.random().toString(36).substring(2);

  const authUrl =
    `https://auth.mercadolivre.com.br/authorization` +
    `?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// CALLBACK OAUTH

app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      'https://api.mercadolibre.com/oauth/token',
      {
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const tokenData = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      user_id: response.data.user_id,
      created_at: new Date().toISOString()
    };

    const tokenPath = path.join(__dirname, 'tokens', 'ml-token.json');

    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));

    console.log('✅ TOKEN SALVO COM SUCESSO');

    res.send('Autorização concluída! Pode fechar esta página.');

  } catch (err) {
    console.error('❌ ERRO OAUTH:', err.response?.data || err.message);
    res.status(500).send('Erro no OAuth');
  }
});

// BUSCAR PEDIDOS DO MERCADO LIVRE
app.get('/ml/orders', async (req, res) => {
  try {
    const tokenPath = path.join(__dirname, 'tokens', 'ml-token.json');

    if (!fs.existsSync(tokenPath)) {
      return res.status(401).json({
        error: 'Token não encontrado. Faça o login OAuth novamente.'
      });
    }

    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    const accessToken = tokenData.access_token;
    const userId = tokenData.user_id;

    const response = await axios.get(
      `https://api.mercadolibre.com/orders/search?seller=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    res.json(response.data);

  } catch (err) {
    console.error('❌ ERRO AO BUSCAR PEDIDOS:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Erro ao buscar pedidos do Mercado Livre'
    });
  }
});


const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});


