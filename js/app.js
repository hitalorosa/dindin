// ── DADOS GLOBAIS ────────────────────────────────────
let transacoes   = JSON.parse(localStorage.getItem('dindin_transacoes')) || [];
let carteiras    = JSON.parse(localStorage.getItem('dindin_carteiras'))  || [];
let gastosFixos  = JSON.parse(localStorage.getItem('dindin_fixos'))      || [];
let limiteGastos = parseFloat(localStorage.getItem('dindin_limite'))     || 0;
let salarioConfig = JSON.parse(localStorage.getItem('dindin_salario'))   || {
  valor: 1150,
  dias: [5, 20],
  historico: []
};
let cartaoConfig = JSON.parse(localStorage.getItem('dindin_cartao')) || {
  limite: 0,
  compras: []
};

function salvarTransacoes()  { localStorage.setItem('dindin_transacoes', JSON.stringify(transacoes)); }
function salvarCarteiras()   { localStorage.setItem('dindin_carteiras',  JSON.stringify(carteiras));  }
function salvarLimite(v)     { localStorage.setItem('dindin_limite', String(v)); }
function salvarCartao()      { localStorage.setItem('dindin_cartao', JSON.stringify(cartaoConfig)); }
function salvarSalario()     { localStorage.setItem('dindin_salario', JSON.stringify(salarioConfig)); }

// ── UTILITÁRIOS ──────────────────────────────────────
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatarDataCompleta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function hojeISO() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function calcularTotais() {
  const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
  const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
  return { entradas, saidas, livre: entradas - saidas };
}

function totalInvestido() {
  return carteiras.reduce((a, c) => a + c.saldo, 0);
}

// ── COTAÇÃO DO DÓLAR ─────────────────────────────────
async function buscarDolar() {
  const el = document.getElementById('dolar-valor');
  if (!el) return;
  try {
    const res  = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await res.json();
    el.textContent = `💵 USD R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
  } catch {
    el.textContent = '💵 USD indisponível';
  }
}

// ── MODAL DE SALÁRIO ─────────────────────────────────
function criarModalSalario() {
  const modal = document.createElement('div');
  modal.id = 'modal-salario';
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <div class="modal-icone">💰</div>
        <h2 class="modal-titulo">Dia de salário!</h2>
        <p class="modal-texto">
          Seu salário de <strong>${formatarMoeda(salarioConfig.valor)}</strong> foi creditado hoje?
        </p>
        <div class="modal-botoes">
          <button class="modal-btn-sim" id="modal-sim">✅ Sim, recebi!</button>
          <button class="modal-btn-nao" id="modal-nao">Ainda não</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('modal-sim').addEventListener('click', () => {
    const hoje = hojeISO();
    transacoes.push({
      descricao: '💼 Salário',
      valor: salarioConfig.valor,
      categoria: 'Salário',
      tipo: 'entrada',
      data: new Date().toISOString(),
      fixo: true
    });
    salvarTransacoes();

    salarioConfig.historico.push({ data: hoje, valor: salarioConfig.valor });
    salvarSalario();

    localStorage.setItem('dindin_salario_visto', hoje);
    document.getElementById('modal-overlay').remove();

    // Atualiza cards se estiver na visão geral
    if (typeof atualizarCards === 'function') atualizarCards();
    if (typeof renderizarLista === 'function') renderizarLista();
  });

  document.getElementById('modal-nao').addEventListener('click', () => {
    localStorage.setItem('dindin_salario_visto', hojeISO());
    document.getElementById('modal-overlay').remove();
  });
}

function verificarSalario() {
  const hoje       = new Date();
  const dia        = hoje.getDate();
  const jaVisto    = localStorage.getItem('dindin_salario_visto');
  const hojeStr   = hojeISO();

  if (salarioConfig.dias.includes(dia) && jaVisto !== hojeStr) {
    setTimeout(criarModalSalario, 800);
  }
}

// ── INIT GLOBAL ──────────────────────────────────────
buscarDolar();
verificarSalario();
