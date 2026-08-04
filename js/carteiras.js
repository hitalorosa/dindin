/* =========================================================
   Planejador v2 — aba "Guardar" (carteiras + orçamento)
   ---------------------------------------------------------
   REGRA DURA: este arquivo NÃO declara nada em escopo de
   arquivo. Só `function nome(){}`. Todas as globais moram
   no app.js. (Redeclarar global com let/var aqui = página
   morta em silêncio — foi o que matou o commit c333d62.)

   REGRA ESTRUTURAL: separação NUNCA vira lançamento.
   Ela vive em db.meses[ym].separacoes, com
   valor > 0 = guardou · valor < 0 = retirou.
   Assim calcular() continua intocada.

   INVARIANTE: saldoCarteira(w) >= 0 SEMPRE.
   ========================================================= */

'use strict';

/* =========================================================
   6.6 — A ÚNICA definição de "guardado"
   ========================================================= */
function separacoesDeCarteira(carteiraId) {
  var t = 0;
  Object.keys(db.meses).forEach(function (k) {
    var seps = db.meses[k].separacoes || [];
    seps.forEach(function (s) { if (s.carteiraId === carteiraId) t += s.valor; });
  });
  return t;
}

function saldoCarteira(w) {
  if (!w) return 0;
  return r2((w.saldoInicial || 0) + separacoesDeCarteira(w.id));
}

function totalGuardado() {
  return r2(db.carteiras.filter(function (w) { return !w.arquivada; })
    .reduce(function (s, w) { return s + saldoCarteira(w); }, 0));
}

/* Guardado NO MÊS. Soma com sinal: retirada aumenta o livre sozinha. */
function separadoNoMes(chave) {
  var m = db.meses[chave];
  return r2(((m && m.separacoes) || []).reduce(function (s, x) { return s + x.valor; }, 0));
}

function livreProjetado(chave) { return r2(calcular(chave).saldoProjetado - separadoNoMes(chave)); }
function livreAgora(chave)     { return r2(calcular(chave).saldoReal      - separadoNoMes(chave)); }

/* =========================================================
   6.7 — Plano do mês com TETO DUPLO
   ========================================================= */
function rendaBaseMes(chave) { return calcular(chave).entrReal; }   // só o que já caiu

function pctTotal() {
  return db.carteiras
    .filter(function (w) { return !w.arquivada && w.pct > 0; })
    .reduce(function (s, w) { return s + w.pct; }, 0);
}

/* livreAgora sozinho ignora as contas que ainda vão vencer.
   livreProjetado sozinho ignora que a entrada pode não ter caído.
   O min() blinda os dois lados. */
function tetoSeparar(chave) {
  return Math.max(0, Math.min(livreAgora(chave), livreProjetado(chave)));
}

function planoDoMes(chave) { return r2(rendaBaseMes(chave) * pctTotal() / 100); }

function faltaSeparar(chave) {
  var teto  = tetoSeparar(chave);
  var bruta = Math.max(0, r2(planoDoMes(chave) - separadoNoMes(chave)));
  return { bruta: bruta, teto: teto, final: r2(Math.min(bruta, teto)) };
}

/* =========================================================
   6.8 — Rateio sem perder centavo (maior resto)
   Σ partes === totalC SEMPRE.
   ========================================================= */
function ratearCentavos(totalC, pesos) {
  var soma = pesos.reduce(function (a, b) { return a + b; }, 0);
  if (soma <= 0 || totalC <= 0) return pesos.map(function () { return 0; });
  var brutos = pesos.map(function (p) { return totalC * p; });
  var partes = brutos.map(function (x) { return Math.floor(x / soma); });
  var restos = brutos.map(function (x) { return x % soma; });
  var falta  = totalC - partes.reduce(function (a, b) { return a + b; }, 0);
  partes.map(function (_, i) { return i; })
    .sort(function (a, b) { return restos[b] - restos[a] || a - b; })
    .slice(0, falta)
    .forEach(function (i) { partes[i]++; });
  return partes;                                     // em centavos
}

function aplicarSeparacao(chave, totalR, origem) {
  var alvo = cartAlvos();
  if (!alvo.length || totalR <= 0) return 0;
  garantirMes(chave);
  var partes = ratearCentavos(Math.round(totalR * 100), alvo.map(function (w) { return w.pct; }));
  var dia = diaDeHoje(chave);
  alvo.forEach(function (w, i) {
    if (partes[i] > 0) {
      db.meses[chave].separacoes.push({
        id: novoId(), carteiraId: w.id, valor: partes[i] / 100,
        dia: dia, origem: origem || 'sugestao'
      });
    }
  });
  salvar();
  return r2(partes.reduce(function (a, b) { return a + b; }, 0) / 100);
}

/* =========================================================
   6.9 — Guardar / retirar manual (retirada SEMPRE clampada)
   ========================================================= */
function guardarManual(chave, carteiraId, valor) {
  if (valor <= 0) return 0;
  garantirMes(chave);
  db.meses[chave].separacoes.push({
    id: novoId(), carteiraId: carteiraId, valor: r2(valor),
    dia: diaDeHoje(chave), origem: 'manual'
  });
  salvar();
  return r2(valor);
}

/* É caixinha, não tem cheque especial. Saldo negativo aqui não representa nada real. */
function retirarDaCarteira(chave, carteiraId, pedido) {
  var w = cartAchar(carteiraId);
  if (!w) return 0;
  var v = Math.min(r2(pedido), saldoCarteira(w));
  if (v <= 0) { toast('Essa carteira está zerada 🤷'); return 0; }
  if (v < pedido) toast('Tirei os ' + formatarMoeda(v) + ' que tinham lá');
  garantirMes(chave);
  db.meses[chave].separacoes.push({
    id: novoId(), carteiraId: carteiraId, valor: -v,
    dia: diaDeHoje(chave), origem: 'manual'
  });
  salvar();
  return v;
}

/* =========================================================
   Helpers só deste módulo (prefixo cart* pra não colidir)
   ========================================================= */
function cartAchar(id) {
  return db.carteiras.filter(function (w) { return w.id === id; })[0] || null;
}
function cartAtivas() {
  return db.carteiras.filter(function (w) { return !w.arquivada; });
}
function cartArquivadas() {
  return db.carteiras.filter(function (w) { return !!w.arquivada; });
}
/* Carteiras que participam do rateio: ativas e com meta de % definida por ele. */
function cartAlvos() {
  return db.carteiras.filter(function (w) { return !w.arquivada && w.pct > 0; });
}
/* O mês em que a aba Guardar opera. Mesmo mês da aba Mês, pra os dois números baterem. */
function cartMesAlvo() { return ym; }

function cartNomeMes(chave) { return MESES_PT[ymPartes(chave).mes - 1]; }

/* "este mês" quando é o mês corrente; senão nomeia o mês, pra nunca mentir. */
function cartQuandoTxt(chave) {
  return chave === ymAtualDoSistema() ? 'este mês' : 'em ' + cartNomeMes(chave);
}

function cartZerada(w) { return Math.abs(saldoCarteira(w)) < 0.005; }

/* Última carteira mexida — vem pré-selecionada na folha de mover. */
function cartUltimaUsada() {
  var chaves = Object.keys(db.meses).sort();
  for (var i = chaves.length - 1; i >= 0; i--) {
    var seps = db.meses[chaves[i]].separacoes || [];
    for (var j = seps.length - 1; j >= 0; j--) {
      var w = cartAchar(seps[j].carteiraId);
      if (w && !w.arquivada) return w.id;
    }
  }
  return null;
}

function cartTemSugestaoNoMes(chave) {
  var m = db.meses[chave];
  return !!(m && (m.separacoes || []).some(function (s) { return s.origem === 'sugestao'; }));
}

/* =========================================================
   Render da aba
   ========================================================= */
function renderGuardar() {
  var chave = cartMesAlvo();
  var ativas = cartAtivas();
  var arquivadas = cartArquivadas();
  var total = totalGuardado();
  var noMes = separadoNoMes(chave);

  /* ---------- Hero ---------- */
  $('#g-total').textContent = formatarMoeda(total);

  if (!db.carteiras.length) {
    $('#g-sub').textContent = 'Crie uma carteira pra começar 🐷';
  } else if (!ativas.length) {
    $('#g-sub').textContent = 'Suas carteiras estão todas arquivadas 📦';
  } else {
    var partesSub = [ativas.length + (ativas.length === 1 ? ' carteira' : ' carteiras')];
    if (Math.abs(noMes) >= 0.005) {
      partesSub.push((noMes > 0 ? '+' : '−') + formatarMoeda(Math.abs(noMes)) + ' ' + cartQuandoTxt(chave));
    }
    if (arquivadas.length) partesSub.push(arquivadas.length + ' arquivada' + (arquivadas.length === 1 ? '' : 's'));
    $('#g-sub').textContent = 'em ' + partesSub.join(' · ');
  }

  $('#g-count').textContent = ativas.length ? ativas.length + (ativas.length === 1 ? ' carteira' : ' carteiras') : '';

  cartRenderRegra(chave);
  cartRenderLista();
}

/* ---------- Card "Regra do mês" (é o Orçamento) ---------- */
function cartRenderRegra(chave) {
  var card = $('#card-regra');
  card.className = 'card regra';

  /* Sem carteira nenhuma: o card não tem o que dizer. O FAB resolve. */
  if (!cartAtivas().length) { card.hidden = true; card.innerHTML = ''; return; }
  card.hidden = false;

  var pct = pctTotal();

  /* Empty-state: ele ainda não definiu nenhuma %. */
  if (pct <= 0) {
    card.innerHTML =
      '<div class="regra-titulo">Regra do mês</div>' +
      '<div class="regra-frase">Quer que eu sugira quanto guardar toda vez que cair dinheiro?</div>' +
      '<div class="regra-nums">É só dizer quantos % de cada entrada vão pra cada carteira. Fica a seu critério.</div>' +
      '<div class="regra-acoes"><button class="btn-mini" data-acao="definir">Definir %</button></div>';
    return;
  }

  var f = faltaSeparar(chave);
  var plano = planoDoMes(chave);
  var sep = separadoNoMes(chave);
  var lp = livreProjetado(chave);
  var la = livreAgora(chave);

  var linhaCarteiras = cartAlvos().map(function (w) {
    return escapar(w.emoji || '🐷') + ' ' + escapar(w.nome) + ' ' + w.pct + '%';
  }).join(' · ');

  var html =
    '<div class="regra-titulo">Regra do mês</div>' +
    '<div class="regra-frase">Sua meta: toda vez que entra dinheiro, guardar <strong>' + pct + '%</strong></div>' +
    '<div class="regra-nums">' + linhaCarteiras + '</div>' +
    '<div class="regra-nums">Em ' + cartNomeMes(chave) + ': plano ' + formatarMoeda(plano) +
      ' · já separado ' + formatarMoeda(sep) + '</div>';

  var acoes = [];

  if (f.bruta <= 0 && plano <= 0 && sep <= 0) {
    /* Plano é zero porque nada entrou ainda — não é meta cumprida. */
    html += '<div class="regra-nums">Ainda não entrou dinheiro ' + cartQuandoTxt(chave) +
      '. Quando entrar, eu separo ' + pct + '%.</div>';
  } else if (f.bruta <= 0) {
    /* Meta do mês já batida — nada a cobrar. */
    html += '<div class="regra-nums">Meta do mês batida ✅</div>';
  } else if (f.teto <= 0) {
    /* VERMELHO: o mês não fecha. O botão de separar SOME (não fica desabilitado). */
    card.className = 'card regra ruim';
    html += '<div class="regra-nums">' +
      (lp < 0
        ? 'Este mês fecha faltando ' + formatarMoeda(Math.abs(lp)) + '. Não dá pra guardar agora.'
        : (la <= 0
            ? 'Ainda não sobrou dinheiro livre pra separar ' + cartQuandoTxt(chave) + '.'
            : 'Não dá pra guardar agora.')) +
      '</div>';
  } else if (f.final < f.bruta) {
    /* ÂMBAR: cabe menos do que a meta dele. */
    card.className = 'card regra aviso';
    html += '<div class="regra-nums">Sua meta é ' + formatarMoeda(f.bruta) +
      ', mas só cabem ' + formatarMoeda(f.final) + ' ' + cartQuandoTxt(chave) + '.</div>';
    acoes.push('<button class="btn-mini" data-acao="separar">Separar ' + formatarMoeda(f.final) + '</button>');
  } else {
    /* VERDE: cabe tudo. */
    acoes.push('<button class="btn-mini" data-acao="separar">' +
      (sep > 0 ? 'Separar o resto — ' : 'Separar ') + formatarMoeda(f.final) + '</button>');
  }

  acoes.push('<button class="btn-mini ghost" data-acao="ajustar">Ajustar %</button>');
  if (cartTemSugestaoNoMes(chave)) {
    acoes.push('<button class="btn-mini ghost" data-acao="desfazer">Desfazer separação do mês</button>');
  }

  card.innerHTML = html + '<div class="regra-acoes">' + acoes.join('') + '</div>';
}

/* ---------- Lista de carteiras ---------- */
function cartRenderLista() {
  var lista = $('#list-carteiras');
  var ativas = cartAtivas();
  var arquivadas = cartArquivadas();

  if (!db.carteiras.length) {
    lista.innerHTML = '<div class="empty-state">Nenhuma carteira ainda.<br>Toque em <strong>+ Nova carteira</strong> pra criar a primeira 🐷</div>';
    return;
  }

  var html = '';

  ativas.forEach(function (w) {
    var saldo = saldoCarteira(w);
    var meta = (typeof w.meta === 'number' && w.meta > 0) ? w.meta : null;

    var sub = [];
    if (w.pct > 0) sub.push('sua meta: ' + w.pct + '%');
    if (meta) sub.push(formatarMoeda(saldo) + ' de ' + formatarMoeda(meta));

    var barra = '';
    if (meta) {
      var p = Math.max(0, Math.min(100, Math.round(saldo / meta * 100)));
      barra = '<div class="cart-bar"><span style="width:' + p + '%"></span></div>';
    }

    html +=
      '<div class="carteira" data-abrir="' + w.id + '">' +
        '<div class="cart-emoji">' + escapar(w.emoji || '🐷') + '</div>' +
        '<div class="cart-main">' +
          '<div class="cart-nome">' + escapar(w.nome) + '</div>' +
          '<div class="cart-pct">' + escapar(sub.join(' · ')) + '</div>' +
          barra +
        '</div>' +
        '<div class="cart-saldo">' + formatarMoeda(saldo) + '</div>' +
      '</div>' +
      '<div class="cart-acoes">' +
        '<button class="btn-mini ghost" data-guardar="' + w.id + '">+ Guardar</button>' +
        '<button class="btn-mini ghost" data-retirar="' + w.id + '">− Retirar</button>' +
      '</div>';
  });

  arquivadas.forEach(function (w) {
    html +=
      '<div class="carteira" data-abrir="' + w.id + '" style="opacity:.55">' +
        '<div class="cart-emoji">' + escapar(w.emoji || '🐷') + '</div>' +
        '<div class="cart-main">' +
          '<div class="cart-nome">' + escapar(w.nome) + '</div>' +
          '<div class="cart-pct">arquivada · fora do total</div>' +
        '</div>' +
        '<div class="cart-saldo">' + formatarMoeda(saldoCarteira(w)) + '</div>' +
      '</div>' +
      '<div class="cart-acoes">' +
        '<button class="btn-mini ghost" data-reativar="' + w.id + '">Reativar</button>' +
      '</div>';
  });

  lista.innerHTML = html;
}

/* =========================================================
   Folha da carteira (criar / editar / arquivar / excluir)
   ========================================================= */
function abrirCarteira(id) {
  carteiraEditandoId = id || null;
  var w = id ? cartAchar(id) : null;

  $('#carteira-title').textContent = w ? 'Editar carteira' : 'Nova carteira';
  $('#c-nome').value    = w ? (w.nome || '') : '';
  $('#c-emoji').value   = w ? (w.emoji || '🐷') : '🐷';
  $('#c-inicial').value = (w && w.saldoInicial) ? moedaCurta(w.saldoInicial) : '';
  /* Carteira nova nasce com pct 0 — o app nunca sugere um número. */
  $('#c-pct').value     = w ? (w.pct || 0) : 0;
  $('#c-meta').value    = (w && typeof w.meta === 'number' && w.meta > 0) ? moedaCurta(w.meta) : '';

  var del = $('#carteira-delete');
  if (!w || w.arquivada) {
    del.hidden = true;
  } else {
    del.hidden = false;
    del.textContent = cartZerada(w) ? 'Excluir carteira' : 'Arquivar carteira';
  }

  abrirOverlay('#overlay-carteira');
  setTimeout(function () { $('#c-nome').focus(); }, 250);
}

function salvarCarteira() {
  var nome = $('#c-nome').value.trim();
  if (!nome) { toast('Dá um nome pra ela 🙂'); $('#c-nome').focus(); return; }

  var emoji = $('#c-emoji').value.trim() || '🐷';
  var inicial = parseValor($('#c-inicial').value);

  var pct = parseInt($('#c-pct').value, 10);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  var meta = parseValor($('#c-meta').value);
  if (!(meta > 0)) meta = null;

  var w = carteiraEditandoId ? cartAchar(carteiraEditandoId) : null;
  var aviso = '';

  if (w) {
    /* Invariante: saldo de carteira nunca fica negativo. Baixar o "já tenho guardado"
       abaixo do que já foi retirado dela quebraria isso — então seguro o piso. */
    var piso = Math.max(0, r2(-separacoesDeCarteira(w.id)));
    if (inicial < piso) {
      inicial = piso;
      aviso = 'Ajustei pra ' + formatarMoeda(inicial) + ' — já saiu dinheiro dessa carteira';
    }
    w.nome = nome; w.emoji = emoji; w.saldoInicial = inicial; w.pct = pct; w.meta = meta;
  } else {
    db.carteiras.push({
      id: novoId(), nome: nome, emoji: emoji,
      saldoInicial: inicial, pct: pct, meta: meta, arquivada: false
    });
  }

  carteiraEditandoId = null;
  salvar();
  fecharOverlay('#overlay-carteira');
  render();

  if (aviso) toast(aviso);
  else if (pctTotal() > 100) toast('Suas metas somam mais de 100% do que entra 😅');
  else toast(w ? 'Carteira atualizada ✅' : 'Carteira criada 🐷');
}

/* Excluir só com saldo zero. Com saldo, oferece ARQUIVAR —
   assim ninguém fica na dúvida se o dinheiro sumiu ou voltou pro livre. */
function excluirCarteira() {
  var w = cartAchar(carteiraEditandoId);
  if (!w) { fecharOverlay('#overlay-carteira'); return; }

  if (!cartZerada(w)) {
    var saldo = saldoCarteira(w);
    if (!confirm('"' + w.nome + '" ainda tem ' + formatarMoeda(saldo) + '.\n\n' +
                 'Pra não bagunçar o histórico eu não apago ela cheia. Quer arquivar?\n' +
                 '(ela sai do total guardado e do rateio, mas o histórico fica)')) return;
    w.arquivada = true;
    carteiraEditandoId = null;
    salvar();
    fecharOverlay('#overlay-carteira');
    render();
    toast('Arquivada 📦 — o saldo dela saiu do total');
    return;
  }

  if (!confirm('Excluir a carteira "' + w.nome + '"?\n\nEla está zerada, então nada de dinheiro se perde.')) return;

  db.carteiras = db.carteiras.filter(function (x) { return x.id !== w.id; });

  /* Limpa referências órfãs: separações da carteira e desejos vinculados a ela. */
  Object.keys(db.meses).forEach(function (k) {
    var m = db.meses[k];
    m.separacoes = (m.separacoes || []).filter(function (s) { return s.carteiraId !== w.id; });
  });
  db.desejos.forEach(function (d) { if (d.carteiraId === w.id) d.carteiraId = null; });

  carteiraEditandoId = null;
  salvar();
  fecharOverlay('#overlay-carteira');
  render();
  toast('Carteira excluída 🗑️');
}

/* =========================================================
   Folha de mover (guardar / retirar)
   ========================================================= */
function cartAbrirMover(modo, carteiraId) {
  var ativas = cartAtivas();
  if (!ativas.length) {
    toast('Crie uma carteira primeiro 🐷');
    abrirCarteira(null);
    return;
  }

  moverModo = (modo === 'retirar') ? 'retirar' : 'guardar';

  var alvo = carteiraId && cartAchar(carteiraId) && !cartAchar(carteiraId).arquivada ? carteiraId : null;
  if (!alvo) alvo = cartUltimaUsada();
  if (!alvo || !cartAchar(alvo) || cartAchar(alvo).arquivada) alvo = ativas[0].id;
  moverCarteiraId = alvo;

  $('#m-valor').value = '';
  cartAtualizarMover();
  abrirOverlay('#overlay-mover');
  setTimeout(function () { $('#m-valor').focus(); }, 250);
}

function cartAtualizarMover() {
  var chave = cartMesAlvo();

  $('#mover-title').textContent = moverModo === 'retirar' ? 'Retirar da carteira' : 'Guardar dinheiro';

  document.querySelectorAll('.type-opt[data-mover]').forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.mover === moverModo);
  });

  $('#mover-carteiras').innerHTML = cartAtivas().map(function (w) {
    return '<button type="button" class="chip-cart' + (w.id === moverCarteiraId ? ' is-active' : '') +
      '" data-chip="' + w.id + '">' + escapar(w.emoji || '🐷') + ' ' + escapar(w.nome) + '</button>';
  }).join('');

  var w2 = cartAchar(moverCarteiraId);
  var linhas = [];
  if (moverModo === 'retirar') {
    linhas.push('Tem ' + formatarMoeda(saldoCarteira(w2)) + ' em ' + ((w2 && w2.nome) || 'carteira') + '. Não dá pra tirar mais que isso.');
  } else {
    var livre = livreProjetado(chave);
    linhas.push(livre > 0
      ? 'Sobram ' + formatarMoeda(livre) + ' livres ' + cartQuandoTxt(chave) + ' (já contando as contas que ainda vencem).'
      : 'Atenção: ' + cartQuandoTxt(chave) + ' não sobra nada livre. Você decide se guarda mesmo assim.');
  }
  linhas.push('Vai entrar em ' + cartNomeMes(chave) + ', no dia ' + diaDeHoje(chave) + '.');
  $('#mover-hint').textContent = linhas.join(' ');
}

function cartConfirmarMover() {
  var chave = cartMesAlvo();
  var pedido = parseValor($('#m-valor').value);
  if (!(pedido > 0)) { toast('Digita um valor 🙂'); $('#m-valor').focus(); return; }
  if (!cartAchar(moverCarteiraId)) { toast('Escolhe uma carteira 🙂'); return; }

  if (moverModo === 'retirar') {
    var v = retirarDaCarteira(chave, moverCarteiraId, pedido);
    if (v <= 0) return;                       // carteira zerada: a folha fica aberta
    fecharOverlay('#overlay-mover');
    render();
    if (v >= pedido - 0.005) toast('Retirado ↩️ — agora faz igual no banco');
  } else {
    guardarManual(chave, moverCarteiraId, pedido);
    fecharOverlay('#overlay-mover');
    render();
    toast('Guardado 🐷 — agora faz igual no banco');
  }
}

/* =========================================================
   Ações do card "Regra do mês"
   ========================================================= */
function cartSepararAgora() {
  var chave = cartMesAlvo();
  var f = faltaSeparar(chave);
  if (f.final <= 0) { toast('Não dá pra separar agora 🤷'); return; }
  aplicarSeparacao(chave, f.final, 'sugestao');
  render();
  toast('Separado 🐷 — agora faz igual no banco');
}

function cartDesfazerSeparacao() {
  var chave = cartMesAlvo();
  var m = db.meses[chave];
  if (!m) return;
  var antes = (m.separacoes || []).length;
  m.separacoes = (m.separacoes || []).filter(function (s) { return s.origem !== 'sugestao'; });
  if (antes === m.separacoes.length) { toast('Não tem separação automática neste mês'); return; }
  salvar();
  render();
  toast('Desfeito ↩️');
}

function cartAjustarPct() {
  var alvos = cartAlvos();
  if (alvos.length === 1) { abrirCarteira(alvos[0].id); return; }
  var ativas = cartAtivas();
  if (!alvos.length && ativas.length === 1) { abrirCarteira(ativas[0].id); return; }
  toast('Toque na carteira pra mudar a % dela');
  $('#list-carteiras').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* =========================================================
   6.11 — O GATILHO
   ========================================================= */
function podeSugerir(l) {
  if (!l || l.tipo !== 'entrada') return false;
  var m = db.meses[ym];
  return !!db.config.sugerirAoReceber
      && pctTotal() > 0
      && !l.orcado
      && l.valor >= (db.config.minimoEntradaSugestao || 0)
      && !(m && m.orcamentoSilenciado)
      && ym === ymAtualDoSistema()          // não pergunta em mês navegado
      && tetoSeparar(ym) > 0;               // mês vermelho: nem abre
}

function abrirSugestao(l) {
  if (!l) return;
  var chave = ym;
  var bruta = r2(l.valor * pctTotal() / 100);
  var final = r2(Math.min(bruta, tetoSeparar(chave)));
  if (final <= 0) return;                   // nada a sugerir: não incomoda

  sugestaoLancId = l.id;

  $('#sug-titulo').textContent = 'Caiu ' + formatarMoeda(l.valor);
  $('#sug-desc').textContent = (l.descricao || 'Entrada') +
    (l.dia ? ' · ' + String(l.dia).padStart(2, '0') + ' de ' + cartNomeMes(chave) : '');
  $('#sug-valor').textContent = formatarMoeda(final);

  var alvos = cartAlvos();
  var partes = ratearCentavos(Math.round(final * 100), alvos.map(function (w) { return w.pct; }));
  $('#sug-linhas').innerHTML = alvos.map(function (w, i) {
    if (partes[i] <= 0) return '';
    return '<div class="sug-linha"><span>' + escapar(w.emoji || '🐷') + ' ' + escapar(w.nome) +
      ' · ' + w.pct + '%</span><b>' + formatarMoeda(partes[i] / 100) + '</b></div>';
  }).join('');

  /* Rodapé SEMPRE em cima do livreProjetado — nunca "entrada − separação". */
  var sobra = Math.max(0, r2(livreProjetado(chave) - final));
  $('#sug-rodape').textContent = 'Separando isso, ainda sobram ' + formatarMoeda(sobra) +
    ' pra gastar ' + cartQuandoTxt(chave) + ' — já contando as contas que ainda vão vencer.';

  abrirOverlay('#overlay-sugestao');
}

function confirmarSugestao(l, valorEscolhido) {
  if (!l) { fecharOverlay('#overlay-sugestao'); return; }
  var chave = ym;
  aplicarSeparacao(chave, Math.min(valorEscolhido, tetoSeparar(chave)), 'sugestao');
  l.orcado = true;
  sugestaoLancId = null;
  salvar();
  fecharOverlay('#overlay-sugestao');
  render();
  toast('Separado 🐷 — agora faz igual no banco');
}

function silenciarMes() {
  garantirMes(ym);
  db.meses[ym].orcamentoSilenciado = true;
  var l = cartLancDaSugestao();
  if (l) l.orcado = true;
  sugestaoLancId = null;
  salvar();
  fecharOverlay('#overlay-sugestao');
  render();
  toast('Beleza, não falo mais nisso este mês 🤐');
}

/* Recupera o lançamento que abriu a folha, sem depender da ordem de carregamento. */
function cartLancDaSugestao() {
  if (!sugestaoLancId) return null;
  if (typeof acharLanc === 'function') {
    var achado = acharLanc(sugestaoLancId);
    if (achado) return achado;
  }
  var m = db.meses[ym];
  if (!m) return null;
  return m.lancamentos.filter(function (x) { return x.id === sugestaoLancId; })[0] || null;
}

/* Valor sugerido de novo, na hora de confirmar (o teto pode ter mudado). */
function cartValorSugerido(l) {
  var bruta = r2(l.valor * pctTotal() / 100);
  return r2(Math.min(bruta, tetoSeparar(ym)));
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventosCarteiras() {
  /* ---- Folha da carteira ---- */
  $('#carteira-save').addEventListener('click', salvarCarteira);
  $('#carteira-cancel').addEventListener('click', function () {
    carteiraEditandoId = null;
    fecharOverlay('#overlay-carteira');
  });
  $('#carteira-delete').addEventListener('click', excluirCarteira);
  $('#c-meta').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') salvarCarteira();
  });

  /* ---- Folha de mover ---- */
  document.querySelectorAll('.type-opt[data-mover]').forEach(function (b) {
    b.addEventListener('click', function () {
      moverModo = b.dataset.mover;
      cartAtualizarMover();
      $('#m-valor').focus();
    });
  });

  $('#mover-carteiras').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-chip]');
    if (!chip) return;
    moverCarteiraId = chip.dataset.chip;
    cartAtualizarMover();
  });

  $('#mover-save').addEventListener('click', cartConfirmarMover);
  $('#mover-cancel').addEventListener('click', function () { fecharOverlay('#overlay-mover'); });
  $('#m-valor').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') cartConfirmarMover();
  });

  /* ---- Card "Regra do mês" (botões são renderizados na hora) ---- */
  $('#card-regra').addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]');
    if (!b) return;
    var acao = b.dataset.acao;
    if (acao === 'separar')  cartSepararAgora();
    if (acao === 'ajustar')  cartAjustarPct();
    if (acao === 'desfazer') cartDesfazerSeparacao();
    if (acao === 'definir')  cartAjustarPct();
  });

  /* ---- Lista de carteiras ---- */
  $('#list-carteiras').addEventListener('click', function (e) {
    var g = e.target.closest('[data-guardar]');
    if (g) { cartAbrirMover('guardar', g.dataset.guardar); return; }

    var r = e.target.closest('[data-retirar]');
    if (r) { cartAbrirMover('retirar', r.dataset.retirar); return; }

    var v = e.target.closest('[data-reativar]');
    if (v) {
      var wr = cartAchar(v.dataset.reativar);
      if (wr) { wr.arquivada = false; salvar(); render(); toast('Carteira reativada 🐷'); }
      return;
    }

    var a = e.target.closest('[data-abrir]');
    if (a) abrirCarteira(a.dataset.abrir);
  });

  /* ---- Folha de sugestão (o gatilho) ---- */
  $('#sug-sim').addEventListener('click', function () {
    var l = cartLancDaSugestao();
    if (!l) { fecharOverlay('#overlay-sugestao'); return; }
    confirmarSugestao(l, cartValorSugerido(l));
  });

  $('#sug-nao').addEventListener('click', function () {
    var l = cartLancDaSugestao();
    if (l) l.orcado = true;                 // só marca que já perguntou
    sugestaoLancId = null;
    salvar();
    fecharOverlay('#overlay-sugestao');
    render();
  });

  $('#sug-silenciar').addEventListener('click', silenciarMes);
}
