// Carrega transações salvas no localStorage
let transacoes = JSON.parse(localStorage.getItem('dindin_transacoes')) || [];

function salvar() {
  localStorage.setItem('dindin_transacoes', JSON.stringify(transacoes));
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function atualizarCards() {
  const entradas = transacoes
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, t) => acc + t.valor, 0);

  const saidas = transacoes
    .filter(t => t.tipo === 'saida')
    .reduce((acc, t) => acc + t.valor, 0);

  const livre = entradas - saidas;

  document.getElementById('total-entradas').textContent = formatarMoeda(entradas);
  document.getElementById('total-saidas').textContent = formatarMoeda(saidas);
  document.getElementById('total-livre').textContent = formatarMoeda(livre);
}

function renderizarLista() {
  const lista = document.getElementById('lista-transacoes');
  lista.innerHTML = '';

  if (transacoes.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhuma transação ainda. Adicione uma acima!</p>';
    return;
  }

  // Mais recentes primeiro
  [...transacoes].reverse().forEach((t, indexRevertido) => {
    const indexOriginal = transacoes.length - 1 - indexRevertido;
    const item = document.createElement('li');
    item.className = `transacao-item ${t.tipo}`;
    item.innerHTML = `
      <div class="transacao-info">
        <span class="transacao-desc">${t.descricao}</span>
        <span class="transacao-cat">${t.categoria}</span>
      </div>
      <span class="transacao-valor">
        ${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}
      </span>
      <button class="btn-remover" onclick="remover(${indexOriginal})" title="Remover">✕</button>
    `;
    lista.appendChild(item);
  });
}

function remover(index) {
  transacoes.splice(index, 1);
  salvar();
  atualizarCards();
  renderizarLista();
}

document.getElementById('form-transacao').addEventListener('submit', function (e) {
  e.preventDefault();

  const descricao = document.getElementById('descricao').value.trim();
  const valor = parseFloat(document.getElementById('valor').value);
  const categoria = document.getElementById('categoria').value;
  const tipo = document.querySelector('input[name="tipo"]:checked').value;

  if (!descricao || isNaN(valor) || valor <= 0) return;

  transacoes.push({ descricao, valor, categoria, tipo });
  salvar();
  atualizarCards();
  renderizarLista();

  this.reset();
  document.querySelector('input[name="tipo"][value="entrada"]').checked = true;
});

// Cotação do dólar via AwesomeAPI (gratuita, sem chave)
async function buscarDolar() {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await res.json();
    const cotacao = parseFloat(data.USDBRL.bid).toFixed(2);
    document.getElementById('dolar-valor').textContent = `💵 USD: R$ ${cotacao}`;
  } catch {
    document.getElementById('dolar-valor').textContent = '💵 USD: indisponível';
  }
}

// Inicializa
buscarDolar();
atualizarCards();
renderizarLista();
