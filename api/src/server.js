import express from 'express';
import { fazerLogin } from './sankhya.js';

const app = express();
const PORTA = 3000;

// Rota de teste: responde quando alguém acessa /status
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'API do WMS funcionando!' });
});

// Rota de teste do login no Sankhya
app.get('/sankhya/teste', async (req, res) => {
  try {
    const dados = await fazerLogin();
    // Mostra só os NOMES dos campos, nunca o token em si
    res.json({ ok: true, camposRecebidos: Object.keys(dados) });
  } catch (erro) {
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Liga o servidor (deve ficar sempre no final do arquivo)
app.listen(PORTA, (erro) => {
  if (erro) {
    console.error('Não foi possível ligar o servidor:', erro.message);
    return;
  }
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});