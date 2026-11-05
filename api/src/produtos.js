// Consultas de produtos no Sankhya.
import { consultarSql } from './sankhya.js';
import { textoSql } from './sql.js';

// Busca um produto pelo código de barras, pela referência ou pelo código do produto
export async function buscarProdutoPorCodigo(codigo) {
    const cod = textoSql(codigo);

    const sql = `
    SELECT P.CODPROD, P.DESCRPROD, P.CODVOL, P.MARCA, P.REFERENCIA
    FROM TGFPRO P
    WHERE P.ATIVO = 'S'
      AND (
        TO_CHAR(P.CODPROD) = ${cod}
        OR TRIM(P.REFERENCIA) = ${cod}
        OR EXISTS (SELECT 1 FROM TGFBAR B WHERE B.CODPROD = P.CODPROD AND B.CODBARRA = ${cod})
        OR EXISTS (SELECT 1 FROM TGFVOA V WHERE V.CODPROD = P.CODPROD AND V.CODBARRA = ${cod})
      )
      AND ROWNUM <= 5
  `

    return consultarSql(sql);
}