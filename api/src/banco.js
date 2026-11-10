// Banco de dados próprio da API (SQLite): guarda as bipagens da conferência.
import { DatabaseSync } from 'node:sqlite';

// O banco é um arquivo só. Se não existir, é criado sozinho na pasta api.
export const banco = new DatabaseSync('conferencia.db');

// Cria a tabela de bipagens na primeira vez (se ainda não existir)
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

console.log('Banco de dados pronto: conferencia.db');