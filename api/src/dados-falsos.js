// Dados de mentira para desenvolver quando o Sankhya estiver fora do ar.
// Mesmos nomes de colunas que o SQL de verdade devolve.

export const CARGAS_FALSAS = [
  { ORDEMCARGA: 1001, PEDIDOS: 12, CLIENTES: 9, DATA: '2026-11-10', REGIAO: 'Região Centro', VEICULO: 'Caminhão Exemplo - AAA1A11', MOTORISTA: 'Motorista Exemplo 1' },
  { ORDEMCARGA: 1002, PEDIDOS: 8,  CLIENTES: 6, DATA: '2026-11-09', REGIAO: 'Região Norte',  VEICULO: 'Van Exemplo - BBB2B22',      MOTORISTA: 'Motorista Exemplo 2' },
  { ORDEMCARGA: 1003, PEDIDOS: 15, CLIENTES: 11, DATA: '2026-11-08', REGIAO: 'Região Sul',   VEICULO: 'Caminhão Exemplo - CCC3C33', MOTORISTA: 'Motorista Exemplo 3' },
  { ORDEMCARGA: 1004, PEDIDOS: 5,  CLIENTES: 4, DATA: '2026-11-07', REGIAO: null,            VEICULO: null,                         MOTORISTA: null },
];


// Itens de cada carga: o que tem que ir no caminhão.
// A chave é o número da carga.
export const ITENS_FALSOS = {
  1001: [
    { CODPROD: 101, DESCRPROD: 'Leite em Pó Exemplo 400g', CODVOL: 'UN', QTDESPERADA: 24 },
    { CODPROD: 102, DESCRPROD: 'Chocolate em Pó Exemplo 200g', CODVOL: 'UN', QTDESPERADA: 12 },
    { CODPROD: 103, DESCRPROD: 'Granulado Exemplo 1kg', CODVOL: 'CX', QTDESPERADA: 3 },
  ],
  1002: [
    { CODPROD: 104, DESCRPROD: 'Polvilho Exemplo 500g', CODVOL: 'UN', QTDESPERADA: 30 },
    { CODPROD: 101, DESCRPROD: 'Leite em Pó Exemplo 400g', CODVOL: 'UN', QTDESPERADA: 6 },
  ],
};


// Produtos com código de barras falso, para testar a bipagem.
// Códigos que começam com 2 são reservados para uso interno (não existem no mercado).
export const PRODUTOS_FALSOS = [
  { CODPROD: 101, DESCRPROD: 'Leite em Pó Exemplo 400g', CODVOL: 'UN', CODBARRA: '2000000000101' },
  { CODPROD: 102, DESCRPROD: 'Chocolate em Pó Exemplo 200g', CODVOL: 'UN', CODBARRA: '2000000000102' },
  { CODPROD: 103, DESCRPROD: 'Granulado Exemplo 1kg', CODVOL: 'CX', CODBARRA: '2000000000103' },
  { CODPROD: 104, DESCRPROD: 'Polvilho Exemplo 500g', CODVOL: 'UN', CODBARRA: '2000000000104' },
];