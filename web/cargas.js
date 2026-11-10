// Tela de Cargas: busca as cargas na API e mostra na tabela.

const corpoTabela = document.getElementById('corpo-tabela');
const nenhumaCarga = document.getElementById('nenhuma-carga');
const botaoAtualizar = document.getElementById('botao-atualizar');
const formBusca = document.getElementById('form-busca');
const campoDe = document.getElementById('data-inicio');
const campoAte = document.getElementById('data-fim');
const campoNumero = document.getElementById('numero-carga');
const marcarTodas = document.getElementById('marcar-todas'); // ⭐
const botaoFaturar = document.getElementById('botao-faturar'); // ⭐
const totalSelecionadas = document.getElementById('total-selecionadas'); // ⭐

// Protege o HTML: troca símbolos perigosos por versões "inofensivas".
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

// Monta o HTML de UMA linha da tabela
function criarLinha(carga) {
  const numero = escapar(carga.ORDEMCARGA);

  return `
    <tr>
      <td><input type="checkbox" value="${numero}" aria-label="Selecionar carga ${numero}"></td>
      <td data-label="Carga"><strong>${numero}</strong> <small>${escapar(carga.REGIAO)}</small></td>
      <td data-label="Data">${escapar(formatarData(carga.DATA))}</td>
      <td data-label="Veículo / motorista">${escapar(carga.VEICULO ?? 'Sem veículo')} <small>${escapar(carga.MOTORISTA ?? 'Sem motorista')}</small></td>
      <td data-label="Pedidos">${escapar(carga.PEDIDOS)}</td>
      <td data-label="Clientes">${escapar(carga.CLIENTES)}</td>
      <td data-label="Situação"><span class="situacao">Não conferida</span></td>
      <td class="celula-acoes"><a href="conferencia.html?carga=${numero}" class="botao botao-contorno">Abrir →</a></td>
    </tr>`;
}

// ⭐ Conta as caixinhas marcadas e atualiza o botão Faturar
function atualizarSelecao() {
  const todas = corpoTabela.querySelectorAll('input[type="checkbox"]');
  const marcadas = corpoTabela.querySelectorAll('input[type="checkbox"]:checked');

  totalSelecionadas.textContent = marcadas.length;
  botaoFaturar.disabled = marcadas.length === 0;
  marcarTodas.checked = todas.length > 0 && marcadas.length === todas.length;
}

// Busca as cargas na API e coloca na tabela
async function carregarCargas() {
  try {
    // Monta os filtros a partir do formulário
    const filtros = new URLSearchParams();
    if (campoDe.value) filtros.set('de', campoDe.value);
    if (campoAte.value) filtros.set('ate', campoAte.value);
    if (campoNumero.value.trim()) filtros.set('numero', campoNumero.value.trim());

    const resposta = await fetch(`/cargas?${filtros}`);
    const dados = await resposta.json();

    // A API respondeu, mas avisou que deu erro
    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    // Mostra nos campos as datas que a API usou
    campoDe.value = dados.de;
    campoAte.value = dados.ate;

    corpoTabela.innerHTML = dados.cargas.map(criarLinha).join('');

    // Mostra o aviso só se a lista vier vazia
    nenhumaCarga.hidden = dados.cargas.length > 0;
  } catch (erro) {
    console.error('Erro ao carregar cargas:', erro);
    corpoTabela.innerHTML = '<tr><td colspan="8">Não foi possível carregar as cargas. Tente de novo em instantes.</td></tr>';
    nenhumaCarga.hidden = true;
  }

  atualizarSelecao(); // ⭐ lista nova = nada marcado
}

// Botão ↻ Atualizar busca de novo
botaoAtualizar.addEventListener('click', carregarCargas);

// Clicou em Buscar (ou apertou Enter no formulário)
formBusca.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarCargas();
});

// ⭐ Marcou ou desmarcou alguma caixinha da tabela
corpoTabela.addEventListener('change', atualizarSelecao);

// ⭐ Marcar todas: copia o estado dela para todas as caixinhas
marcarTodas.addEventListener('change', () => {
  corpoTabela.querySelectorAll('input[type="checkbox"]').forEach((caixa) => {
    caixa.checked = marcarTodas.checked;
  });
  atualizarSelecao();
});

carregarCargas();