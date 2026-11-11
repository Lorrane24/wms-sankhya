// Tela de Cortes: lista os cortes e marca como feito.


const filtroStatus = document.getElementById('filtro-status');
const corpoCortes = document.getElementById('corpo-cortes');
const nenhumCorte = document.getElementById('nenhum-corte');
const mensagemCortes = document.getElementById('mensagem-cortes');
const botaoImprimir = document.getElementById('botao-imprimir');
const janelaFeito = document.getElementById('janela-feito');
const feitoTexto = document.getElementById('feito-texto');
const cancelarFeito = document.getElementById('cancelar-feito');
const confirmarFeito = document.getElementById('confirmar-feito');

let corteSelecionado = null; // o id do corte que está na janela agora

// Protege o HTML (o mesmo das outras telas)
function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// '2026-11-11 14:30:05' vira '11/11/2026 14:30'
function formatarDataHora(texto) {
  if (!texto) return '';
  const [data, hora] = String(texto).split(' ');
  return `${data.split('-').reverse().join('/')} ${hora.slice(0, 5)}`;
}

// Mostra uma mensagem (verde se deu certo, vermelha se deu erro)
function mostrarMensagem(texto, deuCerto) {
  mensagemCortes.textContent = texto;
  mensagemCortes.className = deuCerto ? 'mensagem-ok' : 'mensagem-erro';
}

// Uma linha da tabela de cortes
function criarLinha(corte) {
  const feito = corte.status === 'FEITO';

  const situacao = feito
    ? `<span class="situacao conferida">Feito</span> <small>${escapar(formatarDataHora(corte.feito_em))}</small>`
    : '<span class="situacao naoconferida">A fazer</span>';

  const botaoFeito = feito
    ? ''
    : `<button type="button" class="botao botao-principal botao-feito" data-id="${escapar(corte.id)}">Feito</button>`;

  return `
    <tr>
      <td data-label="Carga"><strong>${escapar(corte.carga)}</strong></td>
      <td data-label="Produto">${escapar(corte.descrprod)}</td>
      <td data-label="Cortar">${escapar(corte.quantidade)} ${escapar(corte.codvol)}</td>
      <td data-label="Motivo">${escapar(corte.motivo || '—')}</td>
      <td data-label="Situação">${situacao}</td>
      <td class="celula-acoes">
        ${botaoFeito}
        <a href="conferencia.html?carga=${escapar(corte.carga)}" class="botao botao-contorno">Ver conferência</a>
      </td>
    </tr>`;
}

// Guarda a lista que está na tela, para achar o corte no clique
let cortesNaTela = [];

// Busca os cortes na API (conforme o filtro) e mostra na tabela
async function carregarCortes() {
  try {
    const resposta = await fetch(`/cortes?status=${encodeURIComponent(filtroStatus.value)}`);
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    cortesNaTela = dados.cortes;
    corpoCortes.innerHTML = dados.cortes.map(criarLinha).join('');
    nenhumCorte.hidden = dados.cortes.length > 0;
  } catch (erro) {
    console.error('Erro ao carregar cortes:', erro);
    corpoCortes.innerHTML = '<tr><td colspan="6">Não foi possível carregar os cortes. Tente de novo.</td></tr>';
    nenhumCorte.hidden = true;
  }
}

// Abre a janela de confirmação para o corte clicado
function abrirJanelaFeito(id) {
  const corte = cortesNaTela.find((c) => c.id === id);
  if (!corte) return;

  corteSelecionado = id;
  feitoTexto.textContent = `Carga ${corte.carga} · ${corte.descrprod} · cortar ${corte.quantidade} ${corte.codvol}`;
  janelaFeito.showModal();
}

// Confirmou: marca como feito na API e recarrega a lista
async function marcarFeito() {
  try {
    const resposta = await fetch(`/cortes/${corteSelecionado}/feito`, { method: 'POST' });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    mostrarMensagem('✓ Corte marcado como feito.', true);
    await carregarCortes();
  } catch (erro) {
    mostrarMensagem(`✗ ${erro.message}`, false);
  } finally {
    janelaFeito.close();
    corteSelecionado = null;
  }
}

// Trocou a situação no filtro: busca de novo
filtroStatus.addEventListener('change', carregarCortes);

// Clique em qualquer botão "Feito" da tabela (delegação de evento)
corpoCortes.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.botao-feito');
  if (!botao) return;
  abrirJanelaFeito(Number(botao.dataset.id));
});

// Janela de confirmação
cancelarFeito.addEventListener('click', () => janelaFeito.close());
confirmarFeito.addEventListener('click', marcarFeito);

// Imprimir a lista
botaoImprimir.addEventListener('click', () => window.print());

carregarCortes();