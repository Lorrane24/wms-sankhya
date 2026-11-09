// Abre e fecha o menu lateral no celular.

// 1. Achar o botão e o menu na página, pelo id
const botaoMenu = document.getElementById('botao-menu');
const menu = document.getElementById('menu');

// 2. Esperar alguém tocar no botão
botaoMenu.addEventListener('click', () => {
  // 3. Liga ou desliga a classe "aberto"
  menu.classList.toggle('aberto');
});

// 4. Fechar o menu ao tocar fora dele
document.addEventListener('click', (evento) => {
  const menuAberto = menu.classList.contains('aberto');
  const tocouNoMenu = menu.contains(evento.target);
  const tocouNoBotao = botaoMenu.contains(evento.target);

  if (menuAberto && !tocouNoMenu && !tocouNoBotao) {
    menu.classList.remove('aberto');
  }
});