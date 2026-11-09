// Tudo que conversa com a API do Sankhya fica neste arquivo.

const URL_SANKHYA = 'https://api.sankhya.com.br';

// Qual base usar: TESTE ou PRODUCAO (vem do .env).
// Se estiver vazio ou escrito errado, usa TESTE, que é o mais seguro.
export const BASE = process.env.SANKHYA_BASE === 'PRODUCAO' ? 'PRODUCAO' : 'TESTE';

// O começo do nome das variáveis no .env, conforme a base
const PREFIXO = BASE === 'PRODUCAO' ? 'SANKHYA_PROD_' : 'SANKHYA_TESTE_';

// As credenciais da base escolhida
const credenciais = {
  clientId: process.env[PREFIXO + 'CLIENT_ID'],
  clientSecret: process.env[PREFIXO + 'CLIENT_SECRET'],
  xToken: process.env[PREFIXO + 'X_TOKEN'],
};

console.log(`Sankhya: usando a base ${BASE}`);

// Faz login no Sankhya e devolve a resposta dele
export async function fazerLogin() {
  // Avisa com clareza se faltar alguma credencial no .env
  if (!credenciais.clientId || !credenciais.clientSecret || !credenciais.xToken) {
    throw new Error(`Faltam credenciais da base ${BASE} no .env (variáveis que começam com ${PREFIXO})`);
  }

  const resposta = await fetch(`${URL_SANKHYA}/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Token': credenciais.xToken,
    },
    body: new URLSearchParams({
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(`Login no Sankhya (${BASE}) falhou (${resposta.status}): ${JSON.stringify(dados)}`);
  }

  return dados;
}

// Token guardado na memória
let tokenGuardado = null;
let venceEm = 0;

export async function obterToken() {
  const agora = Date.now();

  if (tokenGuardado && agora < venceEm - 60_000) {
    return tokenGuardado;
  }

  const dados = await fazerLogin();
  tokenGuardado = dados.access_token;
  venceEm = agora + dados.expires_in * 1000;
  return tokenGuardado;
}

// Consulta SQL no banco de dados do Sankhya
const SERVICO_SQL = '/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';

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
      requestBody: { sql },
    }),
  });

  const dados = await resposta.json();

  if (!resposta.ok || String(dados.status) !== '1') {
    throw new Error(`Consulta no Sankhya falhou: ${dados.statusMessage ?? JSON.stringify(dados)}`);
  }

  const colunas = dados.responseBody.fieldsMetadata.map((campo) => campo.name);

  return dados.responseBody.rows.map((linha) => {
    const objeto = {};
    colunas.forEach((coluna, posicao) => {
      objeto[coluna] = linha[posicao];
    });
    return objeto;
  });
}