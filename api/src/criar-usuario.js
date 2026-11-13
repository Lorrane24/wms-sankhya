// Cria um usuário pelo terminal, fazendo perguntas.
// Como usar (na pasta api):  npm run criar-usuario
// ESTE ARQUIVO FICA EM: api/src/criar-usuario.js
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { criarUsuario } from './auth.js';

// Abre uma "conversa" com o terminal
const conversa = createInterface({ input: stdin, output: stdout });

const nome = (await conversa.question('Nome (ex.: Lorrane): ')).trim();
const login = (await conversa.question('Login (ex.: lorrane): ')).trim().toLowerCase();
const senha = await conversa.question('Senha (mínimo 8 caracteres): ');

conversa.close();

// Confere tudo antes de gravar
if (!nome) {
  console.log('✗ O nome é obrigatório.');
  process.exit(1);
}
if (!/^[a-z0-9._-]{3,30}$/.test(login)) {
  console.log('✗ Login inválido. Use de 3 a 30 letras minúsculas, números, ponto, hífen ou _.');
  process.exit(1);
}
if (senha.length < 8) {
  console.log('✗ A senha precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

try {
  criarUsuario({ nome, login, senha });
  console.log(`✓ Usuário "${login}" criado!`);
} catch (erro) {
  if (String(erro.message).includes('UNIQUE')) {
    console.log(`✗ Já existe um usuário com o login "${login}".`);
  } else {
    console.error('✗ Não foi possível criar o usuário:', erro.message);
  }
  process.exit(1);
}