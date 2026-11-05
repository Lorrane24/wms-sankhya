import express from 'express';
import { consultarSql } from './sankhya.js';
import { buscarProdutoPorCodigo } from './produtos.js';

const app = express();
const PORTA = 3000;

// Rota de teste: responde quando alguém acessa /status
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'API do WMS funcionando!' });
});

// Rota de teste: pergunta a data e a hora para o banco do Sankhya
app.get('/sankhya/teste-sql', async (req, res) => {
  try {
    const linhas = await consultarSql('SELECT SYSDATE AS AGORA FROM DUAL');
    res.json({ ok: true, linhas });
  } catch (erro) {
    console.error('Erro na consulta:', erro);
    res.status(500).json({ ok: false, erro: erro.message, motivo: erro.cause?.message });
  }
});

// Busca um produto pelo código (barras, referência ou código do produto)
app.get('/produtos/:codigo', async (req, res) => {
  try {
    const codigo = req.params.codigo.trim();

    // Camada 1 de segurança: só aceita letras, números, ponto, barra e hífen
    if (!/^[A-Za-z0-9./-]{1,60}$/.test(codigo)) {
      return res.status(400).json({ ok: false, erro: 'Código inválido' });
    }

    const produtos = await buscarProdutoPorCodigo(codigo);

    if (produtos.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Produto não encontrado' });
    }

    res.json({ ok: true, produtos });
  } catch (erro) {
    console.error('Erro ao buscar produto:', erro);
    res.status(500).json({ ok: false, erro: erro.message, motivo: erro.cause?.message });
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