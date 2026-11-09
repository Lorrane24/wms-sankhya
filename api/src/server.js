import express from 'express';
import { consultarSql,BASE} from './sankhya.js';
import { buscarProdutoPorCodigo } from './produtos.js';
import { listarCargas } from './cargas.js';

const app = express();
const PORTA = 3000;

// Entrega os arquivos da pasta web (as telas)
app.use(express.static('../web'));

// Devolve a data de "tantos dias atrás", no formato AAAA-MM-DD
function diasAtras(dias) {
  const data = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return data.toISOString().slice(0, 10);
}

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

// Lista as cargas do Sankhya de um período, ou uma carga pelo número
// Exemplos: /cargas   /cargas?de=2026-11-01&ate=2026-11-09   /cargas?numero=9022
app.get('/cargas', async (req, res) => {
  try {
    const de = req.query.de || diasAtras(7);
    const ate = req.query.ate || diasAtras(0);
    const numero = req.query.numero || '';

    // Camada 1 de segurança: só aceita o formato certo
    const formatoData = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatoData.test(de) || !formatoData.test(ate)) {
      return res.status(400).json({ ok: false, erro: 'Data inválida. Use o formato AAAA-MM-DD.' });
    }
    if (numero && !/^\d{1,10}$/.test(numero)) {
      return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
    }

    const cargas = await listarCargas({ de, ate, numero });
    res.json({ ok: true, de, ate, cargas });
  } catch (erro) {
    console.error('Erro ao listar cargas:', erro);
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