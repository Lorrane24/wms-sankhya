// Tela de Conferência: mostra o que já foi bipado e recebe novas bipagens.
// ESTE ARQUIVO FICA EM: web/tela-conferencia.js

// O número da carga vem do endereço: conferencia.html?carga=1001
const parametros = new URLSearchParams(window.location.search);
const numeroCarga = parametros.get('carga');

const tituloCarga = document.getElementById('titulo-carga');
const detalheCarga = document.getElementById('detalhe-carga');
const corpoContagem = document.getElementById('corpo-contagem');
const nadaBipado = document.getElementById('nada-bipado');
const formBipar = document.getElementById('form-bipar');
const campoBipar = document.getElementById('campo-bipar');
const campoQuantidade = document.getElementById('campo-quantidade');
const mensagemBipagem = document.getElementById('mensagem-bipagem');

// Protege o HTML (o mesmo da tela de Cargas)
function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Uma linha da tabela "Já conferido" (sem o esperado: conferência cega)
function criarLinhaContagem(item) {
  return `
    <tr>
      <td data-label="Produto">${escapar(item.DESCRPROD)}</td>
      <td data-label="Unidade">${escapar(item.CODVOL)}</td>
      <td data-label="Conferido"><strong>${escapar(item.CONFERIDO)}</strong></td>
    </tr>`;
}

// Busca a conferência na API e mostra só o que já foi bipado
async function carregarConferencia() {
  try {
    const resposta = await fetch(`/cargas/${encodeURIComponent(numeroCarga)}/conferencia`);
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    const bipados = dados.itens.filter((item) => item.CONFERIDO > 0);

    corpoContagem.innerHTML = bipados.map(criarLinhaContagem).join('');
    nadaBipado.hidden = bipados.length > 0;
    detalheCarga.textContent = `${bipados.length} produto(s) já conferido(s)`;
  } catch (erro) {
    console.error('Erro ao carregar a conferência:', erro);
    detalheCarga.textContent = 'Não foi possível carregar a conferência.';
  }
}

// Mostra a mensagem embaixo do campo (verde se deu certo, vermelha se deu erro)
function mostrarMensagem(texto, deuCerto) {
  mensagemBipagem.textContent = texto;
  mensagemBipagem.className = deuCerto ? 'mensagem-ok' : 'mensagem-erro';
}

// Envia a bipagem para a API
async function enviarBipagem(evento) {
  evento.preventDefault();

  const codigo = campoBipar.value.trim();
  const quantidade = Number(campoQuantidade.value);

  if (!codigo) {
    mostrarMensagem('Bipe ou digite um código.', false);
    campoBipar.focus();
    return;
  }

  try {
    const resposta = await fetch(`/cargas/${encodeURIComponent(numeroCarga)}/bipagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, quantidade }),
    });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    mostrarMensagem(`✓ ${dados.descricao}: +${dados.quantidade}`, true);
    await carregarConferencia(); // atualiza a tabela
  } catch (erro) {
    mostrarMensagem(`✗ ${erro.message}`, false);
    navigator.vibrate?.(300); // vibra o celular no erro (se ele tiver vibração)
  } finally {
    // Prepara para a próxima leitura
    campoBipar.value = '';
    campoQuantidade.value = 1;
    campoBipar.focus();
  }
}

// Enter no campo (ou o leitor do coletor) envia o formulário
formBipar.addEventListener('submit', enviarBipagem);

// Sem número no endereço? Volta para a lista de cargas.
if (!numeroCarga) {
  window.location.href = 'cargas.html';
} else {
  tituloCarga.textContent = `Carga ${numeroCarga}`;
  carregarConferencia();
}