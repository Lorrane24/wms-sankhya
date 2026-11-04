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