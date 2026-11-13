// Banco de dados próprio da API (SQLite): conferências, cortes, faturamentos e usuários.
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

// Tabela de usuários: quem pode entrar no app (a senha fica só como hash)
banco.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome       TEXT NOT NULL,
    login      TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    ativo      INTEGER NOT NULL DEFAULT 1,
    criado_em  TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// Tabela de sessões: as "pulseiras" de quem está logado
banco.exec(`
  CREATE TABLE IF NOT EXISTS sessoes (
    token      TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    criado_em  TEXT DEFAULT (datetime('now', 'localtime')),
    expira_em  TEXT NOT NULL
  )
`);

// ========== MIGRAÇÕES: colunas novas em tabelas que já existem ==========

// Acrescenta uma coluna, só se ela ainda não existir
function adicionarColuna(tabela, coluna, tipo) {
  const colunas = banco.prepare(`PRAGMA table_info(${tabela})`).all();
  const jaExiste = colunas.some((c) => c.name === coluna);

  if (!jaExiste) {
    banco.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
    console.log(`Migração: coluna "${coluna}" criada na tabela "${tabela}"`);
  }
}

// Quem fez cada coisa (guarda o id do usuário)
adicionarColuna('bipagens', 'usuario_id', 'INTEGER');
adicionarColuna('conferencias', 'finalizada_por', 'INTEGER');
adicionarColuna('cortes', 'criado_por', 'INTEGER');
adicionarColuna('cortes', 'feito_por', 'INTEGER');
adicionarColuna('faturamentos', 'faturado_por', 'INTEGER');

// Corte de verdade no Sankhya: de qual pedido/item e o que aconteceu
adicionarColuna('cortes', 'nunota', 'INTEGER');
adicionarColuna('cortes', 'sequencia', 'INTEGER');
adicionarColuna('cortes', 'modo', 'TEXT');
adicionarColuna('cortes', 'observacao', 'TEXT');

console.log('Banco de dados pronto: conferencia.db');

// Andamento do faturamento real, pedido por pedido
banco.exec(`
  CREATE TABLE IF NOT EXISTS fat_pedidos (
    nunota        INTEGER PRIMARY KEY,
    carga         INTEGER NOT NULL,
    cliente       TEXT,
    status        TEXT NOT NULL,
    etapa         TEXT,
    mensagem      TEXT,
    nunota_56     INTEGER,
    nunota_26     INTEGER,
    nunota_32     INTEGER,
    feito_por     INTEGER,
    atualizado_em TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);