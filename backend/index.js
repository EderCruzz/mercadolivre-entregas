require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qs = require('querystring');

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
const REDIRECT_URI =
  'https://unuseful-jordyn-undeliriously.ngrok-free.dev/oauth/callback';


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
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Code não recebido');
  }

  try {
    const response = await axios.post(
      'https://api.mercadolibre.com/oauth/token',
      qs.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('ACCESS TOKEN:', response.data.access_token);
    res.send('Autorização concluída! Pode fechar esta página.');
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.status(500).send('Erro no OAuth');
  }
});


app.listen(3333, () => {
  console.log('🚀 Backend rodando em http://localhost:3333');
});

