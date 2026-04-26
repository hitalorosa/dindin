// ============================================================
// DADOS (localStorage)
// ============================================================
let transacoes = JSON.parse(localStorage.getItem('dindin_transacoes')) || [];
let carteiras  = JSON.parse(localStorage.getItem('dindin_carteiras'))  || [];
let limiteGastos = parseFloat(localStorage.getItem('dindin_limite')) || 0;

function salvarTransacoes() { localStorage.setItem('dindin_transacoes', JSON.stringify(transacoes)); }
function salvarCarteiras()  { localStorage.setItem('dindin_carteiras',  JSON.stringify(carteiras));  }
function salvarLimite(v)    { localStorage.setItem('dindin_limite', v); }

// ============================================================
// UTILITÁRIOS
// ============================================================
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularTotais() {
  const entradas = transacoes
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, t) => acc + t.valor, 0);

  const saidas = transacoes
    .filter(t => t.tipo === 'saida')
    .reduce((acc, t) => acc + t.valor, 0);

  return { entradas, saidas, livre: entradas - saidas };
}

function totalInvestido() {
  return carteiras.reduce((acc, c) => acc + c.saldo, 0);
}

// ============================================================
// RENDER: CARDS PRINCIPAIS
// ============================================================
function atualizarCards() {
  const { entradas, saidas, livre } = calcularTotais();
  document.getElementById('total-entradas').textContent = formatarMoeda(entradas);
  document.getElementById('total-saidas').textContent   = formatarMoeda(saidas);
  document.getElementById('total-livre').textContent    = formatarMoeda(livre);
  atualizarTermometro(saidas, livre);
  atualizarPotencial(livre);
}

// ============================================================
// RENDER: TERMÔMETRO DE GASTOS
// ============================================================
function atualizarTermometro(saidas, livre) {
  const fill  = document.getElementById('termometro-fill');
  const info  = document.getElementById('termometro-info');
  const label = document.getElementById('limite-restante-label');

  if (limiteGastos <= 0) {
    fill.style.width = '0%';
    info.textContent = 'Configure seu limite de gastos abaixo.';
    label.textContent = '—';
    return;
  }

  const pct = Math.min((saidas / limiteGastos) * 100, 100);
  const restante = limiteGastos - saidas;

  fill.style.width = pct + '%';
  fill.dataset.pct = pct;

  label.textContent = restante >= 0
    ? `${formatarMoeda(restante)} restantes`
    : `${formatarMoeda(Math.abs(restante))} acima do limite`;

  if (pct < 60)       info.textContent = '✅ Você está dentro do orçamento. Bom controle!';
  else if (pct < 85)  info.textContent = '⚠️ Atenção: você já usou mais de 60% do limite.';
  else                info.textContent = '🚨 Limite quase esgotado! Segura os gastos.';
}

// ============================================================
// RENDER: POTENCIAL DE INVESTIMENTO
// ============================================================
function atualizarPotencial(livre) {
  const base = livre > 0 ? livre : 0;
  document.getElementById('pot-10').textContent = formatarMoeda(base * 0.10);
  document.getElementById('pot-20').textContent = formatarMoeda(base * 0.20);
  document.getElementById('pot-30').textContent = formatarMoeda(base * 0.30);
}

// ============================================================
// RENDER: LISTA DE TRANSAÇÕES
// ============================================================
function renderizarLista() {
  const lista = document.getElementById('lista-transacoes');
  lista.innerHTML = '';

  if (transacoes.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhuma transação ainda. Adicione uma acima!</p>';
    return;
  }

  [...transacoes].reverse().forEach((t, idxInvertido) => {
    const idx = transacoes.length - 1 - idxInvertido;
    const li = document.createElement('li');
    li.className = `transacao-item ${t.tipo}`;
    li.innerHTML = `
      <div class="transacao-info">
        <span class="transacao-desc">${t.descricao}</span>
        <span class="transacao-cat">${t.categoria}</span>
      </div>
      <span class="transacao-valor">
        ${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}
      </span>
      <button class="btn-remover" onclick="removerTransacao(${idx})" title="Remover">✕</button>
    `;
    lista.appendChild(li);
  });
}

function removerTransacao(index) {
  transacoes.splice(index, 1);
  salvarTransacoes();
  atualizarCards();
  renderizarLista();
}

// ============================================================
// RENDER: CARTEIRAS DE INVESTIMENTO
// ============================================================
function renderizarCarteiras() {
  const container = document.getElementById('lista-carteiras');
  container.innerHTML = '';

  document.getElementById('total-investido').textContent = formatarMoeda(totalInvestido());

  if (carteiras.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma carteira criada. Crie uma acima!</p>';
    return;
  }

  carteiras.forEach((carteira, idx) => {
    const div = document.createElement('div');
    div.className = 'carteira-card';
    div.innerHTML = `
      <div class="carteira-header">
        <span class="carteira-nome">${carteira.icone || '📁'} ${carteira.nome}</span>
        <button class="btn-remover" onclick="removerCarteira(${idx})" title="Excluir carteira">✕</button>
      </div>
      <h3 class="carteira-saldo">${formatarMoeda(carteira.saldo)}</h3>
      <div class="carteira-acoes">
        <input type="number" class="input-movimentacao" id="mov-${idx}"
               placeholder="Valor" step="0.01" min="0" />
        <button class="btn-depositar" onclick="moverCarteira(${idx}, 'depositar')">+ Depositar</button>
        <button class="btn-retirar"   onclick="moverCarteira(${idx}, 'retirar')">- Retirar</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function removerCarteira(index) {
  if (!confirm(`Excluir a carteira "${carteiras[index].nome}"?`)) return;
  carteiras.splice(index, 1);
  salvarCarteiras();
  renderizarCarteiras();
}

function moverCarteira(index, acao) {
  const input = document.getElementById(`mov-${index}`);
  const valor = parseFloat(input.value);

  if (isNaN(valor) || valor <= 0) {
    alert('Informe um valor válido.');
    return;
  }

  if (acao === 'depositar') {
    carteiras[index].saldo += valor;
  } else {
    if (valor > carteiras[index].saldo) {
      alert('Saldo insuficiente nesta carteira.');
      return;
    }
    carteiras[index].saldo -= valor;
  }

  input.value = '';
  salvarCarteiras();
  renderizarCarteiras();
}

// ============================================================
// EVENTOS
// ============================================================

// Adicionar transação
document.getElementById('form-transacao').addEventListener('submit', function (e) {
  e.preventDefault();
  const descricao = document.getElementById('descricao').value.trim();
  const valor     = parseFloat(document.getElementById('valor').value);
  const categoria = document.getElementById('categoria').value;
  const tipo      = document.querySelector('input[name="tipo"]:checked').value;

  if (!descricao || isNaN(valor) || valor <= 0) return;

  transacoes.push({ descricao, valor, categoria, tipo });
  salvarTransacoes();
  atualizarCards();
  renderizarLista();
  this.reset();
  document.querySelector('input[name="tipo"][value="entrada"]').checked = true;
});

// Criar carteira
document.getElementById('form-carteira').addEventListener('submit', function (e) {
  e.preventDefault();
  const nome   = document.getElementById('nome-carteira').value.trim();
  const icone  = document.getElementById('icone-carteira').value.trim();

  if (!nome) return;

  carteiras.push({ nome, icone: icone || '📁', saldo: 0 });
  salvarCarteiras();
  renderizarCarteiras();
  this.reset();
});

// Salvar limite de gastos
document.getElementById('btn-salvar-limite').addEventListener('click', function () {
  const val = parseFloat(document.getElementById('input-limite').value);
  if (isNaN(val) || val <= 0) { alert('Informe um limite válido.'); return; }
  limiteGastos = val;
  salvarLimite(val);
  document.getElementById('input-limite').value = '';
  const { saidas, livre } = calcularTotais();
  atualizarTermometro(saidas, livre);
});

// Navegação entre abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
  });
});

// ============================================================
// COTAÇÃO DO DÓLAR (AwesomeAPI)
// ============================================================
async function buscarDolar() {
  try {
    const res  = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await res.json();
    const cotacao = parseFloat(data.USDBRL.bid).toFixed(2);
    document.getElementById('dolar-valor').textContent = `💵 USD R$ ${cotacao}`;
  } catch {
    document.getElementById('dolar-valor').textContent = '💵 USD indisponível';
  }
}

// Preenche o campo de limite salvo anteriormente
if (limiteGastos > 0) {
  document.getElementById('input-limite').placeholder = `Limite atual: ${formatarMoeda(limiteGastos)}`;
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
buscarDolar();
atualizarCards();
renderizarLista();
renderizarCarteiras();
