/* =========================================================
   Planejador v2 — aba MÊS (a tela principal)
   ---------------------------------------------------------
   REGRA DURA: este arquivo contém SOMENTE `function nome(){}`.
   Zero let/const/var em escopo de arquivo — todas as globais
   moram no app.js. (Redeclarar global aqui = SyntaxError
   silencioso que mata a página inteira. Já aconteceu: c333d62.)

   PROGRESSIVE DISCLOSURE: sem dívida, sem carteira e sem
   pct > 0, esta tela é pixel a pixel a de sempre. Todo bloco
   novo começa com early-return/hidden.
   ========================================================= */

'use strict';

/* =========================================================
   Helpers internos (prefixo `mes` pra não colidir com nada)
   ========================================================= */

/* Nunca deixa Infinity/NaN/undefined chegar na tela. */
function mesNumero(v) {
  return (typeof v === 'number' && isFinite(v)) ? v : 0;
}

/* Leituras dos outros módulos, à prova de módulo ausente.
   Se carteiras.js/dividas.js não carregar, a aba Mês continua de pé. */
function mesSeparado(chave) {
  if (typeof separadoNoMes === 'function') return mesNumero(separadoNoMes(chave));
  var m = db.meses[chave];
  if (!m || !Array.isArray(m.separacoes)) return 0;
  return r2(m.separacoes.reduce(function (s, x) { return s + mesNumero(x.valor); }, 0));
}
function mesPct() {
  return (typeof pctTotal === 'function') ? mesNumero(pctTotal()) : 0;
}
function mesTotalGuardado() {
  return (typeof totalGuardado === 'function') ? mesNumero(totalGuardado()) : 0;
}
function mesDividasAtivas() {
  return (typeof dividasAtivas === 'function') ? (dividasAtivas() || []) : [];
}
function mesAlivio() {
  return (typeof alivioMensal === 'function') ? mesNumero(alivioMensal()) : 0;
}
function mesCarteira(id) {
  return db.carteiras.find(function (w) { return w.id === id; }) || null;
}

/* Frase que nomeia o que foi separado — usada na sub-linha do hero. */
function mesFraseSeparado(separado) {
  if (separado > 0) return 'você separou ' + formatarMoeda(separado) + ' este mês';
  if (separado < 0) return 'você retirou ' + formatarMoeda(-separado) + ' das carteiras';
  return 'nada separado ainda este mês';
}

/* =========================================================
   Render da aba Mês
   ========================================================= */
function renderMes() {
  var mes = garantirMes(ym);
  var c = calcular(ym);

  var separado = mesSeparado(ym);
  var pctPlano = mesPct();

  /* livre = saldo − o que mudou de bolso. Separação NÃO é despesa. */
  var livreProj = r2(c.saldoProjetado - separado);

  /* --------- micro-switch: só existe se houver o que alternar --------- */
  var mostrarSwitch = (separado !== 0 || pctPlano > 0);
  var sw = $('#micro-switch');
  sw.hidden = !mostrarSwitch;
  if (!mostrarSwitch) modoHero = 'projetado';
  sw.querySelectorAll('.ms-opt').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.modo === modoHero);
  });

  /* --------- hero --------- */
  var emLivre = (modoHero === 'livre');
  var valorHero = emLivre ? livreProj : c.saldoProjetado;

  $('#hero-label').textContent = emLivre ? 'Livre pra gastar este mês' : 'Saldo projetado do mês';

  var hv = $('#saldo-projetado');
  hv.textContent = formatarMoeda(valorHero);
  hv.classList.toggle('pos', valorHero > 0);
  hv.classList.toggle('neg', valorHero < 0);

  /* A sub-linha SEMPRE nomeia o outro número — nenhuma informação some. */
  var sub = $('#saldo-sub');
  if (!mostrarSwitch) {
    if (c.totalPrev === 0) {
      sub.textContent = 'Adicione suas entradas e saídas ✨';
    } else if (c.saldoProjetado >= 0) {
      sub.textContent = 'Se tudo acontecer, sobram ' + formatarMoeda(c.saldoProjetado) + ' no mês.';
    } else {
      sub.textContent = 'Atenção: previsão de faltar ' + formatarMoeda(Math.abs(c.saldoProjetado)) + '.';
    }
  } else if (emLivre) {
    sub.textContent = 'Saldo projetado: ' + formatarMoeda(c.saldoProjetado) +
                      ' · ' + mesFraseSeparado(separado);
  } else {
    sub.textContent = 'Livre pra gastar: ' + formatarMoeda(livreProj) +
                      ' · ' + mesFraseSeparado(separado);
  }

  /* --------- chips (2 fixos + até 2 condicionais) --------- */
  $('#stat-receber').textContent = formatarMoeda(c.aReceber);
  $('#stat-pagar').textContent   = formatarMoeda(c.aPagar);
  mesRenderChipsExtras(separado);

  /* --------- barra de realizado (inalterada desde a v1) --------- */
  var pct = c.totalPrev > 0 ? Math.round((c.totalReal / c.totalPrev) * 100) : 0;
  pct = Math.max(0, Math.min(100, mesNumero(pct)));
  $('#realizado-pct').textContent = pct + '%';
  $('#progress-fill').style.width = pct + '%';
  $('#realizado-foot').textContent = c.totalPrev === 0
    ? 'Marque os itens conforme forem acontecendo.'
    : 'Saldo já realizado: ' + formatarMoeda(c.saldoReal);

  /* --------- faixa "Plano do mês" (só com pct > 0) --------- */
  mesRenderPlano(c, separado);

  /* --------- totais + listas --------- */
  $('#total-entradas').textContent = formatarMoeda(c.entrPrev);
  $('#total-saidas').textContent   = formatarMoeda(c.saidPrev);

  var lancs = mes.lancamentos;
  renderLista('#list-entradas',
    lancs.filter(function (l) { return l.tipo === 'entrada'; }),
    'Nenhuma entrada ainda. Toque em Adicionar 👇');
  renderLista('#list-saidas',
    lancs.filter(function (l) { return l.tipo === 'saida'; }),
    'Nenhuma saída ainda. Toque em Adicionar 👇');

  /* --------- separações do mês (colapsado, só se houver) --------- */
  mesRenderSeparacoes();
}

/* ---------------------------------------------------------
   Chips extras: guardado e dívidas. Anexados ao #hero-chips
   (os dois .stat estáticos NUNCA são destruídos).
   --------------------------------------------------------- */
function mesRenderChipsExtras(separado) {
  var box = $('#hero-chips');
  box.querySelectorAll('[data-chip-extra]').forEach(function (el) { el.remove(); });

  var total = mesTotalGuardado();
  if (separado !== 0 || total > 0) {
    var rotulo, valor;
    if (separado > 0)      { rotulo = 'Separei este mês';  valor = separado; }
    else if (separado < 0) { rotulo = 'Retirei este mês';  valor = -separado; }
    else                   { rotulo = 'Guardado';          valor = total; }
    box.appendChild(mesChip('save', rotulo, formatarMoeda(valor), 'guardar'));
  }

  var dvs = mesDividasAtivas();
  if (dvs.length > 0) {
    box.appendChild(mesChip(
      'debt',
      dvs.length === 1 ? '1 dívida' : dvs.length + ' dívidas',
      formatarMoeda(mesAlivio()) + '/mês',
      'dividas'
    ));
  }
}

function mesChip(dot, rotulo, valor, destino) {
  var d = document.createElement('div');
  d.className = 'stat tappable';
  d.setAttribute('data-chip-extra', '1');
  d.innerHTML =
    '<span class="stat-dot ' + dot + '"></span>' +
    '<div>' +
      '<div class="stat-label">' + escapar(rotulo) + '</div>' +
      '<div class="stat-value">' + escapar(valor) + '</div>' +
    '</div>';
  d.addEventListener('click', function () { irPara(destino); });
  return d;
}

/* ---------------------------------------------------------
   Faixa "Plano do mês" — early-return se não houver regra
   --------------------------------------------------------- */
function mesRenderPlano(c, separado) {
  var box = $('#plano-mes');

  if (mesPct() <= 0 || typeof faltaSeparar !== 'function') {
    box.hidden = true;
    box.innerHTML = '';
    box.className = 'plano card';
    return;
  }

  var f = faltaSeparar(ym) || {};
  var bruta = Math.max(0, mesNumero(f.bruta));
  var teto  = Math.max(0, mesNumero(f.teto));
  var cabe  = Math.max(0, mesNumero(f.final));
  var plano = (typeof planoDoMes === 'function') ? mesNumero(planoDoMes(ym)) : r2(separado + bruta);

  /* Mesma matemática do tetoSeparar: min(livreAgora, livreProjetado). */
  var livreProj = r2(c.saldoProjetado - separado);
  var livreAg   = r2(c.saldoReal - separado);
  var buraco    = Math.max(0, r2(-Math.min(livreProj, livreAg)));

  var classe, texto, botao;

  if (bruta <= 0 && plano <= 0 && separado <= 0) {
    /* Nada entrou ainda: o plano é zero por falta de renda, não porque foi cumprido.
       Não dá pra parabenizar quem ainda não recebeu nada. */
    classe = '';
    texto  = 'Quando cair dinheiro, eu separo <strong>' + pctTotal() + '%</strong> pra você.';
    botao  = null;
  } else if (bruta <= 0) {
    classe = 'ok';
    texto  = 'Plano do mês feito 🎉 <strong>' + escapar(formatarMoeda(separado)) + '</strong> separados.';
    botao  = null;
  } else if (teto <= 0) {
    classe = 'ruim';
    texto  = 'Este mês fecha faltando <strong>' + escapar(formatarMoeda(buraco)) + '</strong>. ' +
             'Não dá pra guardar agora.';
    botao  = null;                       // o botão SOME, não fica desabilitado
  } else if (cabe < bruta) {
    classe = 'aviso';
    texto  = 'Sua meta é <strong>' + escapar(formatarMoeda(bruta)) + '</strong>, ' +
             'mas só cabem <strong>' + escapar(formatarMoeda(cabe)) + '</strong> este mês.';
    botao  = 'Separar ' + formatarMoeda(cabe);
  } else {
    classe = 'ok';
    texto  = 'Guardar <strong>' + escapar(formatarMoeda(plano)) + '</strong> este mês · ' +
             'você já separou <strong>' + escapar(formatarMoeda(separado)) + '</strong>.';
    botao  = 'Separar o resto (' + formatarMoeda(cabe) + ')';
  }

  box.hidden = false;
  box.className = 'plano card ' + classe;
  box.innerHTML =
    '<div class="plano-linha">' +
      '<div class="plano-txt">' + texto + '</div>' +
      (botao ? '<button class="btn-mini" data-separar>' + escapar(botao) + '</button>' : '') +
    '</div>';

  var btn = box.querySelector('[data-separar]');
  if (btn) btn.addEventListener('click', function () { mesSepararResto(cabe); });
}

function mesSepararResto(valor) {
  if (!(valor > 0)) return;
  if (typeof aplicarSeparacao !== 'function') { toast('Crie uma carteira primeiro 🐷'); return; }
  garantirMes(ym);
  var v = mesNumero(aplicarSeparacao(ym, valor, 'sugestao'));
  if (v <= 0) { toast('Não deu pra separar agora 🤷'); return; }
  salvar();
  render();
  toast('Separei ' + formatarMoeda(v) + ' 🐷 — agora faz igual no banco');
}

/* ---------------------------------------------------------
   Separações do mês — bloco colapsado, tap = desfazer
   --------------------------------------------------------- */
function mesRenderSeparacoes() {
  var box   = $('#sep-box');
  var lista = $('#list-separacoes');
  var m = db.meses[ym];
  var seps = (m && Array.isArray(m.separacoes)) ? m.separacoes : [];

  if (seps.length === 0) {
    box.hidden = true;
    lista.innerHTML = '';
    return;
  }

  box.hidden = false;
  $('#sep-summary').textContent =
    'Separações do mês (' + seps.length + ') · ' + formatarMoeda(mesSeparado(ym));

  lista.innerHTML = '';
  seps.slice()
      .sort(function (a, b) { return (a.dia || 99) - (b.dia || 99); })
      .forEach(function (s) { lista.appendChild(mesItemSeparacao(s)); });
}

function mesItemSeparacao(s) {
  var w = mesCarteira(s.carteiraId);
  var nome  = w ? w.nome  : 'Carteira removida';
  var emoji = w ? (w.emoji || '🐷') : '🐷';
  var valor = mesNumero(s.valor);
  var cls   = valor >= 0 ? 'pos' : 'neg';
  var sinal = valor >= 0 ? '+' : '−';

  var d = document.createElement('div');
  d.className = 'sep-item';
  d.innerHTML =
    '<span>' + escapar(emoji) + '</span>' +
    '<span class="sep-nome">' + escapar(nome) + '</span>' +
    '<span class="sep-val ' + cls + '">' + sinal + ' ' + escapar(moedaCurta(Math.abs(valor))) + '</span>';

  d.addEventListener('click', function () { mesDesfazerSeparacao(s.id); });
  return d;
}

function mesDesfazerSeparacao(id) {
  var m = db.meses[ym];
  if (!m || !Array.isArray(m.separacoes)) return;

  var s = m.separacoes.find(function (x) { return x.id === id; });
  if (!s) return;

  var w = mesCarteira(s.carteiraId);
  var nome = w ? w.nome : 'a carteira';
  var valor = mesNumero(s.valor);
  var texto = valor >= 0
    ? 'Desfazer a separação de ' + formatarMoeda(valor) + ' em "' + nome + '"?'
    : 'Desfazer a retirada de ' + formatarMoeda(-valor) + ' de "' + nome + '"?';

  if (!confirm(texto)) return;

  m.separacoes = m.separacoes.filter(function (x) { return x.id !== id; });
  salvar();
  render();
  toast('Desfeito ↩️');
}

/* =========================================================
   Listas e itens
   ========================================================= */
function ordenar(lancs) {
  return lancs.slice().sort(function (a, b) {
    var da = a.dia || 99, dbb = b.dia || 99;
    if (da !== dbb) return da - dbb;
    return String(a.descricao || '').localeCompare(String(b.descricao || ''));
  });
}

function renderLista(sel, lancs, vazioMsg) {
  var el = $(sel);
  el.innerHTML = '';
  if (lancs.length === 0) {
    el.innerHTML = '<div class="empty-state">' + vazioMsg + '</div>';
    return;
  }
  ordenar(lancs).forEach(function (l) { el.appendChild(criarItem(l)); });
}

/* Badge do item. GUARD OBRIGATÓRIO contra fixoId órfão:
   depois de quitar/excluir um fixo, lançamentos antigos apontam
   pra nada — sem o guard a tela do mês passado quebra. */
function badgeDoItem(l) {
  if (!l.fixoId) return '';

  var f = db.fixos.find(function (x) { return x.id === l.fixoId; });
  if (!f) return '';                                   // fixo apagado -> sem badge, sem crash

  var divida = (typeof ehDivida === 'function')
    ? ehDivida(f)
    : !!(f.parcelas && f.parcelas > 0);

  if (!divida || !f.desde) return '<span class="item-recur">↻ mensal</span>';

  var k = (typeof parcelaNoMes === 'function')
    ? parcelaNoMes(f, ym)
    : (mesesEntre(f.desde, ym) + 1);

  if (!isFinite(k) || k < 1) return '<span class="item-recur">↻ mensal</span>';
  return '<span class="item-recur">🧾 ' + k + '/' + f.parcelas + '</span>';
}

/* Badge de origem — só aparece pra quitação e compra de desejo. */
function mesBadgeOrigem(l) {
  if (l.origem === 'quitacao') return '<span class="item-recur">⚡ quitação</span>';
  if (l.origem === 'desejo')   return '<span class="item-recur">✨ desejo</span>';
  return '';
}

function criarItem(l) {
  var div = document.createElement('div');
  div.className = 'item' + (l.status === 'ok' ? ' done' : '');
  div.dataset.id = l.id;

  var cls = l.tipo === 'entrada' ? 'in' : 'out';
  var sinal = l.tipo === 'entrada' ? '+' : '−';
  var dia = l.dia
    ? '<div class="item-day"><span class="d-num">' + l.dia + '</span><span class="d-lbl">dia</span></div>'
    : '<div class="item-day empty"><span class="d-num">·</span></div>';

  var meta = [];
  if (l.categoria) meta.push('<span class="item-tag">' + escapar(l.categoria) + '</span>');
  var badge = badgeDoItem(l) || mesBadgeOrigem(l);
  if (badge) meta.push(badge);
  var metaHtml = meta.length ? '<div class="item-meta">' + meta.join('') + '</div>' : '';

  div.innerHTML =
    '<div class="check" data-check></div>' +
    dia +
    '<div class="item-main">' +
      '<div class="item-desc">' + escapar(l.descricao) + '</div>' +
      metaHtml +
    '</div>' +
    '<div class="item-value ' + cls + '">' + sinal + ' ' + escapar(moedaCurta(l.valor)) + '</div>';

  // Toque no check = marcar realizado; toque no resto = editar
  div.querySelector('[data-check]').addEventListener('click', function (e) {
    e.stopPropagation();
    toggleStatus(l.id);
  });
  div.addEventListener('click', function () { abrirForm(l.id); });

  return div;
}

/* =========================================================
   Ações sobre lançamentos
   ========================================================= */
function acharLanc(id) {
  var m = db.meses[ym];
  if (!m) return null;
  return m.lancamentos.find(function (l) { return l.id === id; }) || null;
}

/* O GATILHO mora aqui: marcar uma ENTRADA como recebida é o
   gesto que abre a sugestão de quanto guardar. */
function toggleStatus(id) {
  var l = acharLanc(id);
  if (!l) return;

  var virouOk = l.status !== 'ok';
  l.status = virouOk ? 'ok' : 'previsto';
  if (!virouOk && l.tipo === 'entrada') l.orcado = false;   // desmarcou = pode perguntar de novo
  salvar();
  render();

  if (virouOk && l.tipo === 'entrada' &&
      typeof podeSugerir === 'function' && typeof abrirSugestao === 'function' &&
      podeSugerir(l)) {
    abrirSugestao(l);
  }
}

/* =========================================================
   Folha de lançamento
   ========================================================= */
function mesSetTipo(tipo) {
  tipoForm = tipo;
  document.querySelectorAll('#overlay-form .type-opt[data-type]').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.type === tipo);
  });
}

function abrirForm(id) {
  var l = id ? acharLanc(id) : null;

  /* Parcela de dívida: a folha certa é a de dívida (tem "estou na parcela N"). */
  if (l && l.fixoId) {
    var f = db.fixos.find(function (x) { return x.id === l.fixoId; });
    var divida = f && ((typeof ehDivida === 'function') ? ehDivida(f) : !!(f.parcelas && f.parcelas > 0));
    if (divida && typeof abrirDivida === 'function') { abrirDivida(f.id); return; }
  }

  editandoId = l ? l.id : null;

  $('#form-title').textContent = l ? 'Editar lançamento' : 'Novo lançamento';
  mesSetTipo(l ? l.tipo : 'entrada');
  $('#f-descricao').value = l ? l.descricao : '';
  $('#f-valor').value     = l ? moedaCurta(l.valor) : '';
  $('#f-dia').value       = (l && l.dia) ? l.dia : '';
  $('#f-categoria').value = l ? (l.categoria || '') : '';

  var repRow = $('#repeat-row');
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
  setTimeout(function () { $('#f-descricao').focus(); }, 250);
}

function salvarForm() {
  var descricao = $('#f-descricao').value.trim();
  var valor = parseValor($('#f-valor').value);
  var diaRaw = parseInt($('#f-dia').value, 10);
  var diaBase = (diaRaw >= 1 && diaRaw <= 31) ? diaRaw : null;
  var categoria = $('#f-categoria').value.trim();

  if (!descricao) { toast('Dá um nome pro lançamento 🙂'); $('#f-descricao').focus(); return; }
  if (valor <= 0) { toast('Qual o valor? 💸'); $('#f-valor').focus(); return; }

  // No lançamento o dia é clampado; no fixo guardamos o dia cru (cada mês clampa o seu)
  var dia = diaBase ? Math.min(diaBase, diasNoMes(ym)) : null;

  if (editandoId) {
    var l = acharLanc(editandoId);
    if (l) {
      l.descricao = descricao;
      l.valor = valor;
      l.tipo = tipoForm;
      l.dia = dia;
      l.categoria = categoria;
      if (l.tipo === 'entrada' && l.orcado === undefined) l.orcado = (l.status === 'ok');

      // Ligado a um fixo? mantém o vínculo e atualiza o template também
      if (l.fixoId) {
        var fx = db.fixos.find(function (f) { return f.id === l.fixoId; });
        if (fx) {
          fx.descricao = descricao;
          fx.valor = valor;
          fx.tipo = tipoForm;
          fx.dia = diaBase;
          fx.categoria = categoria;
        }
      }
    }
  } else {
    var repetir = $('#f-repetir').checked;
    var fixoId = null;
    if (repetir) {
      fixoId = novoId();
      db.fixos.push({
        id: fixoId, descricao: descricao, valor: valor, tipo: tipoForm,
        categoria: categoria, dia: diaBase, desde: ym,
        parcelas: null, quitacaoInformada: null
      });
    }
    db.meses[ym].lancamentos.push({
      id: novoId(), fixoId: fixoId, origem: null,
      descricao: descricao, valor: valor, tipo: tipoForm,
      categoria: categoria, dia: dia, status: 'previsto',
      orcado: false
    });
  }

  salvar();
  fecharOverlay('#overlay-form');
  var eraEdicao = !!editandoId;
  editandoId = null;
  render();
  toast(eraEdicao ? 'Atualizado ✅' : 'Adicionado ✅');
}

function excluirAtual() {
  var l = acharLanc(editandoId);
  if (!l) return;

  if (l.fixoId) {
    // item recorrente -> perguntar escopo
    $('#recorrente-text').textContent =
      '"' + l.descricao + '" se repete todo mês. O que você quer fazer?';
    fecharOverlay('#overlay-form');
    abrirOverlay('#overlay-recorrente');
    return;
  }

  db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(function (x) { return x.id !== l.id; });
  salvar();
  fecharOverlay('#overlay-form');
  editandoId = null;
  render();
  toast('Excluído 🗑️');
}

function excluirRecorrente(escopo) {
  var l = acharLanc(editandoId);
  if (!l) { fecharOverlay('#overlay-recorrente'); return; }

  var fixoId = l.fixoId;

  if (escopo === 'mes') {
    // remove só deste mês e impede materializar de novo
    db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(function (x) { return x.id !== l.id; });
    if (fixoId && db.meses[ym].removidos.indexOf(fixoId) < 0) db.meses[ym].removidos.push(fixoId);
  } else if (escopo === 'todos') {
    db.fixos = db.fixos.filter(function (f) { return f.id !== fixoId; });
    db.meses[ym].lancamentos = db.meses[ym].lancamentos.filter(function (x) { return x.id !== l.id; });
    // Sem isto sobram órfãos nos meses futuros já materializados
    // ("parei de repetir mas continua em outubro").
    if (fixoId) limparFixoDosMesesFuturos(fixoId, ym);
  }

  salvar();
  fecharOverlay('#overlay-recorrente');
  editandoId = null;
  render();
  toast('Excluído 🗑️');
}

/* =========================================================
   Copiar itens do mês anterior
   ========================================================= */
function copiarMesAnterior() {
  var anterior = ymDeslocado(ym, -1);
  var src = db.meses[anterior];
  if (!src || src.lancamentos.length === 0) { toast('Mês anterior está vazio 🤷'); return; }

  garantirMes(ym);
  var destino = db.meses[ym];
  var n = 0;

  src.lancamentos.forEach(function (l) {
    if (l.fixoId) return;   // recorrentes já vêm sozinhos
    if (l.origem) return;   // não copia quitação nem compra de desejo
    destino.lancamentos.push({
      id: novoId(), fixoId: null, origem: null,
      descricao: l.descricao, valor: l.valor, tipo: l.tipo,
      categoria: l.categoria, dia: l.dia ? Math.min(l.dia, diasNoMes(ym)) : null,
      status: 'previsto', orcado: false
    });
    n++;
  });

  // Separações não são copiadas de propósito: moram em outro array.

  salvar();
  fecharOverlay('#overlay-menu');
  if (view !== 'mes') irPara('mes'); else render();
  toast(n ? n + ' item(ns) copiado(s) 📋' : 'Nada novo pra copiar');
}

/* =========================================================
   Eventos (chamado por ligarEventos() do app.js)
   ========================================================= */
function ligarEventosMes() {
  /* Micro-switch do hero — troca a leitura, não persiste nada */
  $('#micro-switch').querySelectorAll('.ms-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      modoHero = b.dataset.modo === 'livre' ? 'livre' : 'projetado';
      render();
    });
  });

  /* Folha de lançamento — escopada no #overlay-form pra não pegar
     os .type-opt[data-mover] da folha de guardar/retirar */
  document.querySelectorAll('#overlay-form .type-opt[data-type]').forEach(function (b) {
    b.addEventListener('click', function () { mesSetTipo(b.dataset.type); });
  });
  $('#form-save').addEventListener('click', salvarForm);
  $('#form-cancel').addEventListener('click', function () {
    fecharOverlay('#overlay-form');
    editandoId = null;
  });
  $('#form-delete').addEventListener('click', excluirAtual);
  $('#f-descricao').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#f-valor').focus();
  });
  $('#f-valor').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') salvarForm();
  });

  /* Folha do recorrente */
  $('#rec-mes').addEventListener('click', function () { excluirRecorrente('mes'); });
  $('#rec-todos').addEventListener('click', function () { excluirRecorrente('todos'); });
  $('#rec-cancel').addEventListener('click', function () {
    fecharOverlay('#overlay-recorrente');
    editandoId = null;
  });
}
