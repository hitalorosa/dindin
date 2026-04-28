// gastosFixos já declarado globalmente em app.js
function salvarFixos() {
  localStorage.setItem('dindin_fixos', JSON.stringify(gastosFixos));
}

// ── RESUMO ────────────────────────────────────────────
function atualizarResumo() {
  const totalFixo  = gastosFixos.reduce((a, g) => a + g.valor, 0);
  const totalPago  = gastosFixos.filter(g => g.pago).reduce((a, g) => a + g.valor, 0);
  const totalAberto = totalFixo - totalPago;
  const qtdPago    = gastosFixos.filter(g => g.pago).length;
  const qtdTotal   = gastosFixos.length;

  document.getElementById('total-fixo').textContent   = formatarMoeda(totalFixo);
  document.getElementById('total-pago').textContent   = formatarMoeda(totalPago);
  document.getElementById('total-aberto').textContent = formatarMoeda(totalAberto);
  document.getElementById('progresso-label').textContent = `${qtdPago} de ${qtdTotal} pagos`;

  const pct = qtdTotal > 0 ? (qtdPago / qtdTotal) * 100 : 0;
  const fill = document.getElementById('progresso-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct === 100 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#a78bfa';
}

// ── LISTA ─────────────────────────────────────────────
function renderizarFixos() {
  const lista = document.getElementById('lista-fixos');
  lista.innerHTML = '';

  if (gastosFixos.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhum gasto fixo cadastrado ainda.</p>';
    atualizarResumo();
    return;
  }

  // Pendentes primeiro, depois pagos
  const ordenados = [
    ...gastosFixos.filter(g => !g.pago),
    ...gastosFixos.filter(g => g.pago),
  ];

  ordenados.forEach(gasto => {
    const idxReal = gastosFixos.findIndex(g => g.id === gasto.id);
    const li = document.createElement('li');
    li.className = `fixo-item ${gasto.pago ? 'pago' : ''}`;
    li.innerHTML = `
      <button class="btn-check ${gasto.pago ? 'checked' : ''}" onclick="togglePago(${idxReal})" title="${gasto.pago ? 'Marcar como não pago' : 'Marcar como pago'}">
        ${gasto.pago ? '✅' : '⬜'}
      </button>
      <div class="fixo-info">
        <span class="fixo-nome">${gasto.icone || '📌'} ${gasto.nome}</span>
        <span class="fixo-cat">${gasto.categoria}</span>
      </div>
      <span class="fixo-valor">${formatarMoeda(gasto.valor)}</span>
      <button class="btn-remover" onclick="removerFixo(${idxReal})" title="Remover">✕</button>
    `;
    lista.appendChild(li);
  });

  atualizarResumo();
}

// ── AÇÕES ─────────────────────────────────────────────
function togglePago(idx) {
  gastosFixos[idx].pago = !gastosFixos[idx].pago;
  salvarFixos();
  renderizarFixos();
}

function removerFixo(idx) {
  const nome = gastosFixos[idx].nome;
  if (!confirm(`Remover "${nome}" dos gastos fixos?`)) return;
  gastosFixos.splice(idx, 1);
  salvarFixos();
  renderizarFixos();
}

// Reinicia todos para não pago (virada de mês)
document.getElementById('btn-reset-mes').addEventListener('click', () => {
  if (gastosFixos.length === 0) return;
  if (!confirm('Reiniciar o mês? Todas as contas voltarão para "não pago".')) return;
  gastosFixos.forEach(g => g.pago = false);
  salvarFixos();
  renderizarFixos();
});

// ── FORMULÁRIO ────────────────────────────────────────
document.getElementById('form-fixo').addEventListener('submit', function (e) {
  e.preventDefault();
  const nome      = document.getElementById('nome-fixo').value.trim();
  const valor     = parseFloat(document.getElementById('valor-fixo').value);
  const icone     = document.getElementById('icone-fixo').value.trim();
  const categoria = document.getElementById('categoria-fixo').value;

  if (!nome || isNaN(valor) || valor <= 0) return;

  gastosFixos.push({
    id: Date.now(),
    nome,
    valor,
    icone: icone || '📌',
    categoria,
    pago: false,
  });

  salvarFixos();
  renderizarFixos();
  this.reset();
});

// ── INIT ──────────────────────────────────────────────
renderizarFixos();
