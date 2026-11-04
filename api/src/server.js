import express from 'express';

const app = express();
const PORTA = 3000;

// Rota de teste: responde quando alguém acessa /status
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'API do WMS funcionando!' });
});

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});