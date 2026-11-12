// Banco de dados próprio da API (SQLite): guarda conferências, cortes e faturamentos.
// ESTE ARQUIVO FICA EM: api/src/banco.js
import { DatabaseSync } from 'node:sqlite';

// O banco é um arquivo só. Se não existir, é criado sozinho na pasta api.
export const banco = new DatabaseSync('conferencia.db');

// Tabela de bipagens: cada leitura do conferente
banco.exec(`
  CREATE TABLE IF NOT EXISTS bipagens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    carga       INTEGER NOT NULL,
    codprod     INTEGER NOT NULL,
    quantidade  INTEGER NOT NULL,
    codigo_lido TEXT,
    criado_em   TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// Tabela de conferências: guarda quando cada carga foi finalizada
banco.exec(`
  CREATE TABLE IF NOT EXISTS conferencias (
    carga         INTEGER PRIMARY KEY,
    finalizada_em TEXT
  )
`);

// Tabela de cortes: o que faltou e precisa ser cortado do pedido no Sankhya
banco.exec(`
  CREATE TABLE IF NOT EXISTS cortes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    carga      INTEGER NOT NULL,
    codprod    INTEGER NOT NULL,
    descrprod  TEXT,
    codvol     TEXT,
    quantidade INTEGER NOT NULL,
    motivo     TEXT,
    status     TEXT NOT NULL DEFAULT 'A_FAZER',
    criado_em  TEXT DEFAULT (datetime('now', 'localtime')),
    feito_em   TEXT
  )
`);

// Tabela de faturamentos: guarda quando cada carga foi faturada (e se foi simulação)
banco.exec(`
  CREATE TABLE IF NOT EXISTS faturamentos (
    carga       INTEGER PRIMARY KEY,
    modo        TEXT NOT NULL,
    faturado_em TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

console.log('Banco de dados pronto: conferencia.db');