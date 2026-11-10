// Busca as cargas na API e mostra no console (primeiro teste)

async function carregarCargas() {
    const resposta = await fetch ('/cargas')
    const dados = await resposta.json();
    console.log(dados);
}
carregarCargas();

