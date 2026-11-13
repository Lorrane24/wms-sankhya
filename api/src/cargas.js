// Consultas de cargas (ordens de carga) no Sankhya.
// ESTE ARQUIVO FICA EM: api/src/cargas.js
import { consultarSql } from './sankhya.js';
import { CARGAS_FALSAS, ITENS_FALSOS } from './dados-falsos.js';

// Filtro dos pedidos da empresa 501
export const FILTRO_PEDIDOS = "C.CODEMP = 501 AND C.TIPMOV IN ('P','V') AND C.CODTIPOPER <> 26"; // ⭐ export

// Busca as cargas de um período, ou uma carga pelo número.
// de e ate chegam no formato AAAA-MM-DD; numero é opcional.
export async function listarCargas({ de, ate, numero }) {
  // Modo de dados falsos: não chama o Sankhya
  if (process.env.USAR_DADOS_FALSOS === 'SIM') {
    if (numero) {
      return CARGAS_FALSAS.filter((carga) => String(carga.ORDEMCARGA) === numero);
    }
    return CARGAS_FALSAS;
  }

  const filtro = numero
    ? `AND C.ORDEMCARGA = ${numero}`
    : `AND C.DTNEG >= TO_DATE('${de}', 'YYYY-MM-DD')
       AND C.DTNEG <  TO_DATE('${ate}', 'YYYY-MM-DD') + 1`;

  const sql = `
    SELECT * FROM (
      SELECT G.ORDEMCARGA, G.PEDIDOS, G.CLIENTES, G.DATA,
        (SELECT MAX(R.NOMEREG) FROM TGFORD O JOIN TSIREG R ON R.CODREG = O.CODREG
          WHERE O.ORDEMCARGA = G.ORDEMCARGA AND O.CODEMP = G.CODEMP) REGIAO,
        (SELECT MAX(NVL(VE.MARCAMODELO, VE.PLACA) || CASE WHEN VE.PLACA IS NOT NULL THEN ' - ' || VE.PLACA END)
          FROM TGFORD O JOIN TGFVEI VE ON VE.CODVEICULO = O.CODVEICULO
          WHERE O.ORDEMCARGA = G.ORDEMCARGA AND O.CODEMP = G.CODEMP) VEICULO,
        (SELECT MAX(PM.NOMEPARC) FROM TGFORD O JOIN TGFPAR PM ON PM.CODPARC = O.CODPARCMOTORISTA
          WHERE O.ORDEMCARGA = G.ORDEMCARGA AND O.CODEMP = G.CODEMP) MOTORISTA
      FROM (
        SELECT C.ORDEMCARGA,
               COUNT(DISTINCT C.NUNOTA) PEDIDOS,
               COUNT(DISTINCT C.CODPARC) CLIENTES,
               TO_CHAR(MAX(C.DTNEG), 'YYYY-MM-DD') DATA,
               MIN(C.CODEMP) CODEMP
        FROM TGFCAB C
        WHERE C.ORDEMCARGA > 0 AND ${FILTRO_PEDIDOS} ${filtro}
        GROUP BY C.ORDEMCARGA
      ) G
      ORDER BY G.DATA DESC, G.ORDEMCARGA DESC
    ) WHERE ROWNUM <= 100
  `;

  return consultarSql(sql);
}

// Lista os itens (produtos) de uma carga, somando as quantidades dos pedidos.
export async function listarItensDaCarga(numero) {
  // Modo de dados falsos: abre a "gaveta" da carga (ou devolve lista vazia)
  if (process.env.USAR_DADOS_FALSOS === 'SIM') {
    return ITENS_FALSOS[numero] ?? [];
  }

  const sql = `
    SELECT I.CODPROD, P.DESCRPROD, I.CODVOL, SUM(I.QTDNEG) QTDESPERADA
    FROM TGFCAB C
    JOIN TGFITE I ON I.NUNOTA = C.NUNOTA
    JOIN TGFPRO P ON P.CODPROD = I.CODPROD
    WHERE C.ORDEMCARGA = ${numero} AND ${FILTRO_PEDIDOS}
    GROUP BY I.CODPROD, P.DESCRPROD, I.CODVOL
    ORDER BY P.DESCRPROD
  `;

  return consultarSql(sql);
}