import express from 'express';
import { fazerLogin, consultarSql} from './sankhya.js';

const app = express();
const PORTA = 3000;

// Rota de teste: responde quando alguém acessa /status
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'API do WMS funcionando!' });
});

// Rota de teste do login no Sankhya
app.get('/sankhya/teste-sql', async (req, res) => {
  try {
    const linhas = await consultarSql("SELECT SYSDATE AS AGORA FROM DUAL");
    res.json({ ok: true, linhas });
  } catch (erro) {
    console.error('Erro na consulta', erro);
    res.status(500).json({ 
      ok: false,
      erro: erro.message,
      motivo: erro.cause?.message
    });
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