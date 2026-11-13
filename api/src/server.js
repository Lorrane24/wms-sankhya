// Servidor da API: recebe os pedidos da tela e responde.
// ESTE ARQUIVO FICA EM: api/src/server.js
import express from 'express';
import { consultarSql, BASE, PODE_GRAVAR } from './sankhya.js'; // ⭐ PODE_GRAVAR
import { buscarProdutoPorCodigo } from './produtos.js';
import { listarCargas, listarItensDaCarga } from './cargas.js';
import {
  contagemDaCarga,
  registrarBipagem,
  finalizarConferencia,
  dataFinalizacao,
  finalizadaPor,
} from './conferencia.js';
import {
  registrarCorte,
  quantidadeCortada,
  listarCortes,
  marcarCorteFeito,
} from './cortes.js';
import { registrarFaturamento, situacaoFaturamento } from './faturamento.js';
import { entrar, sair, usuarioDaSessao } from './auth.js';
import { pedidosDoProduto, cortarNoSankhya } from './corte-sankhya.js'; // ⭐ cortarNoSankhya
import { faturarCargaNoSankhya, andamentoDaCarga } from './faturamento-sankhya.js'; // ⭐ faturamento real

const app = express();
const PORTA = 3000;

// Entende pedidos que chegam com dados em JSON (os POST)
app.use(express.json());

// Lê um cookie pelo nome (o navegador manda todos juntos: "a=1; b=2")
function lerCookie(req, nome) {
  const cookies = req.headers.cookie ?? '';
  for (const parte of cookies.split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// Em todo pedido: de quem é a pulseira? (null = ninguém logado)
app.use((req, res, next) => {
  req.usuario = usuarioDaSessao(lerCookie(req, 'sessao'));
  next();
});

// O que pode ser aberto SEM login
const LIVRES = ['/login.html', '/tela-login.js', '/style.css', '/login', '/status'];

// O PORTEIRO: sem login, só passa o que está na lista de livres
app.use((req, res, next) => {
  if (req.usuario || LIVRES.includes(req.path)) {
    return next();
  }

  // Pediu uma tela? Manda para o login
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    return res.redirect('/login.html');
  }

  // Pediu dados da API? Responde "sem permissão"
  return res.status(401).json({ ok: false, erro: 'Faça login para continuar.' });
});

// Mostra as telas da pasta web (cargas.html, conferencia.html...)
app.use(express.static('../web'));

// Endereço principal (localhost:3000) abre a tela de Cargas
app.get('/', (req, res) => res.redirect('/cargas.html'));

// Entrar: { "login": "lorrane", "senha": "..." }
app.post('/login', (req, res) => {
  const login = String(req.body?.login ?? '').trim().toLowerCase();
  const senha = String(req.body?.senha ?? '');

  if (!login || !senha) {
    return res.status(400).json({ ok: false, erro: 'Informe o login e a senha.' });
  }

  const resultado = entrar(login, senha);
  if (!resultado) {
    return res.status(401).json({ ok: false, erro: 'Login ou senha incorretos.' });
  }

  // Entrega a pulseira num cookie que o JavaScript da tela NÃO consegue ler
  res.cookie('sessao', resultado.token, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 12 * 60 * 60 * 1000, // 12 horas, em milissegundos
  });

  res.json({ ok: true, usuario: resultado.usuario });
});

// Sair: rasga a pulseira no banco e apaga o cookie
app.post('/logout', (req, res) => {
  sair(lerCookie(req, 'sessao'));
  res.clearCookie('sessao');
  res.json({ ok: true });
});

// Quem sou eu? (a tela usa para mostrar o nome de quem está logado)
app.get('/eu', (req, res) => {
  res.json({ ok: true, usuario: req.usuario });
});

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

// Conferência de uma carga: o que já foi bipado (e, depois de finalizar, o esperado e a diferença)
app.get('/cargas/:numero/conferencia', async (req, res) => {
  const numero = req.params.numero;

  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  try {
    const itens = await listarItensDaCarga(numero); // do Sankhya (ou falsos)
    const contagem = contagemDaCarga(numero);       // do nosso banco
    const finalizadaEm = dataFinalizacao(Number(numero)); // null = aberta

    const resultado = itens.map((item) => {
      const achado = contagem.find((linha) => Number(linha.codprod) === Number(item.CODPROD));
      const conferido = achado ? Number(achado.conferido) : 0;

      // Conferência cega: enquanto estiver aberta, NÃO manda o esperado
      if (!finalizadaEm) {
        return { CODPROD: item.CODPROD, DESCRPROD: item.DESCRPROD, CODVOL: item.CODVOL, CONFERIDO: conferido };
      }

      return {
        ...item,
        CONFERIDO: conferido,
        FALTA: item.QTDESPERADA - conferido,
        CORTADO: quantidadeCortada(Number(numero), Number(item.CODPROD)),
      };
    });

    res.json({
      ok: true,
      base: BASE,
      carga: numero,
      finalizada: Boolean(finalizadaEm),
      finalizadaEm,
      finalizadaPor: finalizadaPor(Number(numero)), // nome de quem finalizou
      itens: resultado,
    });
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

  // Depois de finalizada, não aceita mais bipagem
  if (dataFinalizacao(Number(numero))) {
    return res.status(409).json({ ok: false, erro: 'Esta conferência já foi finalizada.' });
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
      usuarioId: req.usuario.id, // quem bipou
    });

    res.status(201).json({ ok: true, codprod: produto.CODPROD, descricao: produto.DESCRPROD, quantidade });
  } catch (erro) {
    console.error('Erro ao registrar bipagem:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Finaliza a conferência de uma carga
app.post('/cargas/:numero/finalizar', (req, res) => {
  const numero = req.params.numero;

  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  try {
    finalizarConferencia(Number(numero), req.usuario.id); // quem finalizou
    res.json({ ok: true, carga: numero, finalizadaEm: dataFinalizacao(Number(numero)) });
  } catch (erro) {
    console.error('Erro ao finalizar a conferência:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// ⭐ Registra um corte. Com "nunota" e "sequencia", tenta cortar DE VERDADE no Sankhya:
// { "codprod": 26, "quantidade": 2, "motivo": "Sem estoque", "nunota": 2039986, "sequencia": 2 }
app.post('/cargas/:numero/cortes', async (req, res) => {
  const numero = req.params.numero;
  const codprod = Number(req.body?.codprod);
  const quantidade = Number(req.body?.quantidade);
  const motivo = String(req.body?.motivo ?? '').trim().slice(0, 300);
  const nunota = req.body?.nunota ? Number(req.body.nunota) : null;          // ⭐
  const sequencia = req.body?.sequencia ? Number(req.body.sequencia) : null; // ⭐

  // Confere tudo o que chegou antes de usar
  if (!/^\d{1,10}$/.test(numero)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }
  if (!Number.isInteger(codprod) || codprod < 1) {
    return res.status(400).json({ ok: false, erro: 'Produto inválido.' });
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 9999) {
    return res.status(400).json({ ok: false, erro: 'Quantidade inválida.' });
  }
  // ⭐ Se veio pedido, ele e a sequência têm que ser números inteiros
  if ((nunota || sequencia) && (!Number.isInteger(nunota) || !Number.isInteger(sequencia) || nunota < 1 || sequencia < 1)) {
    return res.status(400).json({ ok: false, erro: 'Pedido inválido.' });
  }

  // Só dá para cortar depois de finalizar (antes, ainda não se sabe o que faltou)
  if (!dataFinalizacao(Number(numero))) {
    return res.status(409).json({ ok: false, erro: 'Finalize a conferência antes de cortar.' });
  }

  try {
    // O produto é desta carga?
    const itens = await listarItensDaCarga(numero);
    const item = itens.find((i) => Number(i.CODPROD) === codprod);
    if (!item) {
      return res.status(404).json({ ok: false, erro: 'Este produto não é desta carga.' });
    }

    // Quanto ainda dá para cortar? (o que faltou, menos o que já foi cortado)
    const achado = contagemDaCarga(numero).find((linha) => Number(linha.codprod) === codprod);
    const conferido = achado ? Number(achado.conferido) : 0;
    const falta = Number(item.QTDESPERADA) - conferido;
    const disponivel = falta - quantidadeCortada(Number(numero), codprod);

    if (disponivel <= 0) {
      return res.status(400).json({ ok: false, erro: 'Não há falta para cortar neste produto.' });
    }
    if (quantidade > disponivel) {
      return res.status(400).json({ ok: false, erro: `Só dá para cortar até ${disponivel}.` });
    }

    // ⭐ O que todo corte guarda, seja automático ou manual
    const dadosCorte = {
      carga: Number(numero),
      codprod,
      descrprod: item.DESCRPROD,
      codvol: item.CODVOL,
      quantidade,
      motivo,
      usuarioId: req.usuario.id, // quem cortou
    };
    const resposta = { ok: true, carga: numero, codprod, descricao: item.DESCRPROD, quantidade };

    // ⭐ CAMINHO 1: sem pedido escolhido (ou com dados falsos) → só registra para ajuste manual
    if (!nunota || process.env.USAR_DADOS_FALSOS === 'SIM') {
      registrarCorte(dadosCorte);
      return res.status(201).json({
        ...resposta,
        automatico: false,
        mensagem: 'Corte registrado em "A fazer no Sankhya".',
      });
    }

    // ⭐ O item é mesmo desse pedido, nesta carga? (lê de novo do Sankhya)
    const [pedido] = await pedidosDoProduto(Number(numero), codprod, nunota, sequencia);
    if (!pedido) {
      return res.status(404).json({ ok: false, erro: 'Este pedido não tem o produto nesta carga.' });
    }
    if (quantidade > pedido.QTDNEG) {
      return res.status(400).json({ ok: false, erro: `O pedido ${nunota} só tem ${pedido.QTDNEG} ${pedido.CODVOL} deste produto.` });
    }

    // ⭐ CAMINHO 2: as regras não deixam (ou a trava está fechada) → registra para ajuste manual
    if (!pedido.PODE_CORTAR || !PODE_GRAVAR) {
      const porque = pedido.MOTIVO || 'Gravar no Sankhya está bloqueado nesta base.';
      registrarCorte({ ...dadosCorte, nunota, sequencia, observacao: porque });
      return res.status(201).json({
        ...resposta,
        automatico: false,
        mensagem: `Corte registrado em "A fazer no Sankhya". ${porque}`,
      });
    }

    // ⭐ CAMINHO 3: corta DE VERDADE no Sankhya
    try {
      const r = await cortarNoSankhya(pedido, quantidade);
      const prefixo = BASE === 'TESTE' ? 'Base de teste: ' : '';
      const oQueFez = r.excluido
        ? `item excluído do pedido ${nunota} (${r.antes} ${pedido.CODVOL})`
        : `pedido ${nunota}: ${r.antes} → ${r.depois} ${pedido.CODVOL}`;

      registrarCorte({
        ...dadosCorte, nunota, sequencia,
        modo: 'AUTOMATICO', status: 'FEITO', observacao: prefixo + oQueFez,
      });
      return res.status(201).json({
        ...resposta,
        automatico: true,
        mensagem: `✓ Cortado no Sankhya. ${prefixo}${oQueFez}.`,
      });
    } catch (erroSankhya) {
      // O Sankhya recusou ou não mudou: vai para "A fazer", com o motivo
      console.error('O Sankhya não aceitou o corte:', erroSankhya);
      const porque = `O Sankhya não aceitou o corte (${erroSankhya.message}): ajuste no Sankhya.`.slice(0, 300);
      registrarCorte({ ...dadosCorte, nunota, sequencia, observacao: porque });
      return res.status(201).json({
        ...resposta,
        automatico: false,
        mensagem: `Corte registrado em "A fazer no Sankhya". ${porque}`,
      });
    }
  } catch (erro) {
    console.error('Erro ao registrar corte:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Lista os cortes: /cortes (todos), /cortes?status=A_FAZER ou /cortes?status=FEITO
app.get('/cortes', (req, res) => {
  const status = req.query.status || '';

  if (!['', 'A_FAZER', 'FEITO'].includes(status)) {
    return res.status(400).json({ ok: false, erro: 'Situação inválida.' });
  }

  try {
    res.json({ ok: true, status, cortes: listarCortes(status) });
  } catch (erro) {
    console.error('Erro ao listar cortes:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Marca um corte como feito (ajustado no Sankhya)
app.post('/cortes/:id/feito', (req, res) => {
  const id = req.params.id;

  if (!/^\d{1,10}$/.test(id)) {
    return res.status(400).json({ ok: false, erro: 'Corte inválido.' });
  }

  try {
    const mudou = marcarCorteFeito(Number(id), req.usuario.id); // quem marcou como feito
    if (!mudou) {
      return res.status(404).json({ ok: false, erro: 'Corte não encontrado ou já estava feito.' });
    }
    res.json({ ok: true, id: Number(id) });
  } catch (erro) {
    console.error('Erro ao marcar corte como feito:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// Lista as cargas para faturar, com a situação da conferência e do faturamento
app.get('/faturamento', async (req, res) => {
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

    const resultado = cargas.map((carga) => {
      const finalizadaEm = dataFinalizacao(Number(carga.ORDEMCARGA));
      const faturamento = situacaoFaturamento(Number(carga.ORDEMCARGA));
      return {
        ...carga,
        CONFERIDA: Boolean(finalizadaEm),
        FATURADA: Boolean(faturamento),
        MODO_FATURAMENTO: faturamento?.modo ?? null,
        FATURADA_EM: faturamento?.faturado_em ?? null,
        FATURADA_POR: faturamento?.faturado_por_nome ?? null,
      };
    });

    res.json({ ok: true, base: BASE, de, ate, cargas: resultado });
  } catch (erro) {
    console.error('Erro ao listar cargas para faturar:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// ⭐ Cargas que estão sendo faturadas AGORA (para não faturar a mesma 2 vezes ao mesmo tempo)
const cargasFaturando = new Set();

// ⭐ Fatura UMA carga de verdade no Sankhya (roda "por trás", sem a tela esperar)
async function faturarDeVerdade(carga, usuarioId) {
  cargasFaturando.add(carga);
  try {
    const resumo = await faturarCargaNoSankhya(carga, usuarioId);
    console.log(`Faturamento da carga ${carga}:`, resumo);

    // Só marca a carga como FATURADA quando TODOS os pedidos deram certo
    if (resumo.erros === 0) {
      registrarFaturamento(carga, 'SANKHYA', usuarioId);
    }
  } catch (erro) {
    console.error(`Erro ao faturar a carga ${carga}:`, erro);
  } finally {
    cargasFaturando.delete(carga);
  }
}

// Fatura as cargas escolhidas: { "cargas": [1001, 1002] }
app.post('/faturamento', (req, res) => {
  const lista = req.body?.cargas;

  // Tem que ser uma lista de 1 a 50 números de carga
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 50) {
    return res.status(400).json({ ok: false, erro: 'Escolha de 1 a 50 cargas.' });
  }
  if (!lista.every((n) => /^\d{1,10}$/.test(String(n)))) {
    return res.status(400).json({ ok: false, erro: 'Número de carga inválido na lista.' });
  }

  const simulacao = process.env.USAR_DADOS_FALSOS === 'SIM';

  // ⭐ Trava de segurança: só grava no Sankhya na base de TESTE
  if (!simulacao && !PODE_GRAVAR) {
    return res.status(403).json({
      ok: false,
      erro: `Faturar está travado na base ${BASE}. Só a base de TESTE pode gravar.`,
    });
  }

  try {
    // Uma resposta para cada carga
    const resultados = lista.map((n) => {
      const carga = Number(n);

      if (!dataFinalizacao(carga)) {
        return { carga, ok: false, mensagem: 'Não conferida: finalize a conferência antes.' };
      }
      if (situacaoFaturamento(carga)) {
        return { carga, ok: false, mensagem: 'Já estava faturada.' };
      }

      // Modo simulação (dados falsos): só anota, não fala com o Sankhya
      if (simulacao) {
        registrarFaturamento(carga, 'SIMULACAO', req.usuario.id);
        return { carga, ok: true, mensagem: 'Faturada (simulação).' };
      }

      // ⭐ Modo real: começa a faturar no Sankhya e responde na hora
      if (cargasFaturando.has(carga)) {
        return { carga, ok: false, mensagem: 'Já está sendo faturada agora.' };
      }
      faturarDeVerdade(carga, req.usuario.id); // sem await: continua sozinho
      return { carga, ok: true, mensagem: 'Faturamento começou no Sankhya.' };
    });

    res.json({ ok: true, simulacao, resultados });
  } catch (erro) {
    console.error('Erro ao faturar:', erro);
    res.status(500).json({ ok: false, erro: erro.message });
  }
});

// ⭐ Andamento do faturamento real de uma carga, pedido por pedido
app.get('/faturamento/:carga/andamento', (req, res) => {
  const { carga } = req.params;

  if (!/^\d{1,10}$/.test(carga)) {
    return res.status(400).json({ ok: false, erro: 'Número da carga inválido.' });
  }

  res.json({
    ok: true,
    carga: Number(carga),
    faturando: cargasFaturando.has(Number(carga)),
    pedidos: andamentoDaCarga.all(Number(carga)),
  });
});

// Pedidos da carga que têm um produto em falta (para escolher de onde cortar)
app.get('/cargas/:numero/produtos/:codprod/pedidos', async (req, res) => {
  const { numero, codprod } = req.params;

  if (!/^\d{1,10}$/.test(numero) || !/^\d{1,10}$/.test(codprod)) {
    return res.status(400).json({ ok: false, erro: 'Carga ou produto inválido.' });
  }
  if (!dataFinalizacao(Number(numero))) {
    return res.status(409).json({ ok: false, erro: 'Finalize a conferência antes de cortar.' });
  }
  if (process.env.USAR_DADOS_FALSOS === 'SIM') {
    return res.json({ ok: true, simulacao: true, pedidos: [] });
  }

  try {
    const pedidos = await pedidosDoProduto(Number(numero), Number(codprod));
    res.json({ ok: true, carga: numero, codprod: Number(codprod), pedidos });
  } catch (erro) {
    console.error('Erro ao buscar os pedidos do produto:', erro);
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