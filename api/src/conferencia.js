// Conferência: guarda e soma as bipagens no banco próprio (SQLite).
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

// Guarda uma bipagem nova
export function registrarBipagem({ carga, codprod, quantidade, codigoLido }) {
  inserirBipagem.run(carga, codprod, quantidade, codigoLido);
}

// Soma tudo o que já foi bipado na carga, produto por produto
export function contagemDaCarga(carga) {
  return somarBipagens.all(carga);
}
