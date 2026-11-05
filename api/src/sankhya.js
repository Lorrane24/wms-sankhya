// Tudo que conversa com a API do Sankhya fica neste arquivo.

const URL_SANKHYA = 'https://api.sankhya.com.br';

// Faz login no Sankhya e devolve a resposta dele
export async function fazerLogin() {
  const resposta = await fetch(`${URL_SANKHYA}/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Token': process.env.SANKHYA_X_TOKEN,
    },
    body: new URLSearchParams({
      client_id: process.env.SANKHYA_CLIENT_ID,
      client_secret: process.env.SANKHYA_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(`Login no Sankhya falhou (${resposta.status}): ${JSON.stringify(dados)}`);
  }

  return dados;
}

// Token guardado na memória
let tokenGuardado = null;
let venceEm = 0;

export async function obterToken() {
  const agora = Date.now();

  if (tokenGuardado && agora < venceEm - 60_000) { // ✅ era 60_600
    return tokenGuardado;
  }

  const dados = await fazerLogin();
  tokenGuardado = dados.access_token; // ✅ era acess_token (faltava um "c")
  venceEm = agora + dados.expires_in * 1000;
  return tokenGuardado;
}

// Consulta SQL no banco de dados do Sankhya
const SERVICO_SQL = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json'; // ✅ tinha um espaço antes de .executeQuery

export async function consultarSql(sql) {
  const token = await obterToken();

  const resposta = await fetch(`${URL_SANKHYA}${SERVICO_SQL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: { sql }, // ✅ era requestBodt
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok || String(dados.status) !== '1') {
    throw new Error(`Consulta no Sankhya falhou: ${dados.statusMessage ?? JSON.stringify(dados)}`);
  }

  const colunas = dados.responseBody.fieldsMetadata.map((campo) => campo.name); // ✅ era ressponseBody e fieldsMetada

  return dados.responseBody.rows.map((linha) => {
    const objeto = {};
    colunas.forEach((coluna, posicao) => {
      objeto[coluna] = linha[posicao];
    });
    return objeto;
  });
}