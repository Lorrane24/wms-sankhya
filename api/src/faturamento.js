// Faturamento: guarda quais cargas foram faturadas (de verdade ou em simulação).
// ESTE ARQUIVO FICA EM: api/src/faturamento.js
import { banco } from './banco.js';

const inserirFaturamento = banco.prepare(`
  INSERT INTO faturamentos (carga, modo, faturado_por)
  VALUES (?, ?, ?)
  ON CONFLICT(carga) DO NOTHING
`);

const buscarFaturamento = banco.prepare(`
  SELECT f.modo, f.faturado_em, u.nome AS faturado_por_nome
  FROM faturamentos f
  LEFT JOIN usuarios u ON u.id = f.faturado_por
  WHERE f.carga = ?
`);

// Registra que a carga foi faturada, com quem faturou.
// Devolve true se registrou agora, false se ela já estava faturada.
export function registrarFaturamento(carga, modo, usuarioId) {
  return inserirFaturamento.run(carga, modo, usuarioId).changes > 0;
}

// A carga já foi faturada? Devolve { modo, faturado_em, faturado_por_nome } ou null.
export function situacaoFaturamento(carga) {
  return buscarFaturamento.get(carga) ?? null;
}