// Login: senhas guardadas com hash e sessões (as "pulseiras").
// ESTE ARQUIVO FICA EM: api/src/auth.js
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { banco } from './banco.js';

const DURACAO_SESSAO_HORAS = 12;

// ========== PARTE 1: a "máquina de moer" senha ==========

// Transforma a senha num hash com "sal". Guarda no formato  sal:hash
export function gerarHash(senha) {
  const sal = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

// Confere se a senha digitada bate com o hash guardado
export function conferirSenha(senha, guardado) {
  const [sal, hash] = String(guardado).split(':');
  if (!sal || !hash) return false;

  const tentativa = scryptSync(senha, sal, 64);
  const original = Buffer.from(hash, 'hex');
  if (tentativa.length !== original.length) return false;

  return timingSafeEqual(tentativa, original);
}

// ========== PARTE 2: os comandos SQL ==========

const inserirUsuario = banco.prepare(`
  INSERT INTO usuarios (nome, login, senha_hash) VALUES (?, ?, ?)
`);

const buscarUsuarioPorLogin = banco.prepare(`
  SELECT * FROM usuarios WHERE login = ? AND ativo = 1
`);

const inserirSessao = banco.prepare(`
  INSERT INTO sessoes (token, usuario_id, expira_em)
  VALUES (?, ?, datetime('now', 'localtime', ?))
`);

const buscarSessao = banco.prepare(`
  SELECT u.id, u.nome, u.login
  FROM sessoes s
  JOIN usuarios u ON u.id = s.usuario_id
  WHERE s.token = ?
    AND s.expira_em > datetime('now', 'localtime')
    AND u.ativo = 1
`);

const apagarSessao = banco.prepare(`
  DELETE FROM sessoes WHERE token = ?
`);

// ========== PARTE 3: as funções que o resto da API vai usar ==========

// Cria um usuário novo (a senha vira hash antes de ir para o banco)
export function criarUsuario({ nome, login, senha }) {
  inserirUsuario.run(nome, login, gerarHash(senha));
}

// Tenta entrar. Se login e senha conferem, cria uma sessão e devolve o token.
// Se não conferem, devolve null.
export function entrar(login, senha) {
  const usuario = buscarUsuarioPorLogin.get(login);
  if (!usuario || !conferirSenha(senha, usuario.senha_hash)) {
    return null;
  }

  const token = randomBytes(32).toString('hex');
  inserirSessao.run(token, usuario.id, `+${DURACAO_SESSAO_HORAS} hours`);

  return { token, usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login } };
}

// De quem é essa pulseira? Devolve o usuário, ou null se não vale mais.
export function usuarioDaSessao(token) {
  if (!token) return null;
  return buscarSessao.get(token) ?? null;
}

// Sair: rasga a pulseira
export function sair(token) {
  if (token) apagarSessao.run(token);
}