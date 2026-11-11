// Tela de Conferência: mostra o que já foi bipado, recebe bipagens, finaliza e corta.

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
const momentoAberta = document.getElementById('momento-aberta');
const momentoFinalizada = document.getElementById('momento-finalizada');
const corpoResultado = document.getElementById('corpo-resultado');
const botaoFinalizar = document.getElementById('botao-finalizar');
const botaoImprimir = document.getElementById('botao-imprimir');
const janelaFinalizar = document.getElementById('janela-finalizar');
const cancelarFinalizar = document.getElementById('cancelar-finalizar');
const confirmarFinalizar = document.getElementById('confirmar-finalizar');
const mensagemCorte = document.getElementById('mensagem-corte'); // ⭐
const janelaCorte = document.getElementById('janela-corte'); // ⭐
const formCorte = document.getElementById('form-corte'); // ⭐
const corteProduto = document.getElementById('corte-produto'); // ⭐
const corteQuantidade = document.getElementById('corte-quantidade'); // ⭐
const corteMotivo = document.getElementById('corte-motivo'); // ⭐
const cancelarCorte = document.getElementById('cancelar-corte'); // ⭐

// ⭐ Guardam informações que mudam enquanto a tela está aberta
let itensFinalizados = []; // os itens do resultado, para achar o produto no clique
let itemCortando = null;   // o produto que está na janela de corte agora

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

// Texto da diferença: OK, Falta X ou Sobra X
function textoDiferenca(item) {
  const diferenca = item.CONFERIDO - item.QTDESPERADA;
  if (diferenca === 0) return '✓ OK';
  if (diferenca < 0) return `Falta ${-diferenca}`;
  return `Sobra ${diferenca}`;
}

// ⭐ Quanto ainda dá para cortar: o que faltou menos o que já foi cortado
function disponivelParaCortar(item) {
  return Math.max(item.FALTA - item.CORTADO, 0);
}

// Uma linha da tabela "Resultado" (depois de finalizar)
function criarLinhaResultado(item) {
  // ⭐ Botão Cortar só aparece se ainda tiver falta para cortar
  const botaoCortar = disponivelParaCortar(item) > 0
    ? `<button type="button" class="botao botao-contorno botao-cortar" data-codprod="${escapar(item.CODPROD)}">Cortar</button>`
    : '';

  return `
    <tr>
      <td data-label="Produto">${escapar(item.DESCRPROD)}</td>
      <td data-label="Esperado">${escapar(item.QTDESPERADA)}</td>
      <td data-label="Conferido">${escapar(item.CONFERIDO)}</td>
      <td data-label="Diferença"><strong>${escapar(textoDiferenca(item))}</strong></td>
      <td data-label="Cortado">${escapar(item.CORTADO)}</td>
      <td class="celula-acoes">${botaoCortar}</td>
    </tr>`;
}

// '2026-11-11 14:30:05' vira '11/11/2026 14:30'
function formatarDataHora(texto) {
  const [data, hora] = String(texto).split(' ');
  return `${data.split('-').reverse().join('/')} ${hora.slice(0, 5)}`;
}

// Troca a tela para o "momento 2": conferência finalizada
function mostrarFinalizada(dados) {
  momentoAberta.hidden = true;
  momentoFinalizada.hidden = false;
  botaoFinalizar.hidden = true;
  botaoImprimir.hidden = false;

  itensFinalizados = dados.itens; // ⭐ guarda para usar no clique do Cortar
  corpoResultado.innerHTML = dados.itens.map(criarLinhaResultado).join('');

  const comDiferenca = dados.itens.filter((item) => item.CONFERIDO !== item.QTDESPERADA).length;
  const quando = formatarDataHora(dados.finalizadaEm);

  detalheCarga.textContent = comDiferenca === 0
    ? `Finalizada em ${quando} · tudo certo ✓`
    : `Finalizada em ${quando} · ${comDiferenca} produto(s) com diferença`;
}

// Busca a conferência na API e mostra o momento certo
async function carregarConferencia() {
  try {
    const resposta = await fetch(`/cargas/${encodeURIComponent(numeroCarga)}/conferencia`);
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    // Já finalizada? Mostra o resultado e para por aqui
    if (dados.finalizada) {
      mostrarFinalizada(dados);
      return;
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

// ⭐ Mostra uma mensagem (verde se deu certo, vermelha se deu erro)
// Agora recebe EM QUAL elemento escrever: serve para a bipagem e para o corte
function mostrarMensagem(elemento, texto, deuCerto) {
  elemento.textContent = texto;
  elemento.className = deuCerto ? 'mensagem-ok' : 'mensagem-erro';
}

// Envia a bipagem para a API
async function enviarBipagem(evento) {
  evento.preventDefault();

  const codigo = campoBipar.value.trim();
  const quantidade = Number(campoQuantidade.value);

  if (!codigo) {
    mostrarMensagem(mensagemBipagem, 'Bipe ou digite um código.', false);
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

    mostrarMensagem(mensagemBipagem, `✓ ${dados.descricao}: +${dados.quantidade}`, true);
    await carregarConferencia(); // atualiza a tabela
  } catch (erro) {
    mostrarMensagem(mensagemBipagem, `✗ ${erro.message}`, false);
    navigator.vibrate?.(300); // vibra o celular no erro (se ele tiver vibração)
  } finally {
    // Prepara para a próxima leitura
    campoBipar.value = '';
    campoQuantidade.value = 1;
    campoBipar.focus();
  }
}

// Confirmou na janela: finaliza na API e recarrega a tela
async function finalizar() {
  try {
    const resposta = await fetch(`/cargas/${encodeURIComponent(numeroCarga)}/finalizar`, { method: 'POST' });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    janelaFinalizar.close();
    await carregarConferencia(); // agora vem finalizada
  } catch (erro) {
    janelaFinalizar.close();
    mostrarMensagem(mensagemBipagem, `✗ Não foi possível finalizar: ${erro.message}`, false);
  }
}

// ⭐ Abre a janela de corte já preenchida para o produto clicado
function abrirJanelaCorte(codprod) {
  const item = itensFinalizados.find((i) => Number(i.CODPROD) === codprod);
  if (!item) return;

  const disponivel = disponivelParaCortar(item);
  itemCortando = item;

  corteProduto.textContent = `${item.DESCRPROD} · pode cortar até ${disponivel} ${item.CODVOL}`;
  corteQuantidade.max = disponivel;
  corteQuantidade.value = disponivel; // já sugere cortar tudo o que faltou
  corteMotivo.value = '';

  janelaCorte.showModal();
}

// ⭐ Envia o corte para a API
async function enviarCorte(evento) {
  evento.preventDefault();
  if (!itemCortando) return;

  try {
    const resposta = await fetch(`/cargas/${encodeURIComponent(numeroCarga)}/cortes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codprod: Number(itemCortando.CODPROD),
        quantidade: Number(corteQuantidade.value),
        motivo: corteMotivo.value.trim(),
      }),
    });
    const dados = await resposta.json();

    if (!dados.ok) {
      throw new Error(dados.erro);
    }

    mostrarMensagem(mensagemCorte, `✓ Corte registrado: ${dados.descricao} (${dados.quantidade}). Veja em Cortes.`, true);
    await carregarConferencia(); // atualiza a coluna Cortado
  } catch (erro) {
    mostrarMensagem(mensagemCorte, `✗ ${erro.message}`, false);
  } finally {
    janelaCorte.close();
    itemCortando = null;
  }
}

// Enter no campo (ou o leitor do coletor) envia o formulário
formBipar.addEventListener('submit', enviarBipagem);

// Botões do Finalizar e do Imprimir
botaoFinalizar.addEventListener('click', () => janelaFinalizar.showModal());
cancelarFinalizar.addEventListener('click', () => janelaFinalizar.close());
confirmarFinalizar.addEventListener('click', finalizar);
botaoImprimir.addEventListener('click', () => window.print());

// ⭐ Clique em qualquer botão "Cortar" da tabela (delegação de evento)
corpoResultado.addEventListener('click', (evento) => {
  const botao = evento.target.closest('.botao-cortar');
  if (!botao) return; // clicou em outro lugar da tabela
  abrirJanelaCorte(Number(botao.dataset.codprod));
});

// ⭐ Janela do corte
formCorte.addEventListener('submit', enviarCorte);
cancelarCorte.addEventListener('click', () => janelaCorte.close());

// Sem número no endereço? Volta para a lista de cargas.
if (!numeroCarga) {
  window.location.href = 'cargas.html';
} else {
  tituloCarga.textContent = `Carga ${numeroCarga}`;
  carregarConferencia();
}