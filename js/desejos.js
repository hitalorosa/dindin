/* =========================================================
   Planejador v2 — aba Desejos
   ---------------------------------------------------------
   REGRA DURA: este arquivo contém SOMENTE `function nome(){}`.
   Nenhum let/const/var em escopo de arquivo — todas as globais
   moram no app.js. (bug do commit c333d62)

   Desejo é INTENÇÃO, não compromisso: não mexe no mês até
   o [Comprei 🎉]. Aba atemporal — sempre calcula sobre o mês
   atual do sistema, nunca sobre o mês navegado.
   ========================================================= */

'use strict';

/* =========================================================
   Cálculo (blueprint 6.10 — copiado literal)
   ========================================================= */
function ritmoCarteira(w, chave) { return r2(rendaBaseMes(chave) * (w.pct || 0) / 100); }

function previsaoDesejo(d, chave) {
  var w     = db.carteiras.find(function (x) { return x.id === d.carteiraId; }) || null;
  var saldo = w ? saldoCarteira(w) : 0;
  var falta = Math.max(0, r2(d.valor - saldo));
  var pct   = Math.min(100, Math.round(saldo / d.valor * 100));
  var ritmo = w ? ritmoCarteira(w, chave) : Math.max(0, livreProjetado(chave));

  if (falta === 0)          return { falta: 0, meses: 0, ym: chave, pct: 100, ritmo: ritmo, saldo: saldo, w: w };
  if (!ritmo || ritmo <= 0) return { falta: falta, meses: null, ym: null, pct: pct, ritmo: 0, saldo: saldo, w: w };
  var meses = Math.ceil(falta / ritmo);
  return { falta: falta, meses: meses, ym: ymDeslocado(chave, meses), pct: pct, ritmo: ritmo, saldo: saldo, w: w };
}

/* Compra: saída no mês + resgate CLAMPADO da carteira vinculada.
   Invariante: saldoCarteira(w) >= 0 sempre. */
function comprarDesejo(d) {
  var chave = ymAtualDoSistema();
  garantirMes(chave);
  db.meses[chave].lancamentos.push({
    id: novoId(), fixoId: null, origem: 'desejo',
    descricao: d.nome, valor: d.valor, tipo: 'saida', categoria: 'Desejo',
    dia: Math.min(new Date().getDate(), diasNoMes(chave)), status: 'ok'
  });
  var w = db.carteiras.find(function (x) { return x.id === d.carteiraId; });
  if (w) {
    var resg = Math.min(d.valor, saldoCarteira(w));            // <-- CLAMP
    if (resg > 0) db.meses[chave].separacoes.push({
      id: novoId(), carteiraId: w.id, valor: -resg,
      dia: Math.min(new Date().getDate(), diasNoMes(chave)), origem: 'desejo'
    });
  }
  db.desejos = db.desejos.filter(function (x) { return x.id !== d.id; });   // comprou, some da lista
  salvar(); render();
}

/* =========================================================
   Helpers só deste módulo (prefixados pra não colidir)
   ========================================================= */

/* escapar() não escapa aspas — pra atributo isso é buraco. */
function desejoAttr(s) {
  return escapar(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Só http(s). Bloqueia javascript:, data:, etc. */
function desejoUrlSegura(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
}

/* Imagem: só URL https. Nunca base64/data-uri (estoura o localStorage). */
function desejoImgSegura(u) {
  return typeof u === 'string' && /^https:\/\//i.test(u.trim());
}

function desejoInicial(nome) {
  var s = (nome || '?').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}

/* Domínio derivado LOCALMENTE, sem rede. */
function desejoDominio(url) {
  if (!desejoUrlSegura(url)) return '';
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, '');
  } catch (e) {
    return '';
  }
}

/* pct sempre 0..100 e nunca NaN/Infinity na tela. */
function desejoPctSeguro(p) {
  var n = Number(p);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* Frase de previsão. NUNCA "Infinity meses". */
function desejoFrasePrevisao(d, p) {
  if (!p.w) return '';
  // não mostra "R$ 1.400 de R$ 1.290": o que passou do preço não conta pra esse desejo
  var base = formatarMoeda(Math.min(p.saldo, d.valor)) + ' de ' + formatarMoeda(d.valor);
  if (p.meses === 0)    return base + ' · dá pra comprar 🎉';
  if (p.meses === null) return base + ' · sem ritmo definido';
  return base + ' · ~' + p.meses + (p.meses === 1 ? ' mês' : ' meses') +
         (p.ym ? ' (' + rotuloMesCurto(p.ym) + ')' : '');
}

/* Imagem quebrou (offline, hotlink bloqueado, link morto) —
   vira gradiente com a inicial. É o caso COMUM, tem que ficar bonito. */
function desejoFalhouImagem(el, hero) {
  var pai = el.parentNode;
  if (!pai) return;
  var div = document.createElement('div');
  div.className = hero ? 'dsj-hero-img dsj-fallback' : 'dsj-fallback';
  div.textContent = el.getAttribute('data-inicial') || '?';
  pai.replaceChild(div, el);
}

/* .ds-preview tem display:flex no CSS, que vence o [hidden] do navegador.
   Então o hide precisa ser explícito. */
function desejoMostrarPreview(mostrar) {
  var el = $('#ds-preview');
  el.hidden = !mostrar;
  el.style.display = mostrar ? 'flex' : 'none';
}

function desejoAchar(id) {
  return db.desejos.find(function (x) { return x.id === id; }) || null;
}

/* =========================================================
   Render da aba
   ========================================================= */
function renderDesejos() {
  var head = $('#desejos-head');
  var grid = $('#grid-desejos');
  var lista = db.desejos || [];

  if (!lista.length) {
    head.innerHTML = '';
    grid.innerHTML =
      '<div class="empty-state" style="grid-column:1/-1">' +
        'Nada na lista ainda ✨<br>' +
        'Cole aqui o link daquilo que você tá de olho — eu te digo quando dá pra comprar.' +
      '</div>';
    return;
  }

  var total = r2(lista.reduce(function (s, d) { return s + (Number(d.valor) || 0); }, 0));
  head.innerHTML =
    '<span>' + lista.length + (lista.length === 1 ? ' desejo' : ' desejos') + '</span>' +
    '<strong>' + escapar(formatarMoeda(total)) + '</strong>';

  grid.innerHTML = lista.map(cardDesejo).join('');
}

function cardDesejo(d) {
  var chave = ymAtualDoSistema();
  var ini   = desejoInicial(d.nome);
  var capa;

  if (desejoImgSegura(d.img)) {
    capa = '<img src="' + desejoAttr(d.img.trim()) + '" alt="" loading="lazy" ' +
           'referrerpolicy="no-referrer" data-inicial="' + desejoAttr(ini) + '" ' +
           'onerror="desejoFalhouImagem(this)">';
  } else {
    capa = '<div class="dsj-fallback">' + escapar(ini) + '</div>';
  }

  var dom = desejoDominio(d.url);
  var rodape = '';

  if (d.carteiraId) {
    var p = previsaoDesejo(d, chave);
    if (p.w) {
      var pct = desejoPctSeguro(p.pct);
      rodape =
        '<div class="dsj-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="dsj-prev">' + escapar(desejoFrasePrevisao(d, p)) + '</div>';
    }
  }

  return '' +
    '<article class="desejo-card" data-id="' + desejoAttr(d.id) + '">' +
      '<div class="dsj-img">' + capa +
        '<span class="dsj-preco">' + escapar(formatarMoeda(d.valor)) + '</span>' +
      '</div>' +
      '<div class="dsj-body">' +
        '<div class="dsj-nome">' + escapar(d.nome) + '</div>' +
        (dom ? '<div class="dsj-dominio">' + escapar(dom) + '</div>' : '') +
        rodape +
      '</div>' +
    '</article>';
}

/* =========================================================
   Folha: novo / editar desejo
   ========================================================= */
function abrirDesejo(id) {
  var d = id ? desejoAchar(id) : null;
  desejoEditandoId = d ? d.id : null;

  $('#desejo-title').textContent = d ? 'Editar desejo' : 'Novo desejo';
  $('#ds-url').value    = d && d.url ? d.url : '';
  $('#ds-nome').value   = d ? (d.nome || '') : '';
  $('#ds-valor').value  = d && d.valor ? moedaCurta(d.valor) : '';
  $('#ds-status').textContent = '';
  $('#ds-url').dataset.buscado = d && d.url ? d.url : '';

  // A imagem viaja no dataset — nada de variável de arquivo.
  $('#ds-preview').dataset.img = d && desejoImgSegura(d.img) ? d.img : '';
  desejoPintarPreview(d ? d.nome : '', d && desejoImgSegura(d.img) ? d.img : '');

  desejoPopularCarteiras(d);
  $('#desejo-delete').hidden = !d;

  abrirOverlay('#overlay-desejo');
  if (!d) setTimeout(function () { $('#ds-url').focus(); }, 250);
}

function desejoPopularCarteiras(d) {
  var sel = $('#ds-carteira');
  var atual = d ? (d.carteiraId || '') : '';
  var html = '<option value="">— sem carteira —</option>';
  var achou = false;

  db.carteiras.forEach(function (w) {
    if (w.arquivada && w.id !== atual) return;
    if (w.id === atual) achou = true;
    html += '<option value="' + desejoAttr(w.id) + '">' +
            escapar((w.emoji || '🐷') + ' ' + w.nome + (w.pct > 0 ? ' (' + w.pct + '%)' : '')) +
            '</option>';
  });

  sel.innerHTML = html;
  sel.value = achou ? atual : '';
}

/* Bloquinho de prévia dentro da folha (imagem + título). */
function desejoPintarPreview(nome, img) {
  var el = $('#ds-preview');
  if (!desejoImgSegura(img)) { el.innerHTML = ''; desejoMostrarPreview(false); return; }
  el.innerHTML =
    '<img src="' + desejoAttr(img.trim()) + '" alt="" referrerpolicy="no-referrer" ' +
    'data-inicial="' + desejoAttr(desejoInicial(nome)) + '" onerror="desejoFalhouImagem(this)">' +
    '<div>' + escapar(nome || 'Prévia do link') + '</div>';
  desejoMostrarPreview(true);
}

/* =========================================================
   Microlink — conteúdo de TERCEIRO.
   Nunca vira HTML, timeout de 6s, falha silenciosa.
   O PREÇO NUNCA vem daqui: número errado = compra errada.
   ========================================================= */
function buscarPreviaLink(url) {
  var status = $('#ds-status');
  var alvo = (url || '').trim();

  if (!db.config.buscarPreviaLinks) return;      // ele desligou no menu: zero requisição
  if (!desejoUrlSegura(alvo)) return;
  if (!navigator.onLine) return;
  if ($('#ds-url').dataset.buscado === alvo) return;   // já buscou esse link
  $('#ds-url').dataset.buscado = alvo;

  status.innerHTML = '<span class="spin"></span>Buscando a prévia…';

  var ctrl = new AbortController();
  var relogio = setTimeout(function () { ctrl.abort(); }, 6000);

  function desistir() {
    clearTimeout(relogio);
    if ($('#ds-url').value.trim() === alvo) status.textContent = '';
  }

  fetch('https://api.microlink.io/?url=' + encodeURIComponent(alvo) + '&screenshot=false',
        { signal: ctrl.signal })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      clearTimeout(relogio);
      // resposta velha de um link que ele já trocou: ignora
      if ($('#overlay-desejo').hidden) return;
      if ($('#ds-url').value.trim() !== alvo) return;
      if (!j || j.status !== 'success' || !j.data) { status.textContent = ''; return; }

      var titulo = typeof j.data.title === 'string' ? j.data.title.trim().slice(0, 120) : '';
      var img = j.data.image && typeof j.data.image.url === 'string' ? j.data.image.url : '';

      // .value nunca é HTML, e só preenche se ele ainda não escreveu nada
      if (titulo && !$('#ds-nome').value.trim()) $('#ds-nome').value = titulo;

      if (desejoImgSegura(img)) {
        $('#ds-preview').dataset.img = img.trim();
        desejoPintarPreview($('#ds-nome').value || titulo, img.trim());
      }

      status.textContent = (titulo || desejoImgSegura(img))
        ? 'Peguei o que deu 👌 confira o nome e digite o preço.'
        : '';
    })
    .catch(desistir);
}

/* =========================================================
   Salvar / excluir
   ========================================================= */
function salvarDesejo() {
  var nome  = $('#ds-nome').value.trim();
  var valor = parseValor($('#ds-valor').value);
  var url   = $('#ds-url').value.trim();
  var img   = $('#ds-preview').dataset.img || '';

  if (!nome)      { toast('Me diz o que é 🙂'); $('#ds-nome').focus(); return; }
  if (valor <= 0) { toast('Falta o preço — esse eu não chuto'); $('#ds-valor').focus(); return; }

  var d = desejoEditandoId ? desejoAchar(desejoEditandoId) : null;
  var novo = !d;
  if (novo) d = { id: novoId(), criadoEm: hojeISO() };

  d.nome       = nome;
  d.valor      = r2(valor);
  d.url        = desejoUrlSegura(url) ? url : '';
  d.img        = desejoImgSegura(img) ? img.trim() : '';
  d.dominio    = desejoDominio(d.url);
  d.carteiraId = $('#ds-carteira').value || null;

  if (novo) db.desejos.push(d);

  desejoEditandoId = null;
  salvar(); render();
  fecharOverlay('#overlay-desejo');
  toast(novo ? 'Anotado ✨' : 'Atualizado ✅');
}

function excluirDesejo(id) {
  var d = desejoAchar(id);
  if (!d) return;
  if (!confirm('Tirar "' + d.nome + '" da lista?')) return;
  db.desejos = db.desejos.filter(function (x) { return x.id !== id; });
  desejoEditandoId = null;
  desejoVendoId = null;
  salvar(); render();
  fecharTodosOverlays();
  toast('Tirei da lista');
}

/* =========================================================
   Folha: detalhe do desejo
   ========================================================= */
function desejoAbrirDetalhe(id) {
  var d = desejoAchar(id);
  if (!d) return;
  desejoVendoId = d.id;

  var chave = ymAtualDoSistema();
  var ini   = desejoInicial(d.nome);
  var capa;

  if (desejoImgSegura(d.img)) {
    capa = '<img class="dsj-hero-img" src="' + desejoAttr(d.img.trim()) + '" alt="" ' +
           'referrerpolicy="no-referrer" data-inicial="' + desejoAttr(ini) + '" ' +
           'onerror="desejoFalhouImagem(this,1)">';
  } else {
    capa = '<div class="dsj-hero-img dsj-fallback">' + escapar(ini) + '</div>';
  }

  var dom = desejoDominio(d.url);
  var corpo = capa +
    '<h3 class="sheet-title">' + escapar(d.nome) + '</h3>' +
    '<div class="hero-value" style="font-size:30px;margin-bottom:6px">' +
      escapar(formatarMoeda(d.valor)) + '</div>' +
    (dom ? '<div class="dsj-dominio" style="margin-bottom:14px">' + escapar(dom) + '</div>' : '');

  if (d.carteiraId) {
    var p = previsaoDesejo(d, chave);
    if (p.w) {
      var pct = desejoPctSeguro(p.pct);
      corpo +=
        '<div class="dsj-bar" style="height:8px"><span style="width:' + pct + '%"></span></div>' +
        '<div class="dsj-prev" style="margin-top:8px;font-size:13px">' +
          escapar('Juntando em ' + (p.w.emoji || '🐷') + ' ' + p.w.nome + ' · ' +
                  desejoFrasePrevisao(d, p)) +
        '</div>';
      if (p.meses === null) {
        corpo += '<button class="btn-link" data-acao="definir-pct">' +
                 'Definir a % dessa carteira pra eu calcular o prazo</button>';
      }
    } else {
      corpo += '<div class="dsj-prev">A carteira desse desejo não existe mais 🤷</div>';
    }
  } else {
    corpo += '<div class="dsj-prev">Sem carteira vinculada — vincule uma no Editar pra eu ' +
             'mostrar quanto falta e quando dá.</div>';
  }

  $('#dv-corpo').innerHTML = corpo;
  $('#dv-abrir').hidden = !desejoUrlSegura(d.url);
  abrirOverlay('#overlay-desejo-ver');
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventosDesejos() {
  /* Grid: tocar no card abre o detalhe */
  $('#grid-desejos').addEventListener('click', function (e) {
    var card = e.target.closest('.desejo-card');
    if (card) desejoAbrirDetalhe(card.dataset.id);
  });

  /* --- Folha novo/editar --- */
  $('#desejo-cancel').addEventListener('click', function () {
    desejoEditandoId = null;
    fecharOverlay('#overlay-desejo');
  });
  $('#desejo-save').addEventListener('click', salvarDesejo);
  $('#desejo-delete').addEventListener('click', function () {
    if (desejoEditandoId) excluirDesejo(desejoEditandoId);
  });

  /* Colou o link -> busca sozinho (se ele não desligou no menu) */
  $('#ds-url').addEventListener('paste', function () {
    setTimeout(function () { buscarPreviaLink($('#ds-url').value); }, 0);
  });
  $('#ds-url').addEventListener('change', function () { buscarPreviaLink($('#ds-url').value); });
  $('#ds-url').addEventListener('blur',   function () { buscarPreviaLink($('#ds-url').value); });

  /* --- Folha detalhe --- */
  $('#dv-fechar').addEventListener('click', function () {
    desejoVendoId = null;
    fecharOverlay('#overlay-desejo-ver');
  });

  $('#dv-editar').addEventListener('click', function () {
    var id = desejoVendoId;
    desejoVendoId = null;
    fecharOverlay('#overlay-desejo-ver');
    if (id) abrirDesejo(id);
  });

  $('#dv-abrir').addEventListener('click', function () {
    var d = desejoAchar(desejoVendoId);
    if (d && desejoUrlSegura(d.url)) window.open(d.url, '_blank', 'noopener,noreferrer');
  });

  $('#dv-comprei').addEventListener('click', function () {
    var d = desejoAchar(desejoVendoId);
    if (!d) return;
    if (!confirm('Comprei "' + d.nome + '" por ' + formatarMoeda(d.valor) + '?\n\n' +
                 'Vou lançar como saída de hoje e tirar da carteira o que der.')) return;
    desejoVendoId = null;
    fecharOverlay('#overlay-desejo-ver');
    comprarDesejo(d);
    toast('Comprado 🎉 lancei no mês');
  });

  /* Atalho "definir %" quando a carteira não tem ritmo */
  $('#dv-corpo').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-acao="definir-pct"]');
    if (!btn) return;
    var d = desejoAchar(desejoVendoId);
    if (!d) return;
    desejoVendoId = null;
    fecharOverlay('#overlay-desejo-ver');
    abrirCarteira(d.carteiraId);
  });
}
