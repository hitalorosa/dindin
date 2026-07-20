/* =========================================================
   Planejador — lógica principal
   Dados 100% locais (localStorage). Sem backend.
   ========================================================= */

'use strict';

const STORE_KEY = 'planejador_v1';
const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                  'julho','agosto','setembro','outubro','novembro','dezembro'];

/* ---------- Estado ---------- */
let db = null;          // banco de dados em memória
let ym = null;          // mês selecionado "YYYY-MM"
let editandoId = null;  // id do lançamento em edição (ou null = novo)
let tipoForm = 'entrada';

/* =========================================================
   Persistência
   ========================================================= */
function bancoVazio() {
  return { version: 1, config: { tema: 'auto' }, fixos: [], meses: {} };
}

function carregar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    db = raw ? JSON.parse(raw) : bancoVazio();
  } catch {
    db = bancoVazio();
  }
  if (!db.fixos) db.fixos = [];
  if (!db.meses) db.meses = {};
  if (!db.config) db.config = { tema: 'auto' };
}

function salvar() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

/* =========================================================
   Utilidades
   ========================================================= */
function novoId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function ymDeData(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ymAtualDoSistema() {
  return ymDeData(new Date());
}

function ymPartes(chave) {
  const [a, m] = chave.split('-').map(Number);
  return { ano: a, mes: m }; // mes 1-12
}

function rotuloMes(chave) {
  const { ano, mes } = ymPartes(chave);
  return `${MESES_PT[mes - 1]} ${ano}`;
}

function ymDeslocado(chave, delta) {
  let { ano, mes } = ymPartes(chave);
  mes += delta;
  while (mes > 12) { mes -= 12; ano++; }
  while (mes < 1)  { mes += 12; ano--; }
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* Aceita "1.234,56", "1234,56", "1234.56", "1234" -> número */
function parseValor(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  let s = String(str).trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');   // pt-BR
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');                       // 1.234.567
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

/* =========================================================
   Mês: garantir estrutura + materializar recorrentes
   ========================================================= */
function garantirMes(chave) {
  if (!db.meses[chave]) {
    db.meses[chave] = { lancamentos: [], removidos: [] };
  }
  if (!db.meses[chave].removidos) db.meses[chave].removidos = [];

  const mes = db.meses[chave];
  let mudou = false;

  // Materializa cada fixo ativo que ainda não existe (e não foi removido) neste mês
  db.fixos.forEach(fixo => {
    if (fixo.desde && chave < fixo.desde) return;         // antes de existir
    if (mes.removidos.includes(fixo.id)) return;          // removido só deste mês
    const jaTem = mes.lancamentos.some(l => l.fixoId === fixo.id);
    if (!jaTem) {
      mes.lancamentos.push({
        id: novoId(),
        fixoId: fixo.id,
        descricao: fixo.descricao,
        valor: fixo.valor,
        tipo: fixo.tipo,
        categoria: fixo.categoria || '',
        dia: fixo.dia || null,
        status: 'previsto'
      });
      mudou = true;
    }
  });

  if (mudou) salvar();
  return mes;
}

/* =========================================================
   Cálculos
   ========================================================= */
function calcular(chave) {
  const lancs = (db.meses[chave] && db.meses[chave].lancamentos) || [];
  let entrPrev = 0, saidPrev = 0, entrReal = 0, saidReal = 0;

  lancs.forEach(l => {
    if (l.tipo === 'entrada') {
      entrPrev += l.valor;
      if (l.status === 'ok') entrReal += l.valor;
    } else {
      saidPrev += l.valor;
      if (l.status === 'ok') saidReal += l.valor;
    }
  });

  return {
    entrPrev, saidPrev, entrReal, saidReal,
    saldoProjetado: entrPrev - saidPrev,
    saldoReal: entrReal - saidReal,
    aReceber: entrPrev - entrReal,
    aPagar: saidPrev - saidReal,
    totalPrev: entrPrev + saidPrev,
    totalReal: entrReal + saidReal
  };
}

/* =========================================================
   Render
   ========================================================= */
const $ = sel => document.querySelector(sel);

function render() {
  garantirMes(ym);
  $('#month-label').textContent = rotuloMes(ym);

  const c = calcular(ym);

  // Hero
  const heroVal = $('#saldo-projetado');
  heroVal.textContent = formatarMoeda(c.saldoProjetado);
  heroVal.classList.toggle('pos', c.saldoProjetado > 0);
  heroVal.classList.toggle('neg', c.saldoProjetado < 0);

  const sub = $('#saldo-sub');
  if (c.totalPrev === 0) {
    sub.textContent = 'Adicione suas entradas e saídas ✨';
  } else if (c.saldoProjetado >= 0) {
    sub.textContent = `Se tudo acontecer, sobram ${formatarMoeda(c.saldoProjetado)} no mês.`;
  } else {
    sub.textContent = `Atenção: previsão de faltar ${formatarMoeda(Math.abs(c.saldoProjetado))}.`;
  }

  $('#stat-receber').textContent = formatarMoeda(c.aReceber);
  $('#stat-pagar').textContent = formatarMoeda(c.aPagar);

  // Progresso (realizado)
  const pct = c.totalPrev > 0 ? Math.round((c.totalReal / c.totalPrev) * 100) : 0;
  $('#realizado-pct').textContent = pct + '%';
  $('#progress-fill').style.width = pct + '%';
  $('#realizado-foot').textContent =
    c.totalPrev === 0 ? 'Marque os itens conforme forem acontecendo.'
    : `Saldo já realizado: ${formatarMoeda(c.saldoReal)}`;

  // Totais dos grupos
  $('#total-entradas').textContent = formatarMoeda(c.entrPrev);
  $('#total-saidas').textContent = formatarMoeda(c.saidPrev);

  // Listas
  const lancs = db.meses[ym].lancamentos;
  renderLista('#list-entradas', lancs.filter(l => l.tipo === 'entrada'), 'Nenhuma entrada ainda. Toque em Adicionar 👇');
  renderLista('#list-saidas', lancs.filter(l => l.tipo === 'saida'), 'Nenhuma saída ainda. Toque em Adicionar 👇');
}

function ordenar(lancs) {
  return lancs.slice().sort((a, b) => {
    const da = a.dia || 99, dbb = b.dia || 99;
    if (da !== dbb) return da - dbb;
    return a.descricao.localeCompare(b.descricao);
  });
}

function renderLista(sel, lancs, vazioMsg) {
  const el = $(sel);
  el.innerHTML = '';
  if (lancs.length === 0) {
    el.innerHTML = `<div class="empty-state">${vazioMsg}</div>`;
    return;
  }
  ordenar(lancs).forEach(l => el.appendChild(criarItem(l)));
}

function criarItem(l) {
  const div = document.createElement('div');
  div.className = 'item' + (l.status === 'ok' ? ' done' : '');
  div.dataset.id = l.id;

  const cls = l.tipo === 'entrada' ? 'in' : 'out';
  const sinal = l.tipo === 'entrada' ? '+' : '−';
  const dia = l.dia
    ? `<div class="item-day"><span class="d-num">${l.dia}</span><span class="d-lbl">dia</span></div>`
    : `<div class="item-day empty"><span class="d-num">·</span></div>`;

  const meta = [];
  if (l.categoria) meta.push(`<span class="item-tag">${escapar(l.categoria)}</span>`);
  if (l.fixoId) meta.push(`<span class="item-recur">↻ mensal</span>`);
  const metaHtml = meta.length ? `<div class="item-meta">${meta.join('')}</div>` : '';

  div.innerHTML = `
    <div class="check" data-check></div>
    ${dia}
    <div class="item-main">
      <div class="item-desc">${escapar(l.descricao)}</div>
      ${metaHtml}
    </div>
    <div class="item-value ${cls}">${sinal} ${formatarMoeda(l.valor).replace('R$', '').trim()}</div>
  `;

  // Toque no check = marcar realizado; toque no resto = editar
  div.querySelector('[data-check]').addEventListener('click', e => {
    e.stopPropagation();
    toggleStatus(l.id);
  });
  div.addEventListener('click', () => abrirForm(l.id));

  return div;
}

function escapar(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* =========================================================
   Ações sobre lançamentos
   ========================================================= */
function acharLanc(id) {
  return db.meses[ym].lancamentos.find(l => l.id === id);
}

function toggleStatus(id) {
  const l = acharLanc(id);
  if (!l) return;
  l.status = l.status === 'ok' ? 'previsto' : 'ok';
  salvar();
  render();
}

function abrirForm(id) {
  editandoId = id || null;
  const l = id ? acharLanc(id) : null;

  $('#form-title').textContent = l ? 'Editar lançamento' : 'Novo lançamento';
  setTipo(l ? l.tipo : 'entrada');
  $('#f-descricao').value = l ? l.descricao : '';
  $('#f-valor').value = l ? formatarMoeda(l.valor).replace('R$', '').trim() : '';
  $('#f-dia').value = l && l.dia ? l.dia : '';
  $('#f-categoria').value = l ? (l.categoria || '') : '';

  const repRow = $('#repeat-row');
  if (l) {
    // Ao editar, não deixamos alternar recorrência aqui (evita confusão)
    repRow.style.display = 'none';
    $('#f-repetir').checked = !!l.fixoId;
  } else {
    repRow.style.display = 'flex';
    $('#f-repetir').checked = false;
  }

  $('#form-delete').hidden = !l;
  abrirOverlay('#overlay-form');
  setTimeout(() => $('#f-descricao').focus(), 250);
}

function salvarForm() {
  const descricao = $('#f-descricao').value.trim();
  const valor = parseValor($('#f-valor').value);
  const diaRaw = parseInt($('#f-dia').value, 10);
  const dia = (diaRaw >= 1 && diaRaw <= 31) ? diaRaw : null;
  const categoria = $('#f-categoria').value.trim();

  if (!descricao) { toast('Dá um nome pro lançamento 🙂'); $('#f-descricao').focus(); return; }
  if (valor <= 0) { toast('Qual o valor? 💸'); $('#f-valor').focus(); return; }

  if (editandoId) {
    const l = acharLanc(editandoId);
    if (l) {
      l.descricao = descricao; l.valor = valor; l.tipo = tipoForm;
      l.dia = dia; l.categoria = categoria;
      // Se está ligado a um fixo, mantém o vínculo mas atualiza o template também
      if (l.fixoId) {
        const fx = db.fixos.find(f => f.id === l.fixoId);
        if (fx) { fx.descricao = descricao; fx.valor = valor; fx.tipo = tipoForm; fx.dia = dia; fx.categoria = categoria; }
      }
    }
  } else {
    const repetir = $('#f-repetir').checked;
    let fixoId = null;
    if (repetir) {
      fixoId = novoId();
      db.fixos.push({ id: fixoId, descricao, valor, tipo: tipoForm, categoria, dia, desde: ym });
    }
    db.meses[ym].lancamentos.push({
      id: novoId(), fixoId, descricao, valor, tipo: tipoForm, categoria, dia, status: 'previsto'
    });
  }

  salvar();
  fecharOverlay('#overlay-form');
  render();
  toast(editandoId ? 'Atualizado ✅' : 'Adicionado ✅');
}

function excluirAtual() {
  const l = acharLanc(editandoId);
  if (!l) return;
  if (l.fixoId) {
    // item recorrente -> perguntar escopo
    fecharOverlay('#overlay-form');
    abrirOverlay('#overlay-recorrente');
  } else {
    db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(x => x.id !== l.id);
    salvar();
    fecharOverlay('#overlay-form');
    render();
    toast('Excluído 🗑️');
  }
}

function excluirRecorrente(escopo) {
  const l = acharLanc(editandoId);
  if (!l) { fecharOverlay('#overlay-recorrente'); return; }

  if (escopo === 'mes') {
    // remove só deste mês e impede materializar de novo
    db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(x => x.id !== l.id);
    if (l.fixoId && !db.meses[ym].removidos.includes(l.fixoId)) {
      db.meses[ym].removidos.push(l.fixoId);
    }
  } else if (escopo === 'todos') {
    // desativa o fixo e remove a instância atual (meses futuros não recriam)
    db.fixos = db.fixos.filter(f => f.id !== l.fixoId);
    db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(x => x.id !== l.id);
  }
  salvar();
  fecharOverlay('#overlay-recorrente');
  render();
  toast('Excluído 🗑️');
}

/* =========================================================
   Copiar itens do mês anterior
   ========================================================= */
function copiarMesAnterior() {
  const anterior = ymDeslocado(ym, -1);
  const src = db.meses[anterior];
  if (!src || src.lancamentos.length === 0) { toast('Mês anterior está vazio 🤷'); return; }

  const destino = db.meses[ym];
  let n = 0;
  src.lancamentos.forEach(l => {
    if (l.fixoId) return; // recorrentes já vêm sozinhos
    destino.lancamentos.push({
      id: novoId(), fixoId: null,
      descricao: l.descricao, valor: l.valor, tipo: l.tipo,
      categoria: l.categoria, dia: l.dia, status: 'previsto'
    });
    n++;
  });
  salvar();
  fecharOverlay('#overlay-menu');
  render();
  toast(n ? `${n} item(ns) copiado(s) 📋` : 'Nada novo pra copiar');
}

/* =========================================================
   Export / Import / Reset
   ========================================================= */
function exportar() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planejador-backup-${ymAtualDoSistema()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  fecharOverlay('#overlay-menu');
  toast('Backup baixado ⬇️');
}

function importar(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      if (!dados || typeof dados !== 'object' || !('meses' in dados)) throw new Error('formato');
      db = dados;
      if (!db.fixos) db.fixos = [];
      if (!db.meses) db.meses = {};
      if (!db.config) db.config = { tema: 'auto' };
      salvar();
      fecharOverlay('#overlay-menu');
      render();
      toast('Backup restaurado ✅');
    } catch {
      toast('Arquivo inválido 😕');
    }
  };
  reader.readAsText(file);
}

function resetar() {
  if (!confirm('Apagar TODOS os dados deste aparelho? Isso não dá pra desfazer.\n\nDica: exporte um backup antes.')) return;
  db = bancoVazio();
  salvar();
  fecharOverlay('#overlay-menu');
  render();
  toast('Tudo limpo 🧹');
}

/* =========================================================
   Tema
   ========================================================= */
function aplicarTema() {
  const t = db.config.tema;
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const escuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#btn-theme').textContent = escuro ? '☀️' : '🌙';
}

function alternarTema() {
  const ordem = { auto: 'light', light: 'dark', dark: 'auto' };
  db.config.tema = ordem[db.config.tema] || 'light';
  salvar();
  aplicarTema();
  toast('Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'escuro' }[db.config.tema]));
}

/* =========================================================
   Overlays / toast helpers
   ========================================================= */
function abrirOverlay(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
function fecharOverlay(sel) { $(sel).hidden = true; document.body.style.overflow = ''; }

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.hidden = true; }, 300);
  }, 2200);
}

function setTipo(tipo) {
  tipoForm = tipo;
  document.querySelectorAll('.type-opt').forEach(b => {
    b.classList.toggle('is-active', b.dataset.type === tipo);
  });
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventos() {
  $('#prev-month').addEventListener('click', () => { ym = ymDeslocado(ym, -1); render(); });
  $('#next-month').addEventListener('click', () => { ym = ymDeslocado(ym, +1); render(); });
  $('#month-label').addEventListener('click', () => { ym = ymAtualDoSistema(); render(); });
  $('#btn-hoje').addEventListener('click', () => { ym = ymAtualDoSistema(); render(); toast('Mês atual'); });
  $('#btn-theme').addEventListener('click', alternarTema);
  $('#btn-menu').addEventListener('click', () => abrirOverlay('#overlay-menu'));

  $('#fab-add').addEventListener('click', () => abrirForm(null));

  // Form
  document.querySelectorAll('.type-opt').forEach(b =>
    b.addEventListener('click', () => setTipo(b.dataset.type)));
  $('#form-save').addEventListener('click', salvarForm);
  $('#form-cancel').addEventListener('click', () => fecharOverlay('#overlay-form'));
  $('#form-delete').addEventListener('click', excluirAtual);
  $('#f-valor').addEventListener('keydown', e => { if (e.key === 'Enter') salvarForm(); });
  $('#f-descricao').addEventListener('keydown', e => { if (e.key === 'Enter') $('#f-valor').focus(); });

  // Recorrente
  $('#rec-mes').addEventListener('click', () => excluirRecorrente('mes'));
  $('#rec-todos').addEventListener('click', () => excluirRecorrente('todos'));
  $('#rec-cancel').addEventListener('click', () => fecharOverlay('#overlay-recorrente'));

  // Menu
  $('#menu-export').addEventListener('click', exportar);
  $('#menu-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', e => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; });
  $('#menu-duplicar').addEventListener('click', copiarMesAnterior);
  $('#menu-reset').addEventListener('click', resetar);
  $('#menu-close').addEventListener('click', () => fecharOverlay('#overlay-menu'));

  // Fechar overlay tocando no fundo
  document.querySelectorAll('.overlay').forEach(ov =>
    ov.addEventListener('click', e => { if (e.target === ov) fecharOverlay('#' + ov.id); }));

  // Esc fecha
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.overlay:not([hidden])').forEach(ov => fecharOverlay('#' + ov.id));
  });
}

/* =========================================================
   Boot
   ========================================================= */
function init() {
  carregar();
  aplicarTema();
  ym = ymAtualDoSistema();
  ligarEventos();
  render();

  // Service worker (PWA) — só quando servido via http(s)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
