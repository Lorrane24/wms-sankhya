// Faturamento de verdade no Sankhya (o mesmo caminho do Mitra).
// ESTE ARQUIVO FICA EM: api/src/faturamento-sankhya.js
//
// Para CADA pedido da carga (TOP 31, empresa 501):
//   1. acerta o total e confirma o pedido 31
//   2. fatura o 31  → nota 56            e ajusta a 56 (CIF, carga, total, confirma, conta)
//   3. cria a cópia 26 na empresa 1      e confirma a 26
//   4. fatura a 26  → nota 32            e ajusta a 32
//   5. pronto: falta só emitir a NF-e lá no Sankhya
//
// Cada passo fica anotado na tabela fat_pedidos. Se parar no meio,
// rodar de novo CONTINUA de onde parou (não cria nota repetida).

import { consultarSql, chamarServico, PODE_GRAVAR } from './sankhya.js';
import { banco } from './banco.js';

// As duas "regras" do faturamento (vieram do Mitra)
const REGRA_56 = { destino: 56, serie: null, conta: 3 };   // 31 (empresa 501) → 56
const REGRA_32 = { destino: 32, serie: '1', conta: 13 };   // 26 (empresa 1)   → 32

// ---------- pequenos ajudantes ----------

const inteiro = (x) => Math.trunc(Number(x) || 0);
const numero = (x) => Number(x) || 0;
const valor = (x) => ({ $: x === null || x === undefined ? '' : String(x) }); // embrulho do Sankhya

// Data de hoje no horário de Brasília, no formato DD/MM/AAAA
function hoje() {
  const agora = new Date(Date.now() - 3 * 3600000);
  return agora.toISOString().slice(0, 10).split('-').reverse().join('/');
}

// Chama o Sankhya sem parar no erro: devolve a mensagem para a gente conferir depois
async function tentarServico(modulo, servico, corpo) {
  try {
    await chamarServico(modulo, servico, corpo);
    return '';
  } catch (erro) {
    return erro.message;
  }
}

// ---------- leitura ----------

// Cabeçalho de uma nota (TGFCAB)
async function cabecalho(nunota) {
  const linhas = await consultarSql(`
    SELECT NUNOTA, CODEMP, CODTIPOPER, STATUSNOTA, VLRNOTA,
           NVL(VLRFRETE,0) VLRFRETE, NVL(VLRDESCTOT,0) VLRDESCTOT,
           CIF_FOB, ORDEMCARGA, CODPARC, CODTIPVENDA, CODVEND, CODNAT, CODCENCUS,
           CODPARCTRANSP, CODEMPNEGOC, OBSERVACAO
    FROM TGFCAB WHERE NUNOTA = ${inteiro(nunota)}`);
  return linhas[0];
}

// Qual nota (da TOP pedida) já foi gerada a partir desta? 0 = nenhuma
async function notaGerada(nunota, top) {
  const linhas = await consultarSql(`
    SELECT MAX(V.NUNOTA) NUNOTA
    FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA
    WHERE V.NUNOTAORIG = ${inteiro(nunota)} AND C.CODTIPOPER = ${inteiro(top)}`);
  return inteiro(linhas[0]?.NUNOTA);
}

// Pedidos da carga que entram no faturamento
export async function pedidosParaFaturar(carga) {
  return consultarSql(`
    SELECT C.NUNOTA, SUBSTR(P.NOMEPARC,1,120) CLIENTE, C.VLRNOTA
    FROM TGFCAB C JOIN TGFPAR P ON P.CODPARC = C.CODPARC
    WHERE C.ORDEMCARGA = ${inteiro(carga)} AND C.CODEMP = 501 AND C.CODTIPOPER = 31
    ORDER BY C.NUNOTA`);
}

// ---------- gravação ----------

// Grava campos numa tabela do Sankhya (ex.: CabecalhoNota, Financeiro)
async function salvar(entidade, chave, campos) {
  const fields = Object.keys(campos);
  if (fields.length === 0) return;
  const values = {};
  fields.forEach((campo, i) => {
    values[String(i)] = campos[campo] === null || campos[campo] === undefined ? '' : String(campos[campo]);
  });
  await chamarServico('mge', 'DatasetSP.save', {
    entityName: entidade, standAlone: false, fields, records: [{ pk: chave, values }],
  });
}

// O total da nota tem que bater com a soma dos itens + frete − desconto
async function acertarTotal(nunota) {
  const cab = await cabecalho(nunota);
  const soma = await consultarSql(
    `SELECT NVL(SUM(VLRTOT),0) TOTAL FROM TGFITE WHERE NUNOTA = ${inteiro(nunota)} AND USOPROD <> 'D'`);
  const certo = Math.round((numero(soma[0].TOTAL) + numero(cab.VLRFRETE) - numero(cab.VLRDESCTOT)) * 100) / 100;
  if (Math.abs(certo - numero(cab.VLRNOTA)) >= 0.005) {
    await salvar('CabecalhoNota', { NUNOTA: String(inteiro(nunota)) }, { VLRNOTA: certo.toFixed(2) });
  }
}

// Confirma a nota (STATUSNOTA vira 'L'). Se já está confirmada, não faz nada.
async function confirmar(nunota) {
  const antes = await cabecalho(nunota);
  if (antes?.STATUSNOTA === 'L') return;

  const aviso = await tentarServico('mgecom', 'CACSP.confirmarNota', {
    nota: {
      NUNOTA: valor(inteiro(nunota)),
      confirmacaoCentralNota: 'true',
      ehPedidoWeb: 'false',
      atualizaPrecoItemPedCompra: 'false',
      ownerServiceCall: 'CentralNotas',
    },
  });

  // Confiar, mas conferir
  const depois = await cabecalho(nunota);
  if (depois?.STATUSNOTA !== 'L') {
    throw new Error(`A nota ${nunota} não foi confirmada. ${aviso}`);
  }
}

// Fatura uma nota para a TOP da regra e devolve o número da nota nova
async function faturar(nunota, regra) {
  const notas = {
    codTipOper: regra.destino,
    dtFaturamento: '',
    tipoFaturamento: 'FaturamentoNormal',
    dataValidada: true,
    notasComMoeda: {},
    nota: [valor(inteiro(nunota))],
    codLocalDestino: '',
    faturarTodosItens: true,
    umaNotaParaCada: 'false',
    ehWizardFaturamento: true,
    ehPedidoWeb: false,
    nfeDevolucaoViaRecusa: false,
  };
  if (regra.serie) notas.serie = regra.serie;

  const aviso = await tentarServico('mgecom', 'SelecaoDocumentoSP.faturar', { notas });

  const gerada = await notaGerada(nunota, regra.destino);
  if (!gerada) {
    throw new Error(`O faturamento do ${nunota} para a TOP ${regra.destino} falhou. ${aviso}`);
  }
  return gerada;
}

// Depois de faturar: copia CIF e carga, acerta total, confirma e troca a conta do financeiro
async function ajustarNotaGerada(origem, nota, regra) {
  const o = await cabecalho(origem);
  const n = await cabecalho(nota);

  const campos = {};
  if (o.CIF_FOB && String(n.CIF_FOB ?? '') !== String(o.CIF_FOB)) campos.CIF_FOB = o.CIF_FOB;
  if (inteiro(o.ORDEMCARGA) > 0 && inteiro(n.ORDEMCARGA) !== inteiro(o.ORDEMCARGA)) campos.ORDEMCARGA = inteiro(o.ORDEMCARGA);
  await salvar('CabecalhoNota', { NUNOTA: String(inteiro(nota)) }, campos);

  await acertarTotal(nota);
  await confirmar(nota);

  const financeiro = await consultarSql(`SELECT NUFIN, CODCTABCOINT FROM TGFFIN WHERE NUNOTA = ${inteiro(nota)}`);
  for (const f of financeiro) {
    if (inteiro(f.CODCTABCOINT) !== regra.conta) {
      await salvar('Financeiro', { NUFIN: String(inteiro(f.NUFIN)) }, { CODCTABCOINT: regra.conta });
    }
  }
}

// A carga precisa existir também na empresa 1. Se não existe, copia a da 501.
async function garantirCargaEmpresa1(carga) {
  if (inteiro(carga) <= 0) return;

  const ja = await consultarSql(`SELECT COUNT(*) N FROM TGFORD WHERE CODEMP = 1 AND ORDEMCARGA = ${inteiro(carga)}`);
  if (inteiro(ja[0]?.N) > 0) return;

  const original = (await consultarSql(`SELECT * FROM TGFORD WHERE CODEMP = 501 AND ORDEMCARGA = ${inteiro(carga)}`))[0];
  if (!original) throw new Error(`A carga ${carga} não existe na empresa 501.`);

  // Campos que NÃO podem ser copiados (chaves, datas, usuários...)
  const naoCopiar = /^(CODEMP|ORDEMCARGA|NUNOTA|IDORDEMCARGA|NUCAIXA|NUFINACERTO|CODUSU|CODUSURETORNO|OCPROC|ORDEMCARGAPAI|CODEMPPAI|NUVIAG|STATUS_TRANSPORTE)$|^(DT|DH|HORA)/;
  const campos = { CODEMP: '1', ORDEMCARGA: String(inteiro(carga)) };
  for (const campo of Object.keys(original)) {
    const v = original[campo];
    if (!naoCopiar.test(campo) && v !== null && v !== undefined && String(v) !== '') campos[campo] = String(v);
  }

  // Se o Sankhya disser "Campo não existe: OrdemCarga->X", tira o X e tenta de novo
  for (let tentativa = 0; tentativa < 25; tentativa++) {
    const fields = Object.keys(campos);
    const values = {};
    fields.forEach((campo, i) => { values[String(i)] = campos[campo]; });

    const aviso = await tentarServico('mge', 'DatasetSP.save', {
      entityName: 'OrdemCarga', standAlone: false, fields, records: [{ values }],
    });
    if (!aviso) return;

    const falta = /Campo n.o existe: OrdemCarga->(\w+)/.exec(aviso);
    if (!falta || !(falta[1] in campos) || falta[1] === 'CODEMP' || falta[1] === 'ORDEMCARGA') {
      throw new Error(`Não foi possível criar a carga ${carga} na empresa 1. ${aviso}`);
    }
    delete campos[falta[1]];
  }
  throw new Error(`Não foi possível criar a carga ${carga} na empresa 1.`);
}

// Cria o pedido 26 (empresa 1) com os mesmos itens do pedido 31
async function criarCopia26(pedido) {
  const o = await cabecalho(pedido);
  const itens = await consultarSql(`
    SELECT CODPROD, QTDNEG, CODVOL, VLRUNIT, NVL(PERCDESC,0) PERCDESC, NVL(VLRDESC,0) VLRDESC,
           CODLOCALORIG, CONTROLE
    FROM TGFITE WHERE NUNOTA = ${inteiro(pedido)} AND USOPROD <> 'D'
    ORDER BY SEQUENCIA`);
  if (itens.length === 0) throw new Error(`O pedido ${pedido} não tem itens para copiar.`);

  const cab = {
    NUNOTA: {},
    CODEMP: valor(1),
    CODTIPOPER: valor(26),
    TIPMOV: valor('P'),
    DTNEG: valor(hoje()),
    SERIENOTA: valor('1'),
    CODPARC: valor(inteiro(o.CODPARC)),
    CODTIPVENDA: valor(inteiro(o.CODTIPVENDA)),
    CODVEND: valor(inteiro(o.CODVEND)),
    CODNAT: valor(inteiro(o.CODNAT)),
    CODCENCUS: valor(inteiro(o.CODCENCUS)),
    CIF_FOB: valor(o.CIF_FOB || ''),
    ORDEMCARGA: valor(inteiro(o.ORDEMCARGA)),
    CODPARCTRANSP: valor(inteiro(o.CODPARCTRANSP)),
    CODEMPNEGOC: valor(inteiro(o.CODEMPNEGOC) || 501),
  };
  if (o.OBSERVACAO) cab.OBSERVACAO = valor(o.OBSERVACAO);

  const item = itens.map((i) => ({
    NUNOTA: {},
    CODPROD: valor(inteiro(i.CODPROD)),
    QTDNEG: valor(numero(i.QTDNEG)),
    CODVOL: valor(i.CODVOL),
    VLRUNIT: valor(numero(i.VLRUNIT)),
    PERCDESC: valor(numero(i.PERCDESC)),
    VLRDESC: valor(numero(i.VLRDESC)),
    CODLOCALORIG: valor(inteiro(i.CODLOCALORIG)),
    CONTROLE: valor(i.CONTROLE ?? ' '),
  }));

  const resposta = await chamarServico('mgecom', 'CACSP.incluirNota', {
    nota: { cabecalho: cab, itens: { INFORMARPRECO: 'True', item } },
  });

  const pk = resposta?.responseBody?.pk?.NUNOTA;
  const nova = inteiro(pk?.$ ?? pk);
  if (!nova) throw new Error(`O Sankhya não devolveu o número da cópia 26 do pedido ${pedido}.`);
  return nova;
}

// ---------- andamento (tabela fat_pedidos no nosso banco) ----------

const lerAndamento = banco.prepare('SELECT * FROM fat_pedidos WHERE nunota = ?');

const criarAndamento = banco.prepare(`
  INSERT INTO fat_pedidos (nunota, carga, cliente, status, etapa, feito_por)
  VALUES (?, ?, ?, 'PENDENTE', 'Início', ?)
  ON CONFLICT (nunota) DO NOTHING
`);

const gravarAndamento = banco.prepare(`
  UPDATE fat_pedidos
  SET status = ?, etapa = ?, mensagem = ?, nunota_56 = ?, nunota_26 = ?, nunota_32 = ?,
      feito_por = ?, atualizado_em = datetime('now', 'localtime')
  WHERE nunota = ?
`);

export const andamentoDaCarga = banco.prepare(`
  SELECT nunota, cliente, status, etapa, mensagem, nunota_56, nunota_26, nunota_32, atualizado_em
  FROM fat_pedidos WHERE carga = ? ORDER BY nunota
`);

// ---------- o passo a passo de UM pedido ----------

async function faturarPedido(nunota, usuarioId) {
  const reg = lerAndamento.get(nunota) ?? {};
  let n56 = inteiro(reg.nunota_56);
  let n26 = inteiro(reg.nunota_26);
  let n32 = inteiro(reg.nunota_32);

  // Anota a etapa atual (aparece na tela)
  const passo = (etapa) => gravarAndamento.run('PROCESSANDO', etapa, null, n56 || null, n26 || null, n32 || null, usuarioId, nunota);

  // 31 → 56
  if (!n56) {
    const ja = await notaGerada(nunota, 56);
    if (ja) throw new Error(`O pedido já tem a nota ${ja} (TOP 56) feita fora do app. Não faturei de novo para não duplicar.`);

    const itens = await consultarSql(`SELECT COUNT(*) N FROM TGFITE WHERE NUNOTA = ${inteiro(nunota)}`);
    if (!inteiro(itens[0]?.N)) throw new Error('O pedido ficou sem itens (todos cortados). Exclua o pedido ou tire da carga no Sankhya.');

    passo('Acertando total do pedido');
    await acertarTotal(nunota);
    passo('Confirmando o pedido');
    await confirmar(nunota);
    passo('Faturando para a TOP 56');
    n56 = await faturar(nunota, REGRA_56);
  }
  passo('Ajustando a nota 56');
  await ajustarNotaGerada(nunota, n56, REGRA_56);

  // cópia 26
  if (!n26) {
    if (reg.etapa === 'Criando a cópia 26') {
      throw new Error('Uma vez anterior parou enquanto criava a cópia 26. Confira no Sankhya se ela foi criada antes de tentar de novo.');
    }
    passo('Preparando a carga na empresa 1');
    await garantirCargaEmpresa1(inteiro((await cabecalho(nunota)).ORDEMCARGA));
    passo('Criando a cópia 26');
    n26 = await criarCopia26(nunota);
  }
  passo('Confirmando a cópia 26');
  await acertarTotal(n26);
  await confirmar(n26);

  // 26 → 32
  if (!n32) {
    n32 = await notaGerada(n26, 32);
    if (!n32) {
      passo('Faturando para a TOP 32');
      n32 = await faturar(n26, REGRA_32);
    }
  }
  passo('Ajustando a nota 32');
  await ajustarNotaGerada(n26, n32, REGRA_32);

  gravarAndamento.run('CONCLUIDO', 'Falta emitir a NF-e no Sankhya', null, n56, n26, n32, usuarioId, nunota);
}

// ---------- a carga inteira ----------

// Pedidos sendo faturados AGORA (se o servidor reiniciar, a lista zera e dá para continuar)
const emAndamento = new Set();

// Fatura todos os pedidos da carga, um de cada vez.
// Devolve { pedidos, feitos, erros } — o detalhe de cada pedido fica em fat_pedidos.
export async function faturarCargaNoSankhya(carga, usuarioId) {
  if (!PODE_GRAVAR) {
    throw new Error('Gravar no Sankhya está travado nesta base (só a base TESTE grava).');
  }

  const pedidos = await pedidosParaFaturar(carga);
  if (pedidos.length === 0) throw new Error(`A carga ${carga} não tem pedidos TOP 31 da empresa 501.`);

  for (const p of pedidos) {
    criarAndamento.run(inteiro(p.NUNOTA), inteiro(carga), String(p.CLIENTE ?? ''), usuarioId);
  }

  const resumo = { pedidos: pedidos.length, feitos: 0, erros: 0 };

  for (const p of pedidos) {
    const nunota = inteiro(p.NUNOTA);
    const reg = lerAndamento.get(nunota);

    if (reg.status === 'CONCLUIDO') { resumo.feitos++; continue; }       // já estava pronto
    if (emAndamento.has(nunota)) { resumo.erros++; continue; }          // alguém está faturando agora

    emAndamento.add(nunota);
    try {
      await faturarPedido(nunota, usuarioId);
      resumo.feitos++;
    } catch (erro) {
      resumo.erros++;
      const atual = lerAndamento.get(nunota);
      gravarAndamento.run('ERRO', atual.etapa, String(erro.message).slice(0, 900),
        atual.nunota_56, atual.nunota_26, atual.nunota_32, usuarioId, nunota);
    } finally {
      emAndamento.delete(nunota);
    }
  }

  return resumo;
}