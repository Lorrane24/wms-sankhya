// Ferramentas para montar SQL com segurança.

// Transforma um valor de texto num texto SQL seguro: 'valor'
export function textoSql(valor) {
  // 1. Aspa simples vira duas aspas ('' = uma aspa dentro do texto)
  const escapado = String(valor).replace(/'/g, "''");

  // 2. O Sankhya apaga tudo depois de "--", mesmo dentro de um texto.
  //    Então quebramos o texto nesses pontos e montamos o "--" com CHR(45).
  return escapado
    .split('--')
    .map((parte) => `'${parte}'`)
    .join(' || CHR(45) || CHR(45) || ');
}