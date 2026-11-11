// Conferência: guarda e soma as bipagens no banco próprio (SQLite).
// ESTE ARQUIVO FICA EM: api/src/conferencia.js
import { banco } from './banco.js';

// Comandos SQL "preparados": o ? é um espaço reservado para o valor.
const inserirBipagem = banco.prepare(`
  INSERT INTO bipagens (carga, codprod, quantidade, codigo_lido)
  VALUES (?, ?, ?, ?)
`);

const somarBipagens = banco.prepare(`
  SELECT codprod, SUM(quantidade) AS conferido
  FROM bipagens
  WHERE carga = ?
  GROUP BY codprod
`);

const marcarFinalizada = banco.prepare(`
  INSERT INTO conferencias (carga, finalizada_em)
  VALUES (?, datetime('now', 'localtime'))
  ON CONFLICT(carga) DO NOTHING
`);

const buscarFinalizacao = banco.prepare(`
  SELECT finalizada_em FROM conferencias WHERE carga = ?
`);

// Guarda uma bipagem nova
export function registrarBipagem({ carga, codprod, quantidade, codigoLido }) {
  inserirBipagem.run(carga, codprod, quantidade, codigoLido);
}

// Soma tudo o que já foi bipado na carga, produto por produto
export function contagemDaCarga(carga) {
  return somarBipagens.all(carga);
}

// Finaliza a conferência da carga (se já estiver finalizada, não faz nada)
export function finalizarConferencia(carga) {
  marcarFinalizada.run(carga);
}

// Quando a carga foi finalizada? (null = ainda está aberta)
export function dataFinalizacao(carga) {
  return buscarFinalizacao.get(carga)?.finalizada_em ?? null;
}