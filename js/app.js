/* =========================================================
   Planejador v2 — núcleo
   ---------------------------------------------------------
   REGRA DURA: este arquivo é o ÚNICO que declara variáveis
   globais. Os outros .js contêm SOMENTE `function nome(){}`.
   (Redeclarar uma global com `let` em outro arquivo causa
    SyntaxError silencioso e quebra a página inteira.)
   ========================================================= */

'use strict';

/* ---------- Globais (declaradas SÓ aqui) ---------- */
var STORE_KEY = 'planejador_v1';
var MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho',
                'julho','agosto','setembro','outubro','novembro','dezembro'];
var VIEWS = ['mes', 'guardar', 'dividas', 'desejos'];

var db = null;              // banco em memória
var ym = null;              // mês selecionado 'YYYY-MM'
var view = 'mes';           // aba ativa
var modoHero = 'projetado'; // 'projetado' | 'livre'  (não persistido)

var editandoId = null;      // lançamento em edição
var tipoForm = 'entrada';
var carteiraEditandoId = null;
var moverCarteiraId = null;
var moverModo = 'guardar';
var dividaEditandoId = null;
var dividaAcaoId = null;
var desejoEditandoId = null;
var desejoVendoId = null;
var sugestaoLancId = null;
var extraAcelerar = 0;
var valorCallback = null;   // callback da folha genérica de valor
var toastTimer = null;

var $ = function (sel) { return document.querySelector(sel); };

/* =========================================================
   Persistência + migração
   ========================================================= */
function bancoVazio() {
  return {
    version: 2,
    config: {
      tema: 'auto',
      caixaHoje: 0,
      caixaHojeEm: null,
      usarGuardadoNaQuitacao: false,
      sugerirAoReceber: true,
      minimoEntradaSugestao: 100,
      buscarPreviaLinks: true
    },
    fixos: [],
    carteiras: [],
    desejos: [],
    meses: {}
  };
}

/* Puramente ADITIVO. Idempotente. Nunca apaga, nunca converte, nunca renomeia. */
function normalizar() {
  if (!db || typeof db !== 'object') db = bancoVazio();
  var vazio = bancoVazio();

  if (!db.config || typeof db.config !== 'object') db.config = {};
  Object.keys(vazio.config).forEach(function (k) {
    if (db.config[k] === undefined) db.config[k] = vazio.config[k];
  });

  if (!Array.isArray(db.fixos))     db.fixos = [];
  if (!Array.isArray(db.carteiras)) db.carteiras = [];
  if (!Array.isArray(db.desejos))   db.desejos = [];
  if (!db.meses || typeof db.meses !== 'object') db.meses = {};

  db.fixos.forEach(function (f) {
    if (f.parcelas === undefined)          f.parcelas = null;
    if (f.quitacaoInformada === undefined) f.quitacaoInformada = null;
  });

  db.carteiras.forEach(function (w) {
    if (typeof w.saldoInicial !== 'number') w.saldoInicial = 0;
    if (typeof w.pct !== 'number') w.pct = 0;
    if (w.arquivada === undefined) w.arquivada = false;
    if (!w.emoji) w.emoji = '🐷';
  });

  Object.keys(db.meses).forEach(function (k) {
    var m = db.meses[k];
    if (!m || typeof m !== 'object') { db.meses[k] = { lancamentos: [], removidos: [], separacoes: [], orcamentoSilenciado: false }; return; }
    if (!Array.isArray(m.lancamentos)) m.lancamentos = [];
    if (!Array.isArray(m.removidos))   m.removidos   = [];
    if (!Array.isArray(m.separacoes))  m.separacoes  = [];
    if (m.orcamentoSilenciado === undefined) m.orcamentoSilenciado = false;
    m.lancamentos.forEach(function (l) {
      if (l.origem === undefined) l.origem = null;
      // entradas já recebidas nascem orcado=true: o app não pergunta sobre o passado
      if (l.tipo === 'entrada' && l.orcado === undefined) l.orcado = (l.status === 'ok');
    });
  });
}

function migrar() {
  var versaoAntes = db && db.version;
  if (versaoAntes !== 2) {
    // Backup ANTES de tocar em qualquer coisa. Só grava uma vez.
    try {
      var chaveBk = STORE_KEY + '_backup_v' + (versaoAntes || 1);
      if (!localStorage.getItem(chaveBk)) localStorage.setItem(chaveBk, JSON.stringify(db));
    } catch (e) {}
  }
  normalizar();
  db.version = 2;
  salvar();
}

function carregar() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    db = raw ? JSON.parse(raw) : bancoVazio();
  } catch (e) {
    db = bancoVazio();
  }
  migrar();
}

function salvar() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    toast('⚠️ Não consegui salvar (memória cheia). Exporte um backup!');
    return false;
  }
}

/* =========================================================
   Utilidades
   ========================================================= */
function novoId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function ymDeData(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function ymAtualDoSistema() { return ymDeData(new Date()); }

function ymPartes(chave) {
  var p = chave.split('-').map(Number);
  return { ano: p[0], mes: p[1] };
}
function ymDeslocado(chave, delta) {
  var p = ymPartes(chave), ano = p.ano, mes = p.mes + delta;
  while (mes > 12) { mes -= 12; ano++; }
  while (mes < 1)  { mes += 12; ano--; }
  return ano + '-' + String(mes).padStart(2, '0');
}
function mesesEntre(a, b) {
  var A = ymPartes(a), B = ymPartes(b);
  return (B.ano - A.ano) * 12 + (B.mes - A.mes);
}
function diasNoMes(chave) {
  var p = ymPartes(chave);
  return new Date(p.ano, p.mes, 0).getDate();
}
function rotuloMes(chave) {
  var p = ymPartes(chave);
  return MESES_PT[p.mes - 1] + ' ' + p.ano;
}
function rotuloMesCurto(chave) {
  var p = ymPartes(chave);
  return MESES_PT[p.mes - 1].slice(0, 3) + '/' + p.ano;
}
function diaDeHoje(chave) {
  return Math.min(new Date().getDate(), diasNoMes(chave));
}

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function moedaCurta(v) {
  return formatarMoeda(v).replace('R$', '').trim();
}

/* Aceita "1.234,56", "1234,56", "1234.56", "1234" -> número */
function parseValor(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  var s = String(str).trim().replace(/[^\d.,-]/g, '');
  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  var n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function escapar(s) {
  var d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}

function diasDesde(iso) {
  if (!iso) return null;
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return null;
  return Math.floor((new Date().setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / 86400000);
}
function hojeISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* =========================================================
   Mês: estrutura + materialização de fixos/parcelas
   ========================================================= */
function garantirMes(chave) {
  if (!db.meses[chave]) {
    db.meses[chave] = { lancamentos: [], removidos: [], separacoes: [], orcamentoSilenciado: false };
  }
  var mes = db.meses[chave];
  if (!Array.isArray(mes.removidos))  mes.removidos = [];
  if (!Array.isArray(mes.separacoes)) mes.separacoes = [];

  var mudou = false;

  db.fixos.forEach(function (fixo) {
    if (fixo.desde && chave < fixo.desde) return;
    if (mes.removidos.indexOf(fixo.id) >= 0) return;

    // Dívida: só materializa dentro da janela de parcelas (acaba sozinha)
    if (ehDivida(fixo)) {
      var k = parcelaNoMes(fixo, chave);
      if (k < 1 || k > fixo.parcelas) return;
    }

    if (mes.lancamentos.some(function (l) { return l.fixoId === fixo.id; })) return;

    mes.lancamentos.push({
      id: novoId(),
      fixoId: fixo.id,
      origem: null,
      descricao: fixo.descricao,
      valor: fixo.valor,
      tipo: fixo.tipo,
      categoria: fixo.categoria || '',
      dia: fixo.dia ? Math.min(fixo.dia, diasNoMes(chave)) : null,
      status: 'previsto'
    });
    mudou = true;
  });

  if (mudou) salvar();
  return mes;
}

/* Remove instâncias ainda não pagas de um fixo nos meses FUTUROS.
   Sem isso: "quitei a dívida mas a parcela continua em outubro". */
function limparFixoDosMesesFuturos(fixoId, aPartirDe) {
  Object.keys(db.meses).forEach(function (k) {
    if (k <= aPartirDe) return;
    var m = db.meses[k];
    m.lancamentos = m.lancamentos.filter(function (l) {
      return !(l.fixoId === fixoId && l.status !== 'ok');
    });
  });
}

/* =========================================================
   Cálculo do mês — INTOCADO desde a v1.
   Separações NÃO entram aqui de propósito.
   ========================================================= */
function calcular(chave) {
  var lancs = (db.meses[chave] && db.meses[chave].lancamentos) || [];
  var entrPrev = 0, saidPrev = 0, entrReal = 0, saidReal = 0;

  lancs.forEach(function (l) {
    if (l.tipo === 'entrada') {
      entrPrev += l.valor;
      if (l.status === 'ok') entrReal += l.valor;
    } else {
      saidPrev += l.valor;
      if (l.status === 'ok') saidReal += l.valor;
    }
  });

  return {
    entrPrev: r2(entrPrev), saidPrev: r2(saidPrev),
    entrReal: r2(entrReal), saidReal: r2(saidReal),
    saldoProjetado: r2(entrPrev - saidPrev),
    saldoReal:      r2(entrReal - saidReal),
    aReceber:       r2(entrPrev - entrReal),
    aPagar:         r2(saidPrev - saidReal),
    totalPrev:      r2(entrPrev + saidPrev),
    totalReal:      r2(entrReal + saidReal)
  };
}

/* =========================================================
   Roteamento / render
   ========================================================= */
function irPara(v) { location.hash = v; }

function renderView() {
  document.querySelectorAll('.view').forEach(function (s) {
    s.hidden = (s.dataset.view !== view);
  });
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.view === view);
  });

  $('#month-nav').hidden = (view !== 'mes');
  $('#view-title').textContent =
    ({ guardar: 'Guardar', dividas: 'Dívidas', desejos: 'Desejos' })[view] || 'Planejador';

  $('#fab-text').textContent =
    ({ mes: 'Adicionar', guardar: 'Nova carteira', dividas: 'Nova dívida', desejos: 'Novo desejo' })[view];

  if (view === 'mes')      renderMes();
  if (view === 'guardar')  renderGuardar();
  if (view === 'dividas')  renderDividas();
  if (view === 'desejos')  renderDesejos();
}

function render() {
  garantirMes(ym);
  garantirMes(ymAtualDoSistema());
  $('#month-label').textContent = rotuloMes(ym);
  renderView();
}

function aplicarHash() {
  var v = location.hash.slice(1);
  view = VIEWS.indexOf(v) >= 0 ? v : 'mes';
}

/* =========================================================
   Overlays / toast
   ========================================================= */
function abrirOverlay(sel) {
  $(sel).hidden = false;
  document.body.style.overflow = 'hidden';
}
function fecharOverlay(sel) {
  $(sel).hidden = true;
  if (!document.querySelector('.overlay:not([hidden])')) document.body.style.overflow = '';
}
function fecharTodosOverlays() {
  document.querySelectorAll('.overlay:not([hidden])').forEach(function (ov) { ov.hidden = true; });
  document.body.style.overflow = '';
}

function toast(msg) {
  var t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(function () { t.classList.add('show'); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    t.classList.remove('show');
    setTimeout(function () { t.hidden = true; }, 300);
  }, 2400);
}

/* Folha genérica de valor (caixa de hoje, valor de quitação do banco…) */
function pedirValor(titulo, texto, rotulo, valorAtual, cb) {
  $('#vl-titulo').textContent = titulo;
  $('#vl-texto').textContent = texto || '';
  $('#vl-texto').hidden = !texto;
  $('#vl-label').textContent = rotulo || 'Valor (R$)';
  $('#vl-input').value = valorAtual ? moedaCurta(valorAtual) : '';
  valorCallback = cb;
  abrirOverlay('#overlay-valor');
  setTimeout(function () { $('#vl-input').focus(); $('#vl-input').select(); }, 250);
}

/* =========================================================
   Tema
   ========================================================= */
function aplicarTema() {
  var t = db.config.tema;
  var root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  var escuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#btn-theme').textContent = escuro ? '☀️' : '🌙';
}
function alternarTema() {
  var ordem = { auto: 'light', light: 'dark', dark: 'auto' };
  db.config.tema = ordem[db.config.tema] || 'light';
  salvar();
  aplicarTema();
  toast('Tema: ' + ({ auto: 'automático', light: 'claro', dark: 'escuro' })[db.config.tema]);
}

/* =========================================================
   Backup / restauração
   ========================================================= */
function exportar() {
  var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'planejador-backup-' + hojeISO() + '.json';
  a.click();
  URL.revokeObjectURL(url);
  fecharOverlay('#overlay-menu');
  toast('Backup baixado ⬇️');
}

function importar(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var dados = JSON.parse(e.target.result);
      if (!dados || typeof dados !== 'object') throw 0;
      if (typeof dados.meses !== 'object' || dados.meses === null) throw 0;
      if (!Array.isArray(dados.fixos)) throw 0;
      db = dados;
      migrar();                     // backup v1 restaurado é migrado na hora
      fecharOverlay('#overlay-menu');
      render();
      toast('Backup restaurado ✅');
    } catch (err) {
      toast('Arquivo inválido 😕');
    }
  };
  reader.readAsText(file);
}

function restaurarBackupAuto() {
  var raw = null;
  try { raw = localStorage.getItem(STORE_KEY + '_backup_v1'); } catch (e) {}
  if (!raw) { toast('Não há backup automático 🤷'); return; }
  if (!confirm('Voltar os dados pra antes da atualização?\n\nO que você fez depois disso será perdido.')) return;
  try {
    db = JSON.parse(raw);
    migrar();
    fecharOverlay('#overlay-menu');
    render();
    toast('Dados restaurados ♻️');
  } catch (e) {
    toast('Backup automático corrompido 😕');
  }
}

function resetar() {
  if (!confirm('Apagar TODOS os dados deste aparelho? Isso não dá pra desfazer.\n\nDica: exporte um backup antes.')) return;
  db = bancoVazio();
  salvar();
  fecharOverlay('#overlay-menu');
  render();
  toast('Tudo limpo 🧹');
}

function atualizarRotulosMenu() {
  $('#lbl-links').textContent   = 'Prévia de links: ' + (db.config.buscarPreviaLinks ? 'ligada' : 'desligada');
  $('#lbl-sugerir').textContent = 'Sugerir ao receber: ' + (db.config.sugerirAoReceber ? 'ligado' : 'desligado');
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventos() {
  /* Navegação de mês */
  $('#prev-month').addEventListener('click', function () { ym = ymDeslocado(ym, -1); render(); });
  $('#next-month').addEventListener('click', function () { ym = ymDeslocado(ym, +1); render(); });
  $('#month-label').addEventListener('click', function () { ym = ymAtualDoSistema(); render(); });
  $('#btn-hoje').addEventListener('click', function () {
    ym = ymAtualDoSistema();
    if (view !== 'mes') irPara('mes'); else render();
    toast('Mês atual');
  });

  $('#btn-theme').addEventListener('click', alternarTema);
  $('#btn-menu').addEventListener('click', function () {
    atualizarRotulosMenu();
    abrirOverlay('#overlay-menu');
  });

  /* Nav inferior */
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.addEventListener('click', function () { irPara(b.dataset.view); });
  });

  /* FAB contextual */
  $('#fab-add').addEventListener('click', function () {
    if (view === 'mes')      abrirForm(null);
    if (view === 'guardar')  abrirCarteira(null);
    if (view === 'dividas')  abrirDivida(null);
    if (view === 'desejos')  abrirDesejo(null);
  });

  /* Menu */
  $('#menu-export').addEventListener('click', exportar);
  $('#menu-import').addEventListener('click', function () { $('#file-import').click(); });
  $('#file-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importar(e.target.files[0]);
    e.target.value = '';
  });
  $('#menu-duplicar').addEventListener('click', copiarMesAnterior);
  $('#menu-restaurar').addEventListener('click', restaurarBackupAuto);
  $('#menu-reset').addEventListener('click', resetar);
  $('#menu-close').addEventListener('click', function () { fecharOverlay('#overlay-menu'); });
  $('#menu-links').addEventListener('click', function () {
    db.config.buscarPreviaLinks = !db.config.buscarPreviaLinks;
    salvar(); atualizarRotulosMenu();
    toast(db.config.buscarPreviaLinks ? 'Prévia de links ligada 🔗' : 'Prévia de links desligada');
  });
  $('#menu-sugerir').addEventListener('click', function () {
    db.config.sugerirAoReceber = !db.config.sugerirAoReceber;
    salvar(); atualizarRotulosMenu();
    toast(db.config.sugerirAoReceber ? 'Vou sugerir ao receber 🐷' : 'Não vou mais sugerir');
  });

  /* Folha genérica de valor */
  $('#vl-cancel').addEventListener('click', function () { fecharOverlay('#overlay-valor'); });
  $('#vl-save').addEventListener('click', function () {
    var v = parseValor($('#vl-input').value);
    fecharOverlay('#overlay-valor');
    if (typeof valorCallback === 'function') valorCallback(v);
    valorCallback = null;
  });
  $('#vl-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#vl-save').click(); });

  /* Fechar overlay tocando no fundo */
  document.querySelectorAll('.overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) { if (e.target === ov) fecharOverlay('#' + ov.id); });
  });

  /* Esc fecha */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fecharTodosOverlays();
  });

  /* Hash routing */
  addEventListener('hashchange', function () {
    aplicarHash();
    fecharTodosOverlays();
    render();
  });

  /* Eventos dos módulos */
  if (typeof ligarEventosMes === 'function')       ligarEventosMes();
  if (typeof ligarEventosCarteiras === 'function') ligarEventosCarteiras();
  if (typeof ligarEventosDividas === 'function')   ligarEventosDividas();
  if (typeof ligarEventosDesejos === 'function')   ligarEventosDesejos();
}

/* =========================================================
   Boot
   ========================================================= */
function init() {
  carregar();
  aplicarTema();
  ym = ymAtualDoSistema();
  aplicarHash();
  ligarEventos();
  render();

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
}

document.addEventListener('DOMContentLoaded', init);
