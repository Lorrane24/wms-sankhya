// Cortes: o que faltou na conferência e precisa ser cortado do pedido.
// ESTE ARQUIVO FICA EM: api/src/cortes.js
import { banco } from './banco.js';

// ⭐ Agora guarda também o pedido, o item, o modo e a observação.
// Se o corte já nasce FEITO (o app cortou no Sankhya), já anota quando e quem.
const inserirCorte = banco.prepare(`
  INSERT INTO cortes (
    carga, codprod, descrprod, codvol, quantidade, motivo, criado_por,
    nunota, sequencia, modo, status, observacao, feito_em, feito_por
  )
  VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    CASE WHEN ? = 'FEITO' THEN datetime('now', 'localtime') END,
    CASE WHEN ? = 'FEITO' THEN ? END
  )
`);

const somarCortado = banco.prepare(`
  SELECT COALESCE(SUM(quantidade), 0) AS cortado
  FROM cortes
  WHERE carga = ? AND codprod = ?
`);

const listar = banco.prepare(`
  SELECT c.*,
         uc.nome AS criado_por_nome,
         uf.nome AS feito_por_nome
  FROM cortes c
  LEFT JOIN usuarios uc ON uc.id = c.criado_por
  LEFT JOIN usuarios uf ON uf.id = c.feito_por
  WHERE (? = '' OR c.status = ?)
  ORDER BY CASE WHEN c.status = 'A_FAZER' THEN 0 ELSE 1 END, c.id DESC
`);

const marcarFeito = banco.prepare(`
  UPDATE cortes
  SET status = 'FEITO', feito_em = datetime('now', 'localtime'), feito_por = ?
  WHERE id = ? AND status = 'A_FAZER'
`);

// ⭐ Registra um corte. Por padrão nasce MANUAL e A_FAZER (como antes).
export function registrarCorte({
  carga, codprod, descrprod, codvol, quantidade, motivo, usuarioId,
  nunota = null, sequencia = null, modo = 'MANUAL', status = 'A_FAZER', observacao = null,
}) {
  inserirCorte.run(
    carga, codprod, descrprod, codvol, quantidade, motivo, usuarioId,
    nunota, sequencia, modo, status, observacao,
    status,             // para o CASE do feito_em
    status, usuarioId,  // para o CASE do feito_por
  );
}

// Quanto desse produto já foi cortado nessa carga
export function quantidadeCortada(carga, codprod) {
  return Number(somarCortado.get(carga, codprod).cortado);
}

// Lista os cortes, com o nome de quem criou e de quem marcou como feito
export function listarCortes(status = '') {
  return listar.all(status, status);
}

// Marca um corte como feito, com quem fez. Devolve true se mudou alguma linha.
export function marcarCorteFeito(id, usuarioId) {
  return marcarFeito.run(usuarioId, id).changes > 0;
}