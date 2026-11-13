// Menu lateral: abre e fecha no celular, e mostra quem está logado (com o botão Sair).
// ESTE ARQUIVO FICA EM: web/menu.js

const botaoMenu = document.getElementById('botao-menu');
const menu = document.getElementById('menu');

// Abre e fecha o menu no celular (botão ☰)
botaoMenu.addEventListener('click', (evento) => {
  evento.stopPropagation(); // não deixa esse clique "chegar" no documento
  menu.classList.toggle('aberto');
});

// Clicou fora do menu? Fecha
document.addEventListener('click', (evento) => {
  if (menu.classList.contains('aberto') && !menu.contains(evento.target)) {
    menu.classList.remove('aberto');
  }
});

// Sair: rasga a pulseira na API e volta para o login
async function sairDoApp() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = 'login.html';
}

// Pergunta à API quem está logado e coloca o nome e o botão Sair no fim do menu
async function mostrarUsuario() {
  try {
    const resposta = await fetch('/eu');
    const dados = await resposta.json();
    if (!dados.ok || !dados.usuario) return;

    const caixa = document.createElement('div');
    caixa.className = 'menu-usuario';

    const nome = document.createElement('span');
    nome.textContent = `👤 ${dados.usuario.nome}`;

    const botaoSair = document.createElement('button');
    botaoSair.type = 'button';
    botaoSair.className = 'botao botao-contorno';
    botaoSair.textContent = 'Sair';
    botaoSair.addEventListener('click', sairDoApp);

    caixa.append(nome, botaoSair);
    menu.append(caixa);
  } catch (erro) {
    console.error('Erro ao buscar o usuário logado:', erro);
  }
}

mostrarUsuario();