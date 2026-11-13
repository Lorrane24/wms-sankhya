// Tela de Faturamento: lista as cargas, mostra quais estão conferidas e fatura.
// ESTE ARQUIVO FICA EM: web/tela-faturamento.js

const formBusca = document.getElementById('form-busca-faturamento');
const campoDe = document.getElementById('fat-data-inicio');
const campoAte = document.getElementById('fat-data-fim');
const campoNumero = document.getElementById('fat-numero-carga');
const marcarTodas = document.getElementById('fat-marcar-todas');
const botaoFaturar = document.getElementById('botao-faturar');
const totalSelecionadas = document.getElementById('fat-total-selecionadas');
const mensagem = document.getElementById('mensagem-faturamento');
const corpoTabela = document.getElementById('corpo-faturamento');
const nenhumaCarga = document.getElementById('fat-nenhuma-carga');
const janelaConfirmar = document.getElementById('confirmar-faturamento');
const textoConfirmar = document.getElementById('texto-confirmar');
const cancelarFaturamento = document.getElementById('cancelar-faturamento');
const confirmarFaturar = document.getElementById('confirmar-faturar');

// Protege o HTML (o mesmo das outras telas)
function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// '2026-11-10' vira '10/11/2026'
function formatarData(dataIso) {
  if (!dataIso) return '';
  return dataIso.split('-').reverse().join('/');
}

// '2026-11-11 14:30:05' vira '11/11/2026 14:30'
function formatarDataHora(texto) {
  if (!texto) return '';
  const [data, hora] = String(texto).split(' ');
  return `${formatarData(data)} ${hora.slice(0, 5)}`;
}

// Mostra uma mensagem (verde se deu certo, vermelha se deu erro)
function mostrarMensagem(texto, deuCerto) {
  mensagem.textContent = texto;
  mensagem.className = deuCerto ? 'mensagem-ok' : 'mensagem-erro';
}

// Uma linha da tabela
function criarLinha(carga) {
  const numero = escapar(carga.ORDEMCARGA);

  // Só dá para marcar carga CONFERIDA e ainda NÃO faturada
  const podeFaturar = carga.CONFERIDA && !carga.FATURADA;
  const caixa = podeFaturar
    ? `<input type="checkbox" value="${numero}" aria-label="Selecionar carga ${numero}">`
    : '';

  const conferencia = carga.CONFERIDA
    ? '<span class="situacao conferida">Conferida</span>'
    : '<span class="situacao naoconferida">Não conferida</span>';

  // ⭐ Quem faturou (vazio nas ações antigas, de antes do login)
  const faturadaPor = carga.FATURADA_POR ? ` por ${carga.FATURADA_POR}` : '';

  const faturamento = carga.FATURADA
    ? `<span class="situacao conferida">Faturada${carga.MODO_FATURAMENTO === 'SIMULACAO' ? ' (simulação)' : ''}</span> <small>${escapar(formatarDataHora(carga.FATURADA_EM) + faturadaPor)}</small>`
    : '—';

  return `
    <tr>
      <td>${caixa}</td>
      <td data-label="Carga"><strong>${numero}</strong> <small>${escapar(carga.REGIAO)}</small></td>
      <td data-label="Data">${escapar(formatarData(carga.DATA))}</td>
      <td data-label="Veículo / motorista">${escapar(carga.VEICULO ?? 'Sem veículo')} <small>${escapar(carga.MOTORISTA ?? 'Sem motorista')}</small></td>
      <td data-label="Pedidos">${escapar(carga.PEDIDOS)}</td>
      <td data-label="Clientes">${escapar(carga.CLIENTES)}</td>
      <td data-label="Conferência">${conferencia}</td>
      <td data-label="Faturamento">${faturamento}</td>
      <td class="celula-acoes"><a href="conferencia.html?carga=${numero}" class="botao botao-contorno">Ver</a></td>
    </tr>`;
}

// Lista das caixinhas marcadas (os números das cargas)
function cargasMarcadas() {
  return [...corpoTabela.querySelectorAll('input[type="checkbox"]:checked')]
    .map((caixa) => Number(caixa.value));
}

// Conta as marcadas e atualiza o botão Faturar
function atualizarSelecao() {
  const todas = corpoTabela.querySelectorAll('input[type="checkbox"]');
  const marcadas = cargasMarcadas();

  totalSelecionadas.textContent = marcadas.length;
  botaoFaturar.disabled = marcadas.length === 0;
  marcarTodas.checked = todas.length > 0 && marcadas.length === todas.length;
}

// Busca as cargas na API e coloca na tabela
async function carregarCargas() {
  try {
    const filtros = new URLSearchParams();
    if (campoDe.value) filtros.set('de', campoDe.value);
    if (campoAte.value) filtros.set('ate', campoAte.value);
    if (campoNumero.value.trim()) filtros.set('numero', campoNumero.value.trim());

    const resposta = await fetch(`/faturamento?${filtros}`);
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    campoDe.value = dados.de;
    campoAte.value = dados.ate;

    corpoTabela.innerHTML = dados.cargas.map(criarLinha).join('');
    nenhumaCarga.hidden = dados.cargas.length > 0;
  } catch (erro) {
    console.error('Erro ao carregar cargas:', erro);
    corpoTabela.innerHTML = '<tr><td colspan="9">Não foi possível carregar as cargas. Tente de novo.</td></tr>';
    nenhumaCarga.hidden = true;
  }

  atualizarSelecao();
}

// Abre a janela de confirmação
function abrirConfirmacao() {
  const quantas = cargasMarcadas().length;
  textoConfirmar.textContent = `Você vai faturar ${quantas} carga(s).`;
  janelaConfirmar.showModal();
}

// Confirmou: manda as cargas para a API e mostra o resultado de cada uma
async function faturar() {
  try {
    const resposta = await fetch('/faturamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cargas: cargasMarcadas() }),
    });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    const certas = dados.resultados.filter((r) => r.ok).length;
    const problemas = dados.resultados.filter((r) => !r.ok);

    if (problemas.length === 0) {
      mostrarMensagem(`✓ ${certas} carga(s) faturada(s)${dados.simulacao ? ' (simulação)' : ''}.`, true);
    } else {
      const detalhe = problemas.map((p) => `${p.carga}: ${p.mensagem}`).join(' · ');
      mostrarMensagem(`${certas} faturada(s). Com problema: ${detalhe}`, false);
    }

    await carregarCargas();
  } catch (erro) {
    mostrarMensagem(`✗ ${erro.message}`, false);
  } finally {
    janelaConfirmar.close();
  }
}

// Buscar
formBusca.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarCargas();
});

// Marcou ou desmarcou alguma caixinha (delegação de evento)
corpoTabela.addEventListener('change', atualizarSelecao);

// Marcar todas
marcarTodas.addEventListener('change', () => {
  corpoTabela.querySelectorAll('input[type="checkbox"]').forEach((caixa) => {
    caixa.checked = marcarTodas.checked;
  });
  atualizarSelecao();
});

// Faturar → janela → confirmar ou cancelar
botaoFaturar.addEventListener('click', abrirConfirmacao);
cancelarFaturamento.addEventListener('click', () => janelaConfirmar.close());
confirmarFaturar.addEventListener('click', faturar);

carregarCargas();