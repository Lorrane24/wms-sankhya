// Faturamento: guarda quais cargas foram faturadas (de verdade ou em simulação).
// ESTE ARQUIVO FICA EM: api/src/faturamento.js
import { banco } from './banco.js';

const inserirFaturamento = banco.prepare(`
  INSERT INTO faturamentos (carga, modo)
  VALUES (?, ?)
  ON CONFLICT(carga) DO NOTHING
`);

const buscarFaturamento = banco.prepare(`
  SELECT modo, faturado_em FROM faturamentos WHERE carga = ?
`);

// Registra que a carga foi faturada. Devolve true se registrou agora,
// false se ela já estava faturada antes.
export function registrarFaturamento(carga, modo) {
  return inserirFaturamento.run(carga, modo).changes > 0;
}

// A carga já foi faturada? Devolve { modo, faturado_em } ou null.
export function situacaoFaturamento(carga) {
  return buscarFaturamento.get(carga) ?? null;
}