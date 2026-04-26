// Dados compartilhados via localStorage
let transacoes  = JSON.parse(localStorage.getItem('dindin_transacoes')) || [];
let carteiras   = JSON.parse(localStorage.getItem('dindin_carteiras'))  || [];
let limiteGastos = parseFloat(localStorage.getItem('dindin_limite'))    || 0;

function salvarTransacoes() { localStorage.setItem('dindin_transacoes', JSON.stringify(transacoes)); }
function salvarCarteiras()  { localStorage.setItem('dindin_carteiras',  JSON.stringify(carteiras));  }
function salvarLimite(v)    { localStorage.setItem('dindin_limite', String(v)); }

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calcularTotais() {
  const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
  const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
  return { entradas, saidas, livre: entradas - saidas };
}

function totalInvestido() {
  return carteiras.reduce((a, c) => a + c.saldo, 0);
}

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

buscarDolar();
