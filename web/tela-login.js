// Tela de Login: manda login e senha para a API e, se der certo, abre o app.
// ESTE ARQUIVO FICA EM: web/tela-login.js

const formLogin = document.getElementById('form-login');
const campoLogin = document.getElementById('campo-login');
const campoSenha = document.getElementById('campo-senha');
const mensagemLogin = document.getElementById('mensagem-login');

async function entrar(evento) {
  evento.preventDefault();
  mensagemLogin.textContent = '';

  try {
    const resposta = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: campoLogin.value.trim(),
        senha: campoSenha.value,
      }),
    });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    // Deu certo: a pulseira já está no cookie. Vai para o app.
    window.location.href = 'cargas.html';
  } catch (erro) {
    mensagemLogin.textContent = `✗ ${erro.message}`;
    mensagemLogin.className = 'mensagem-erro';
    campoSenha.value = '';  // limpa só a senha
    campoSenha.focus();
  }
}

formLogin.addEventListener('submit', entrar);