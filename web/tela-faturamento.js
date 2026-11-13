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

// ⭐ Caixa do andamento: o próprio JS cria, logo abaixo da mensagem (não precisa mexer no HTML)
const caixaAndamento = document.createElement('div');
caixaAndamento.id = 'andamento-faturamento';
mensagem.after(caixaAndamento);

// ⭐ Cargas que estamos acompanhando (número → temporizador)
const acompanhando = new Map();

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

  // Quem faturou (vazio nas ações antigas, de antes do login)
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
      <td class="celula-acoes">
        <a href="conferencia.html?carga=${numero}" class="botao botao-contorno">Ver</a>
        ${carga.CONFERIDA && carga.MODO_FATURAMENTO !== 'SIMULACAO' ? `<button type="button" class="botao botao-contorno" data-andamento="${numero}">Andamento</button>` : ''}
      </td>
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

// ⭐ Uma linha da tabela de andamento (um pedido)
function linhaAndamento(p) {
  const nomes = {
    PENDENTE: 'Esperando',
    PROCESSANDO: 'Faturando…',
    CONCLUIDO: '✓ Concluído',
    ERRO: '✗ Erro',
  };
  const classe = p.status === 'CONCLUIDO' ? 'conferida' : p.status === 'ERRO' ? 'naoconferida' : '';
  const erro = p.mensagem
    ? `<tr><td colspan="7" class="mensagem-erro">${escapar(p.mensagem)}</td></tr>`
    : '';

  return `
    <tr>
      <td data-label="Pedido"><strong>${escapar(p.nunota)}</strong></td>
      <td data-label="Cliente">${escapar(p.cliente)}</td>
      <td data-label="Situação"><span class="situacao ${classe}">${nomes[p.status] ?? escapar(p.status)}</span></td>
      <td data-label="Etapa">${escapar(p.etapa)}</td>
      <td data-label="Nota 56">${escapar(p.nunota_56 ?? '—')}</td>
      <td data-label="Cópia 26">${escapar(p.nunota_26 ?? '—')}</td>
      <td data-label="Nota 32">${escapar(p.nunota_32 ?? '—')}</td>
    </tr>${erro}`;
}

// ⭐ Mostra (ou atualiza) o quadro de uma carga
function mostrarAndamento(dados) {
  const id = `andamento-${dados.carga}`;
  let quadro = document.getElementById(id);
  if (!quadro) {
    quadro = document.createElement('section');
    quadro.id = id;
    caixaAndamento.append(quadro);
  }

  const titulo = dados.faturando ? 'faturando no Sankhya…' : 'parado';
  const corpo = dados.pedidos.length
    ? dados.pedidos.map(linhaAndamento).join('')
    : '<tr><td colspan="7">Ainda não começou.</td></tr>';

  quadro.innerHTML = `
    <h3>Carga ${escapar(dados.carga)} · ${titulo}</h3>
    <table>
      <thead>
        <tr><th>Pedido</th><th>Cliente</th><th>Situação</th><th>Etapa</th><th>Nota 56</th><th>Cópia 26</th><th>Nota 32</th></tr>
      </thead>
      <tbody>${corpo}</tbody>
    </table>`;
}

// ⭐ Pergunta à API como está o faturamento de uma carga
async function buscarAndamento(carga) {
  const resposta = await fetch(`/faturamento/${carga}/andamento`);
  const dados = await resposta.json();
  if (!dados.ok) throw new Error(dados.erro);
  mostrarAndamento(dados);
  return dados;
}

// ⭐ Acompanha a carga: pergunta a cada 3 segundos até terminar
function acompanhar(carga) {
  if (acompanhando.has(carga)) return; // já está acompanhando

  const verificar = async () => {
    try {
      const dados = await buscarAndamento(carga);
      if (!dados.faturando) {
        clearInterval(acompanhando.get(carga));
        acompanhando.delete(carga);
        await carregarCargas(); // atualiza a tabela (Faturada ou não)
      }
    } catch (erro) {
      console.error('Erro ao ver o andamento:', erro);
    }
  };

  acompanhando.set(carga, setInterval(verificar, 3000));
  verificar(); // primeira vez já
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
      mostrarMensagem(dados.simulacao
        ? `✓ ${certas} carga(s) faturada(s) (simulação).`
        : `✓ Faturamento começou em ${certas} carga(s). Acompanhe abaixo.`, true);
    } else {
      const detalhe = problemas.map((p) => `${p.carga}: ${p.mensagem}`).join(' · ');
      mostrarMensagem(`${certas} começaram. Com problema: ${detalhe}`, false);
    }

    // ⭐ Modo real: acompanha as cargas que começaram a faturar
    if (!dados.simulacao) {
      dados.resultados.filter((r) => r.ok).forEach((r) => acompanhar(r.carga));
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

// ⭐ Clicou em Andamento numa linha
corpoTabela.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-andamento]');
  if (!botao) return;
  acompanhar(Number(botao.dataset.andamento));
});

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