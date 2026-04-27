const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let parcelasSelecionadas = 1;
let faturaVizMes = new Date().getMonth();
let faturaVizAno = new Date().getFullYear();

// ── PAINEL PRINCIPAL ─────────────────────────────────
function comprasDaFatura(mes, ano) {
  return cartaoConfig.compras.filter(c => {
    const dataCompra = new Date(c.data + 'T12:00:00');
    const mesCom = dataCompra.getMonth();
    const anoCom = dataCompra.getFullYear();

    // Calcula quantas faturas já passaram desde a compra
    const diffMeses = (ano - anoCom) * 12 + (mes - mesCom);
    return diffMeses >= 0 && diffMeses < c.parcelas;
  }).map(c => {
    const dataCompra = new Date(c.data + 'T12:00:00');
    const mesCom = dataCompra.getMonth();
    const anoCom = dataCompra.getFullYear();
    const diffMeses = (ano - anoCom) * 12 + (mes - mesCom);
    return {
      ...c,
      parcelaExibida: diffMeses + 1,
      valorParcela: c.valor / c.parcelas
    };
  });
}

function totalFaturaAtual() {
  const hoje = new Date();
  return comprasDaFatura(hoje.getMonth(), hoje.getFullYear())
    .reduce((a, c) => a + c.valorParcela, 0);
}

function atualizarPainel() {
  const limite     = cartaoConfig.limite;
  const usado      = totalFaturaAtual();
  const disponivel = Math.max(limite - usado, 0);
  const pct        = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;

  document.getElementById('cartao-limite-display').textContent    = formatarMoeda(limite);
  document.getElementById('cartao-fatura-display').textContent    = formatarMoeda(usado);
  document.getElementById('cartao-disponivel-display').textContent = formatarMoeda(disponivel);
  document.getElementById('cartao-pct-label').textContent         = `${pct.toFixed(0)}% utilizado`;

  const fill = document.getElementById('cartao-barra-fill');
  fill.style.width = pct + '%';
  fill.style.background =
    pct < 50 ? 'linear-gradient(90deg,#10b981,#34d399)' :
    pct < 80 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' :
               'linear-gradient(90deg,#ef4444,#f87171)';

  if (cartaoConfig.limite > 0) {
    document.getElementById('limite-atual-label').textContent =
      `Atual: ${formatarMoeda(cartaoConfig.limite)}`;
  }
}

// ── FATURA MENSAL ────────────────────────────────────
function renderizarFatura() {
  const lista    = document.getElementById('lista-fatura');
  const compras  = comprasDaFatura(faturaVizMes, faturaVizAno);
  const total    = compras.reduce((a, c) => a + c.valorParcela, 0);

  document.getElementById('fatura-mes-label').textContent =
    `${MESES[faturaVizMes].slice(0,3)} ${faturaVizAno}`;
  document.getElementById('fatura-total-label').textContent =
    compras.length > 0 ? `Total: ${formatarMoeda(total)}` : '';

  lista.innerHTML = '';

  if (compras.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhuma compra nesta fatura.</p>';
    return;
  }

  compras.forEach(c => {
    const idxOriginal = cartaoConfig.compras.findIndex(x => x.id === c.id);
    const li = document.createElement('li');
    li.className = 'fatura-item';

    const ehParcelado = c.parcelas > 1;
    const badgeParcela = ehParcelado
      ? `<span class="badge-parcela">${c.parcelaExibida}/${c.parcelas}</span>`
      : `<span class="badge-parcela avista">à vista</span>`;

    li.innerHTML = `
      <div class="fatura-info">
        <div class="fatura-nome-row">
          <span class="fatura-nome">${c.nome}</span>
          ${badgeParcela}
        </div>
        <span class="fatura-data">${formatarDataCompleta(c.data + 'T12:00:00')}</span>
      </div>
      <div class="fatura-valores">
        <span class="fatura-parcela-valor">${formatarMoeda(c.valorParcela)}</span>
        ${ehParcelado ? `<span class="fatura-total-item">de ${formatarMoeda(c.valor)}</span>` : ''}
      </div>
      <button class="btn-remover" onclick="removerCompra(${idxOriginal})" title="Remover compra">✕</button>
    `;
    lista.appendChild(li);
  });
}

function removerCompra(idx) {
  const nome = cartaoConfig.compras[idx].nome;
  if (!confirm(`Remover "${nome}" do cartão?\nIsso remove todas as parcelas.`)) return;
  cartaoConfig.compras.splice(idx, 1);
  salvarCartao();
  atualizarPainel();
  renderizarFatura();
}

// ── PARCELAS SELECTOR ────────────────────────────────
document.querySelectorAll('.parcela-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.parcela-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    parcelasSelecionadas = parseInt(this.dataset.p);
    atualizarPreview();
  });
});

function atualizarPreview() {
  const valor = parseFloat(document.getElementById('compra-valor').value);
  const prev  = document.getElementById('compra-preview');
  const texto = document.getElementById('preview-texto');

  if (!isNaN(valor) && valor > 0) {
    const por = valor / parcelasSelecionadas;
    texto.textContent = parcelasSelecionadas === 1
      ? `Pagamento à vista: ${formatarMoeda(valor)}`
      : `${parcelasSelecionadas}x de ${formatarMoeda(por)} = ${formatarMoeda(valor)}`;
    prev.style.display = 'block';
  } else {
    prev.style.display = 'none';
  }
}

document.getElementById('compra-valor').addEventListener('input', atualizarPreview);

// Define data de hoje como padrão
document.getElementById('compra-data').value = new Date().toISOString().split('T')[0];

// ── FORMULÁRIO ───────────────────────────────────────
document.getElementById('form-compra').addEventListener('submit', function (e) {
  e.preventDefault();
  const nome    = document.getElementById('compra-nome').value.trim();
  const valor   = parseFloat(document.getElementById('compra-valor').value);
  const data    = document.getElementById('compra-data').value;

  if (!nome || isNaN(valor) || valor <= 0 || !data) return;

  cartaoConfig.compras.push({
    id: Date.now(),
    nome,
    valor,
    data,
    parcelas: parcelasSelecionadas
  });

  salvarCartao();
  atualizarPainel();
  renderizarFatura();
  this.reset();
  document.getElementById('compra-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('compra-preview').style.display = 'none';
  document.querySelectorAll('.parcela-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.parcela-btn[data-p="1"]').classList.add('active');
  parcelasSelecionadas = 1;
});

// ── LIMITE ───────────────────────────────────────────
document.getElementById('btn-salvar-limite-cartao').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('input-limite-cartao').value);
  if (isNaN(val) || val <= 0) { alert('Informe um limite válido.'); return; }
  cartaoConfig.limite = val;
  salvarCartao();
  document.getElementById('input-limite-cartao').value = '';
  atualizarPainel();
});

// ── NAVEGAÇÃO DA FATURA ──────────────────────────────
document.getElementById('fatura-prev').addEventListener('click', () => {
  if (faturaVizMes === 0) { faturaVizMes = 11; faturaVizAno--; }
  else faturaVizMes--;
  renderizarFatura();
});

document.getElementById('fatura-next').addEventListener('click', () => {
  if (faturaVizMes === 11) { faturaVizMes = 0; faturaVizAno++; }
  else faturaVizMes++;
  renderizarFatura();
});

// ── INIT ─────────────────────────────────────────────
atualizarPainel();
renderizarFatura();
