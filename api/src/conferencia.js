// Conferência: guarda e soma as bipagens no banco próprio (SQLite).
// ESTE ARQUIVO FICA EM: api/src/conferencia.js
import { banco } from './banco.js';

// Comandos SQL "preparados": o ? é um espaço reservado para o valor.
const inserirBipagem = banco.prepare(`
  INSERT INTO bipagens (carga, codprod, quantidade, codigo_lido, usuario_id)
  VALUES (?, ?, ?, ?, ?)
`);

const somarBipagens = banco.prepare(`
  SELECT codprod, SUM(quantidade) AS conferido
  FROM bipagens
  WHERE carga = ?
  GROUP BY codprod
`);

const marcarFinalizada = banco.prepare(`
  INSERT INTO conferencias (carga, finalizada_em, finalizada_por)
  VALUES (?, datetime('now', 'localtime'), ?)
  ON CONFLICT(carga) DO NOTHING
`);

const buscarFinalizacao = banco.prepare(`
  SELECT c.finalizada_em, u.nome AS finalizada_por_nome
  FROM conferencias c
  LEFT JOIN usuarios u ON u.id = c.finalizada_por
  WHERE c.carga = ?
`);

// Guarda uma bipagem nova (com quem bipou)
export function registrarBipagem({ carga, codprod, quantidade, codigoLido, usuarioId }) {
  inserirBipagem.run(carga, codprod, quantidade, codigoLido, usuarioId);
}

// Soma tudo o que já foi bipado na carga, produto por produto
export function contagemDaCarga(carga) {
  return somarBipagens.all(carga);
}

// Finaliza a conferência da carga (se já estiver finalizada, não faz nada)
export function finalizarConferencia(carga, usuarioId) {
  marcarFinalizada.run(carga, usuarioId);
}

// Quando a carga foi finalizada? (null = ainda está aberta)
export function dataFinalizacao(carga) {
  return buscarFinalizacao.get(carga)?.finalizada_em ?? null;
}

// Quem finalizou? (null = aberta, ou finalizada antes do login existir)
export function finalizadaPor(carga) {
  return buscarFinalizacao.get(carga)?.finalizada_por_nome ?? null;
}