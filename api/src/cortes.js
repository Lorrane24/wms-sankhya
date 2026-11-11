// Cortes: o que faltou na conferência e precisa ser cortado do pedido.
// ESTE ARQUIVO FICA EM: api/src/cortes.js
import { banco } from './banco.js';

const inserirCorte = banco.prepare(`
  INSERT INTO cortes (carga, codprod, descrprod, codvol, quantidade, motivo)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const somarCortado = banco.prepare(`
  SELECT COALESCE(SUM(quantidade), 0) AS cortado
  FROM cortes
  WHERE carga = ? AND codprod = ?
`);

const listar = banco.prepare(`
  SELECT * FROM cortes
  WHERE (? = '' OR status = ?)
  ORDER BY CASE WHEN status = 'A_FAZER' THEN 0 ELSE 1 END, id DESC
`);

const marcarFeito = banco.prepare(`
  UPDATE cortes
  SET status = 'FEITO', feito_em = datetime('now', 'localtime')
  WHERE id = ? AND status = 'A_FAZER'
`);

// Registra um corte novo (nasce como A_FAZER)
export function registrarCorte({ carga, codprod, descrprod, codvol, quantidade, motivo }) {
  inserirCorte.run(carga, codprod, descrprod, codvol, quantidade, motivo);
}

// Quanto desse produto já foi cortado nessa carga
export function quantidadeCortada(carga, codprod) {
  return Number(somarCortado.get(carga, codprod).cortado);
}

// Lista os cortes; status vazio = todos. "A fazer" aparecem primeiro.
export function listarCortes(status = '') {
  return listar.all(status, status);
}

// Marca um corte como feito. Devolve true se mudou alguma linha.
export function marcarCorteFeito(id) {
  return marcarFeito.run(id).changes > 0;
}