let filtroData = null; // 'YYYY-MM-DD' ou null para mostrar tudo

// ── CALENDÁRIO ───────────────────────────────────────
let calMes = new Date().getMonth();
let calAno = new Date().getFullYear();

function diasComTransacao() {
  const dias = new Set();
  transacoes.forEach(t => {
    if (t.data) dias.add(t.data.split('T')[0]);
  });
  return dias;
}

function renderizarCalendario() {
  const container = document.getElementById('calendario');
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const primeiroDia   = new Date(calAno, calMes, 1).getDay();
  const diasNoMes     = new Date(calAno, calMes + 1, 0).getDate();
  const diasMarcados  = diasComTransacao();
  const hoje          = new Date();
  const hojeStr       = hojeISO();

  let html = `
    <div class="cal-header">
      <button class="cal-nav" id="cal-prev">‹</button>
      <span class="cal-titulo">${meses[calMes]} ${calAno}</span>
      <button class="cal-nav" id="cal-next">›</button>
    </div>
    <div class="cal-grid">
      <span class="cal-dow">D</span><span class="cal-dow">S</span>
      <span class="cal-dow">T</span><span class="cal-dow">Q</span>
      <span class="cal-dow">Q</span><span class="cal-dow">S</span>
      <span class="cal-dow">S</span>
  `;

  for (let i = 0; i < primeiroDia; i++) html += '<span></span>';

  for (let d = 1; d <= diasNoMes; d++) {
    const dataStr  = `${calAno}-${String(calMes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const temGasto = diasMarcados.has(dataStr);
    const ehHoje   = dataStr === hojeStr;
    const ativo    = filtroData === dataStr;

    html += `<span
      class="cal-dia ${temGasto ? 'tem-gasto' : ''} ${ehHoje ? 'hoje' : ''} ${ativo ? 'ativo' : ''}"
      onclick="filtrarPorData('${dataStr}')"
    >${d}${temGasto ? '<i></i>' : ''}</span>`;
  }

  html += '</div>';

  if (filtroData) {
    html += `<button class="cal-limpar" onclick="filtrarPorData(null)">✕ Limpar filtro</button>`;
  }

  container.innerHTML = html;

  document.getElementById('cal-prev').addEventListener('click', () => {
    if (calMes === 0) { calMes = 11; calAno--; } else calMes--;
    renderizarCalendario();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    if (calMes === 11) { calMes = 0; calAno++; } else calMes++;
    renderizarCalendario();
  });
}

function filtrarPorData(data) {
  filtroData = data;
  renderizarCalendario();
  renderizarLista();
}

// ── LISTA DE TRANSAÇÕES ──────────────────────────────
function renderizarLista() {
  const lista = document.getElementById('lista-transacoes');
  const titulo = document.getElementById('lista-titulo');
  lista.innerHTML = '';

  let itens = [...transacoes];

  if (filtroData) {
    itens = itens.filter(t => t.data && t.data.startsWith(filtroData));
    if (titulo) titulo.textContent = `Transações — ${new Date(filtroData + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  } else {
    if (titulo) titulo.textContent = 'Todas as Transações';
  }

  if (itens.length === 0) {
    lista.innerHTML = filtroData
      ? '<p class="vazio">Nenhuma transação neste dia.</p>'
      : '<p class="vazio">Nenhuma transação ainda. Adicione uma acima!</p>';
    return;
  }

  // Mais recentes primeiro
  [...itens].reverse().forEach((t) => {
    const idxReal = transacoes.indexOf(t);
    const li = document.createElement('li');
    li.className = `transacao-item ${t.tipo}`;
    li.innerHTML = `
      <div class="transacao-info">
        <span class="transacao-desc">${t.descricao}</span>
        <span class="transacao-cat">${t.categoria}${t.data ? ' · ' + formatarData(t.data) : ''}</span>
      </div>
      <span class="transacao-valor">
        ${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}
      </span>
      <button class="btn-remover" onclick="remover(${idxReal})">✕</button>
    `;
    lista.appendChild(li);
  });
}

function remover(idx) {
  transacoes.splice(idx, 1);
  salvarTransacoes();
  renderizarCalendario();
  renderizarLista();
}

// ── FORMULÁRIO ───────────────────────────────────────
document.getElementById('form-transacao').addEventListener('submit', function (e) {
  e.preventDefault();
  const descricao = document.getElementById('descricao').value.trim();
  const valor     = parseFloat(document.getElementById('valor').value);
  const categoria = document.getElementById('categoria').value;
  const tipo      = document.querySelector('input[name="tipo"]:checked').value;

  if (!descricao || isNaN(valor) || valor <= 0) return;

  transacoes.push({
    descricao,
    valor,
    categoria,
    tipo,
    data: new Date().toISOString()   // ← salva a data/hora exata
  });

  salvarTransacoes();
  renderizarCalendario();
  renderizarLista();
  this.reset();
  document.querySelector('input[name="tipo"][value="entrada"]').checked = true;
});

// ── INIT ─────────────────────────────────────────────
renderizarCalendario();
renderizarLista();
