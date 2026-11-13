// Corte de verdade no Sankhya: descobre em quais pedidos o produto está
// e se o app pode cortar sozinho (regras iguais às do Mitra).
// ESTE ARQUIVO FICA EM: api/src/corte-sankhya.js
import { consultarSql, chamarServico, PODE_GRAVAR } from './sankhya.js';
import { FILTRO_PEDIDOS } from './cargas.js';

// Por que o app NÃO pode cortar sozinho? (texto vazio = pode cortar)
export function motivoManual(item) {
  if (String(item.TIPMOV) !== 'P') {
    return 'Já é nota fiscal: ajuste no Sankhya (devolução ou cancelamento).';
  }
  if (Number(item.FATURADO) > 0) {
    return 'Pedido já faturado: ajuste no Sankhya.';
  }
  if (String(item.STATUSNOTA) === 'L' && String(item.ALTNFCONF) !== 'S') {
    return 'Pedido confirmado e a TOP não permite alterar: ajuste no Sankhya.';
  }
  if (String(item.CODVOL_PEDIDO) !== String(item.CODVOL)) {
    return `No pedido o produto está em ${item.CODVOL_PEDIDO} (outra unidade): ajuste no Sankhya.`;
  }
  return '';
}

// Os pedidos da carga que têm esse produto (um item por linha)
export async function pedidosDoProduto(carga, codprod, nunota = null, sequencia = null) {
  // Se vierem pedido e sequência, busca só aquele item
  const filtroItem = nunota && sequencia
    ? `AND C.NUNOTA = ${nunota} AND I.SEQUENCIA = ${sequencia}`
    : '';

  const sql = `
    SELECT C.NUNOTA, I.SEQUENCIA, C.TIPMOV, C.STATUSNOTA,
           PA.NOMEPARC CLIENTE,
           I.CODVOL CODVOL_PEDIDO, P.CODVOL, I.QTDNEG, I.VLRUNIT,
           (SELECT COUNT(*) FROM TGFVAR VA WHERE VA.NUNOTAORIG = C.NUNOTA) FATURADO,
           (SELECT MAX(T.ALTNFCONF) KEEP (DENSE_RANK LAST ORDER BY T.DHALTER)
              FROM TGFTOP T WHERE T.CODTIPOPER = C.CODTIPOPER) ALTNFCONF
    FROM TGFCAB C
    JOIN TGFITE I ON I.NUNOTA = C.NUNOTA
    JOIN TGFPRO P ON P.CODPROD = I.CODPROD
    JOIN TGFPAR PA ON PA.CODPARC = C.CODPARC
    WHERE C.ORDEMCARGA = ${carga}
      AND I.CODPROD = ${codprod}
      AND ${FILTRO_PEDIDOS}
      ${filtroItem}
    ORDER BY PA.NOMEPARC, C.NUNOTA
  `;

  const linhas = await consultarSql(sql);

  return linhas.map((item) => {
    const motivo = motivoManual(item);
    return {
      NUNOTA: Number(item.NUNOTA),
      SEQUENCIA: Number(item.SEQUENCIA),
      CLIENTE: item.CLIENTE,
      QTDNEG: Number(item.QTDNEG),
      CODVOL: item.CODVOL,
      CODVOL_PEDIDO: item.CODVOL_PEDIDO,
      VLRUNIT: Number(item.VLRUNIT),
      PODE_CORTAR: motivo === '',
      MOTIVO: motivo,
    };
  });
}


// Corta de verdade no Sankhya e confere se mudou.
// Cortou tudo → exclui o item. Cortou parte → diminui a quantidade.
export async function cortarNoSankhya(item, quantidade) {
  // Proteção 1: a trava
  if (!PODE_GRAVAR) {
    throw new Error('Gravar no Sankhya está bloqueado nesta base.');
  }

  const novaQtd = Math.round((item.QTDNEG - quantidade) * 10000) / 10000;

  // O Sankhya quer cada valor no formato { "$": "valor" }
  const valor = (x) => ({ $: String(x) });

  if (novaQtd <= 0) {
    // Cortou tudo: exclui o item do pedido
    await chamarServico('mgecom', 'CACSP.excluirItemNota', {
      nota: {
        NUNOTA: String(item.NUNOTA),
        itens: { item: [{ NUNOTA: valor(item.NUNOTA), SEQUENCIA: valor(item.SEQUENCIA) }] },
      },
    });
  } else {
    // Cortou parte: muda a quantidade (e o total) do item
    await chamarServico('mgecom', 'CACSP.incluirAlterarItemNota', {
      nota: {
        NUNOTA: String(item.NUNOTA),
        itens: {
          INFORMARPRECO: 'True',
          item: {
            NUNOTA: valor(item.NUNOTA),
            SEQUENCIA: valor(item.SEQUENCIA),
            QTDNEG: valor(novaQtd),
            CODVOL: valor(item.CODVOL_PEDIDO),
            VLRUNIT: valor(item.VLRUNIT),
            VLRTOT: valor((novaQtd * item.VLRUNIT).toFixed(2)),
          },
        },
      },
    });
  }

  // Proteção 3: lê o item de novo para conferir se o Sankhya mudou mesmo
  const depois = await consultarSql(
    `SELECT QTDNEG FROM TGFITE WHERE NUNOTA = ${item.NUNOTA} AND SEQUENCIA = ${item.SEQUENCIA}`
  );

  if (novaQtd <= 0) {
    if (depois.length > 0) throw new Error('O Sankhya não excluiu o item.');
    return { antes: item.QTDNEG, depois: 0, excluido: true };
  }

  if (depois.length === 0 || Math.abs(Number(depois[0].QTDNEG) - novaQtd) > 0.0001) {
    throw new Error('O Sankhya não alterou a quantidade.');
  }
  return { antes: item.QTDNEG, depois: novaQtd, excluido: false };
}