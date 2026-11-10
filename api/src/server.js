// Servidor da API: recebe os pedidos da tela e responde.
import express from 'express';
import { consultarSql, BASE } from './sankhya.js';
import { buscarProdutoPorCodigo } from './produtos.js';
import { listarCargas, listarItensDaCarga } from './cargas.js';
import { contagemDaCarga, registrarBipagem } from './conferencia.js';

const app = express();
const PORTA = 3000;

// Mostra as telas da pasta web (cargas.html, conferencia.html...)
app.use(express.static('../web'));

// Entende pedidos que chegam com dados em JSON (os POST)
app.use(express.json());

// Devolve a data de X dias atrás no formato AAAA-MM-DD
function diasAtras(dias) {
  const data = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  return data.toISOString().slice(0, 10);
}

// Teste rápido: a API está viva?
app.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'API funcionando' });
});

// Teste rápido: a conexão com o banco do Sankhya funciona?
app.get('/sankhya/teste-sql', async (req, res) => {
  try {
    const linhas = await consultarSql('SELECT SYSDATE AS AGORA FROM DUAL');
    res.json({ ok: true, linhas });
  } catch (erro) {
    console.error('Erro no teste de SQL:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Busca um produto pelo código (código interno, referência ou código de barras)
app.get('/produtos/:codigo', async (req, res) => {
  const codigo = req.params.codigo;

  // Só aceita letras, números, ponto, barra e hífen
  if (!/^[A-Za-z0-9./-]{1,60}$/.test(codigo)) {
    return res.status(400).json({ ok: false, erro: 'Código inválido.' });
  }

  try {
    const produtos = await buscarProdutoPorCodigo(codigo);

    if (produtos.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Produto não encontrado.' });
    }

    res.json({ ok: true, produtos });
  } catch (erro) {
    console.error('Erro ao buscar produto:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Lista as cargas de um período, ou uma carga pelo número
app.get('/cargas', async (req, res) => {
  const de = req.query.de || diasAtras(7);
  const ate = req.query.ate || diasAtras(0);
  const numero = req.query.numero || '';

  const formatoData = /^\d{4}-\d{2}-\d{2}$/;
  if (!formatoData.test(de) || !formatoData.test(ate)) {
    return res.status(400).json({ ok: false, erro: 'Data inválida. Use o formato AAAA-MM-DD.' });
  }

  if (numero && !/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  try {
    const cargas = await listarCargas({ de, ate, numero });
    res.json({ ok: true, base: BASE, de, ate, cargas });
  } catch (erro) {
    console.error('Erro ao listar cargas:', erro);
    res.status(500).json({ ok: false, erro: erro.message, motivo: erro.cause?.message });
  }
});

// Itens (produtos) de uma carga: o que tem que ir no caminhão
app.get('/cargas/:numero/itens', async (req, res) => {
  const numero = req.params.numero;

  // Só aceita números (protege contra SQL injection)
  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  try {
    const itens = await listarItensDaCarga(numero);
    res.json({ ok: true, base: BASE, carga: numero, itens });
  } catch (erro) {
    console.error('Erro ao listar itens da carga:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Conferência de uma carga: o que tem que ir, o que já foi bipado e o que falta
app.get('/cargas/:numero/conferencia', async (req, res) => {
  const numero = req.params.numero;

  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  try {
    const itens = await listarItensDaCarga(numero); // do Sankhya (ou falsos)
    const contagem = contagemDaCarga(numero);       // do nosso banco

    const resultado = itens.map((item) => {
      const achado = contagem.find((linha) => Number(linha.codprod) === Number(item.CODPROD));
      const conferido = achado ? Number(achado.conferido) : 0;
      return { ...item, CONFERIDO: conferido, FALTA: item.QTDESPERADA - conferido };
    });

    res.json({ ok: true, base: BASE, carga: numero, itens: resultado });
  } catch (erro) {
    console.error('Erro ao montar a conferência:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Recebe uma bipagem: { "codigo": "2000000000101", "quantidade": 10 }
app.post('/cargas/:numero/bipagens', async (req, res) => {
  const numero = req.params.numero;
  const codigo = String(req.body?.codigo ?? '').trim();
  const quantidade = Number(req.body?.quantidade ?? 1);

  // Confere tudo o que chegou antes de usar
  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }
  if (!/^[A-Za-z0-9./-]{1,60}$/.test(codigo)) {
    return res.status(400).json({ ok: false, erro: 'Código inválido.' });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 9999) {
    return res.status(400).json({ ok: false, erro: 'Quantidade inválida.' });
  }

  try {
    // 1. Que produto é esse código?
    const produtos = await buscarProdutoPorCodigo(codigo);
    if (produtos.length === 0) {
      return res.status(404).json({ ok: false, erro: 'Produto não encontrado.' });
    }

    // 2. Esse produto é desta carga?
    const itens = await listarItensDaCarga(numero);
    const produto = produtos.find((p) =>
      itens.some((item) => Number(item.CODPROD) === Number(p.CODPROD))
    );
    if (!produto) {
      return res.status(400).json({ ok: false, erro: 'Este produto não é desta carga.' });
    }

    // 3. Guarda no nosso banco
    registrarBipagem({
      carga: Number(numero),
      codprod: Number(produto.CODPROD),
      quantidade,
      codigoLido: codigo,
    });

    res.status(201).json({ ok: true, codprod: produto.CODPROD, descricao: produto.DESCRPROD, quantidade });
  } catch (erro) {
    console.error('Erro ao registrar bipagem:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Liga o servidor
app.listen(PORTA, (erro) => {
  if (erro) {
    console.error('Não foi possível ligar o servidor:', erro);
    return;
  }
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});