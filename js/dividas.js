/* =========================================================
   Planejador v2 — aba Dívidas
   ---------------------------------------------------------
   REGRA DURA: este arquivo contém SOMENTE `function nome(){}`.
   Nenhum let/const/var em escopo de arquivo — todas as globais
   moram no app.js. (Redeclarar global = SyntaxError silencioso.)

   Modelagem: NÃO existe db.dividas. Dívida = um `fixo` com
   `parcelas: N`. A parcela é materializada pelo mesmo mecanismo
   dos fixos e a dívida some sozinha na última parcela.

   Aqui só tem aritmética. Zero juros, zero ranking de prioridade,
   zero conselho de investimento.
   ========================================================= */

'use strict';

/* =========================================================
   6.2 — Materialização (chamadas de dentro de garantirMes)
   ========================================================= */
function ehDivida(f) {
  return !!(f && f.parcelas && f.parcelas > 0);
}

function parcelaNoMes(f, chave) {
  if (!f || !f.desde) return 1;               // sem 'desde' não dá pra contar: trata como a 1ª
  return mesesEntre(f.desde, chave) + 1;
}

/* =========================================================
   6.3 — Derivações
   ========================================================= */

/* Híbrido calendário + check DO MÊS CORRENTE APENAS.
   Calendário: não congela se ele pular meses.
   Check só do mês de hoje: não pula ao navegar pro futuro. */
function parcelasPagas(f) {
  if (!ehDivida(f) || !f.desde) return 0;
  var hoje = ymAtualDoSistema();
  var base = Math.min(Math.max(mesesEntre(f.desde, hoje), 0), f.parcelas);
  var mes = db.meses[hoje];
  var okAgora = (mes && mes.lancamentos.some(function (l) {
    return l.fixoId === f.id && l.status === 'ok';
  })) ? 1 : 0;
  return Math.min(base + okAgora, f.parcelas);
}

function parcelasRestantes(f) {
  if (!ehDivida(f)) return 0;
  return Math.max(0, f.parcelas - parcelasPagas(f));
}

function saldoDevedorNominal(f) {
  return r2(parcelasRestantes(f) * (f.valor || 0));
}

function ultimaParcelaYm(f) {
  if (!ehDivida(f) || !f.desde) return null;
  return ymDeslocado(f.desde, f.parcelas - 1);
}

function dividasAtivas() {
  return db.fixos.filter(function (f) {
    return ehDivida(f) && parcelasRestantes(f) > 0;
  });
}

/* O valor do banco vence — mas AUTO-INVALIDA quando o nº de parcelas muda.
   Sem isso o valor congela e mente (erro de +R$ 1.023 no exemplo do painel). */
function quitacaoValida(f) {
  var q = f && f.quitacaoInformada;
  if (!q || typeof q.valor !== 'number' || !isFinite(q.valor)) return null;
  if (q.restantes !== parcelasRestantes(f)) return null;
  return q.valor;
}

function custoQuitar(f) {
  var q = quitacaoValida(f);
  return q != null ? q : saldoDevedorNominal(f);
}

function custoQuitarTudo() {
  return r2(dividasAtivas().reduce(function (s, f) { return s + custoQuitar(f); }, 0));
}

function alivioMensal() {
  return r2(dividasAtivas().reduce(function (s, f) { return s + (f.valor || 0); }, 0));
}

/* =========================================================
   6.4 — Payoff: UM modelo dos dois lados
   ========================================================= */

/* Simula mês a mês. Com extra = 0 devolve EXATAMENTE o baseline.
   (A 10x100 + B 1x1000 devolve 10, não 2.) */
function mesesParaQuitar(extra) {
  var ds = dividasAtivas().map(function (f) {
    return { v: f.valor || 0, saldo: custoQuitar(f) };
  });
  var m = 0;
  while (ds.some(function (d) { return d.saldo > 0.005; }) && m < 600) {
    m++;
    ds.forEach(function (d) { if (d.saldo > 0) d.saldo = Math.max(0, d.saldo - d.v); });
    var e = extra;
    if (e > 0) {
      // bola de neve: menor saldo primeiro
      var at = ds.filter(function (d) { return d.saldo > 0; })
                 .sort(function (a, b) { return a.saldo - b.saldo; });
      for (var i = 0; i < at.length; i++) {
        var p = Math.min(e, at[i].saldo);
        at[i].saldo -= p;
        e -= p;
        if (e <= 0) break;
      }
    }
  }
  return m;
}

function ymLivre() {
  var n = mesesParaQuitar(0);
  return n > 0 ? ymDeslocado(ymAtualDoSistema(), n - 1) : null;
}

/* =========================================================
   6.5 — "Se eu pagasse tudo agora, quanto me sobraria?"
   ========================================================= */

/* Parcelas de dívida que ainda vão sair este mês — JÁ estão dentro
   de custoQuitarTudo(). Descontar de novo seria contagem dupla. */
function aPagarDeDividas(chave) {
  var m = db.meses[chave];
  if (!m) return 0;
  var ids = Object.create(null);
  dividasAtivas().forEach(function (f) { ids[f.id] = true; });
  return r2(m.lancamentos.filter(function (l) {
    return l.tipo === 'saida' && l.status !== 'ok' && l.fixoId && ids[l.fixoId];
  }).reduce(function (s, l) { return s + l.valor; }, 0));
}

function simularQuitacao() {
  var hoje = ymAtualDoSistema();
  var c = calcular(hoje);
  var guardado = (db.config.usarGuardadoNaQuitacao && typeof totalGuardado === 'function')
    ? totalGuardado() : 0;
  var caixa = r2((db.config.caixaHoje || 0) + guardado);
  var custo = custoQuitarTudo();
  var outras = r2(c.aPagar - aPagarDeDividas(hoje));   // contas do mês que NÃO são parcela
  return {
    caixa: caixa,
    custo: custo,
    outras: outras,
    sobra: r2(caixa - custo - outras),
    aindaEntra: c.aReceber,
    alivio: alivioMensal(),
    livreEm: ymLivre()
  };
}

/* =========================================================
   Helpers só desta aba (prefixados pra não colidir)
   ========================================================= */
function dividasMoeda(v) {
  return formatarMoeda(isFinite(v) ? v : 0);
}

function dividasTextoMeses(n) {
  if (!isFinite(n) || n <= 0) return 'agora';
  return n === 1 ? '~1 mês' : '~' + n + ' meses';
}

function dividasUltimaGlobal() {
  var ultima = null;
  dividasAtivas().forEach(function (f) {
    var u = ultimaParcelaYm(f);
    if (u && (!ultima || u > ultima)) ultima = u;
  });
  return ultima;
}

/* Barra de tracinhos: 1 tracinho por parcela, com teto de 24 pra não virar risca. */
function dividasTicks(f) {
  var total = f.parcelas || 0;
  if (total <= 0) return '';
  var n = Math.min(total, 24);
  var cheios = Math.round(parcelasPagas(f) / total * n);
  var h = '';
  for (var i = 0; i < n; i++) h += '<i class="' + (i < cheios ? 'on' : '') + '"></i>';
  return '<div class="dv-ticks">' + h + '</div>';
}

function dividasResincronizar(fixoId) {
  // apaga as instâncias NÃO pagas do mês atual em diante e remonta o mês atual
  var hoje = ymAtualDoSistema();
  limparFixoDosMesesFuturos(fixoId, ymDeslocado(hoje, -1));
  garantirMes(hoje);
}

function dividasEditarCaixa() {
  pedirValor(
    'Quanto você tem livre hoje?',
    'Dinheiro LIVRE na conta, SEM contar o que você já separou nas carteiras.',
    'Tenho hoje (R$)',
    db.config.caixaHoje || 0,
    function (v) {
      db.config.caixaHoje = r2(v);
      db.config.caixaHojeEm = hojeISO();
      salvar();
      render();
    }
  );
}

/* =========================================================
   Render da aba
   ========================================================= */
/* =========================================================
   Contas fixas — recorrentes de saída SEM fim (parcelas: null).
   Não são dívida: não têm saldo devedor nem data de quitação.
   Mas são compromisso mensal, então moram aqui embaixo das dívidas.
   ========================================================= */
function contasFixas() {
  return db.fixos.filter(function (f) {
    return f && f.tipo === 'saida' && !ehDivida(f);
  });
}

function totalContasFixas() {
  return r2(contasFixas().reduce(function (s, f) { return s + (f.valor || 0); }, 0));
}

/* Tudo que sai todo mês sem você decidir: contas fixas + parcelas de dívida. */
function compromissoMensal() {
  return r2(totalContasFixas() + alivioMensal());
}

function renderContasFixas() {
  var fixas = contasFixas();
  var grupo = $('#grupo-fixas');

  if (!fixas.length) {
    grupo.hidden = true;
    $('#list-fixas').innerHTML = '';
    $('#card-compromisso').innerHTML = '';
    return;
  }

  var totalFixas = totalContasFixas();
  $('#fixas-total').textContent = dividasMoeda(totalFixas);

  var itens = fixas.slice().sort(function (a, b) {
    return (a.dia || 99) - (b.dia || 99);
  });

  $('#list-fixas').innerHTML = itens.map(function (f) {
    var dia = f.dia
      ? '<div class="item-day"><span class="d-num">' + f.dia + '</span><span class="d-lbl">dia</span></div>'
      : '<div class="item-day empty"><span class="d-num">·</span></div>';
    var tag = f.categoria
      ? '<div class="item-meta"><span class="item-tag">' + escapar(f.categoria) + '</span></div>'
      : '';
    return '<div class="item">' + dia +
      '<div class="item-main">' +
        '<div class="item-desc">' + escapar(f.descricao) + '</div>' + tag +
      '</div>' +
      '<div class="item-value out">− ' + escapar(moedaCurta(f.valor)) + '</div>' +
    '</div>';
  }).join('');

  /* Fecha a conta: o quanto do mês já está comprometido antes de qualquer escolha. */
  var parcelas = alivioMensal();
  var total = compromissoMensal();
  var linhas = '<div class="comp-linha"><span>🔁 Contas fixas</span><b>' + dividasMoeda(totalFixas) + '</b></div>';
  if (parcelas > 0) {
    linhas += '<div class="comp-linha"><span>🧾 Parcelas de dívida</span><b>' + dividasMoeda(parcelas) + '</b></div>';
  }
  linhas += '<div class="comp-linha total"><span>Comprometido todo mês</span><b>' + dividasMoeda(total) + '</b></div>';

  $('#card-compromisso').innerHTML = linhas +
    '<div class="aviso-desconto">Sai todo mês sem você precisar decidir nada. ' +
    'Pra criar ou tirar uma conta fixa, use a aba Mês marcando “repetir todo mês”.</div>';

  grupo.hidden = false;
}

function renderDividas() {
  var ativas = dividasAtivas();

  renderContasFixas();

  /* ---------- Hero ---------- */
  if (!ativas.length) {
    $('#d-total').textContent = dividasMoeda(0);
    $('#d-total').className = 'hero-value';
    $('#d-sub').textContent = 'Nenhuma dívida 🎉';
    $('#d-progress').hidden = true;
    $('#card-quitar').hidden = true;
    $('#card-acelerar').hidden = true;
    $('#grupo-dividas').hidden = true;
    $('#list-dividas').innerHTML = '';
    return;
  }

  var total = custoQuitarTudo();
  var ultima = dividasUltimaGlobal();

  $('#d-total').textContent = dividasMoeda(total);
  $('#d-total').className = 'hero-value neg';

  var partes = [];
  partes.push(ativas.length === 1 ? '1 dívida' : ativas.length + ' dívidas');
  partes.push(dividasMoeda(alivioMensal()) + ' por mês');
  if (ultima) partes.push('última parcela em ' + rotuloMes(ultima));
  $('#d-sub').textContent = partes.join(' · ');

  /* Barra global: quanto do nominal já foi pago */
  var pago = 0, nominal = 0;
  ativas.forEach(function (f) {
    pago += parcelasPagas(f) * (f.valor || 0);
    nominal += (f.parcelas || 0) * (f.valor || 0);
  });
  var pct = nominal > 0 ? Math.round(pago / nominal * 100) : 0;
  if (!isFinite(pct)) pct = 0;
  pct = Math.max(0, Math.min(100, pct));
  $('#d-progress').hidden = false;
  $('#d-pct').textContent = pct + '%';
  $('#d-fill').style.width = pct + '%';

  renderDividasQuitar();
  renderDividasAcelerar();
  renderDividasLista();
}

/* ---------- Card "Se eu quitasse tudo agora" ---------- */
function renderDividasQuitar() {
  var s = simularQuitacao();
  var guardado = (typeof totalGuardado === 'function') ? totalGuardado() : 0;
  var dias = diasDesde(db.config.caixaHojeEm);

  var carimbo;
  if (dias == null) carimbo = 'toque pra preencher';
  else if (dias === 0) carimbo = 'atualizado hoje';
  else if (dias === 1) carimbo = 'atualizado ontem';
  else carimbo = 'atualizado há ' + dias + ' dias';
  var velho = (dias != null && dias >= 7) ? ' velho' : '';

  var h = '';
  h += '<div class="regra-titulo">Se eu quitasse tudo agora</div>';

  h += '<div class="q-linha" id="q-caixa" role="button" tabindex="0">' +
         '<span>Tenho livre na conta hoje' +
           '<br><span class="q-stamp' + velho + '">' + escapar(carimbo) + '</span>' +
         '</span>' +
         '<span class="q-val">' + dividasMoeda(db.config.caixaHoje || 0) + ' ✏️</span>' +
       '</div>';

  h += '<div class="field-hint">dinheiro LIVRE na conta, SEM contar o que você já separou</div>';

  if (guardado > 0) {
    h += '<label class="switch-row">' +
           '<input type="checkbox" id="q-usar-guardado"' +
             (db.config.usarGuardadoNaQuitacao ? ' checked' : '') + '>' +
           '<span>Usar também o que está guardado (+' + dividasMoeda(guardado) + ')</span>' +
         '</label>';
  }

  var positivo = s.sobra >= 0;
  h += '<div class="q-resultado">' +
         '<div class="q-res-label">' + (positivo ? 'Sobrariam' : 'Faltariam') + '</div>' +
         '<div class="q-res-valor ' + (positivo ? 'pos' : 'neg') + '">' +
            dividasMoeda(Math.abs(s.sobra)) +
         '</div>';

  var sub = [];
  sub.push('quitando ' + (dividasAtivas().length === 1 ? 'a sua dívida' : 'as suas dívidas') +
           ': ' + dividasMoeda(s.custo));
  if (s.outras > 0) sub.push('já descontando ' + dividasMoeda(s.outras) + ' de contas do mês');
  if (s.aindaEntra > 0) sub.push('e ainda entram ' + dividasMoeda(s.aindaEntra) + ' este mês');
  if (s.alivio > 0) sub.push('liberaria ' + dividasMoeda(s.alivio) + ' por mês');
  if (!positivo) sub.push('dá pra quitar uma de cada vez — toque na dívida pra ver');

  h += '<div class="q-res-sub">' + escapar(sub.join(' · ')) + '</div>';
  h += '</div>';

  h += '<div class="aviso-desconto">seu banco pode dar desconto pra antecipar — confirme o valor com ele</div>';

  $('#card-quitar').innerHTML = h;
  $('#card-quitar').hidden = false;
}

/* ---------- Card "Acelerar" ---------- */
function renderDividasAcelerar() {
  if (extraAcelerar < 0 || !isFinite(extraAcelerar)) extraAcelerar = 0;

  var base = mesesParaQuitar(0);
  var com = mesesParaQuitar(extraAcelerar);
  var hoje = ymAtualDoSistema();

  var h = '';
  h += '<div class="regra-titulo">Acelerar</div>';
  h += '<div class="stepper">' +
         '<button type="button" data-passo="-100" aria-label="Menos 100">−</button>' +
         '<span class="step-val">' + dividasMoeda(extraAcelerar) + '</span>' +
         '<button type="button" data-passo="100" aria-label="Mais 100">+</button>' +
       '</div>';

  if (extraAcelerar <= 0) {
    h += '<div class="plano-txt">Do jeito que está, a última parcela cai em <strong>' +
         escapar(dividasTextoMeses(base)) + '</strong>' +
         (base > 0 ? ' (' + escapar(rotuloMes(ymDeslocado(hoje, base - 1))) + ')' : '') +
         '.</div>';
    h += '<div class="regra-nums">Toque no + pra ver o que acontece se sobrar dinheiro no mês.</div>';
  } else {
    h += '<div class="plano-txt">Pagando <strong>' + dividasMoeda(extraAcelerar) +
         '</strong> a mais por mês → última parcela em <strong>' +
         escapar(dividasTextoMeses(com)) + '</strong>, em vez de ' +
         escapar(dividasTextoMeses(base)) + '.</div>';
    if (com > 0) {
      h += '<div class="regra-nums">Ficaria livre em ' +
           escapar(rotuloMes(ymDeslocado(hoje, com - 1))) + '.</div>';
    }
  }

  $('#card-acelerar').innerHTML = h;
  $('#card-acelerar').hidden = false;
}

/* ---------- Lista de dívidas ---------- */
function renderDividasLista() {
  var ativas = dividasAtivas();
  var h = '';
  var temNominal = false;

  ativas.forEach(function (f) {
    var restam = parcelasRestantes(f);
    var banco = quitacaoValida(f);
    if (banco == null) temNominal = true;

    var rotulo = banco != null ? 'Pra quitar (o banco passou)' : 'Pagando até o fim';
    var badge = banco != null ? '🔒' : '📐';
    var ultima = ultimaParcelaYm(f);

    h += '<div class="divida-item" data-id="' + escapar(f.id) + '">' +
           '<div class="dv-top">' +
             '<span class="dv-nome">' + escapar(f.descricao || 'Dívida') + '</span>' +
             '<span class="dv-falta">faltam ' + restam + ' × ' + dividasMoeda(f.valor) + '</span>' +
           '</div>' +
           dividasTicks(f) +
           '<div class="dv-nums">' +
             '<span>' + rotulo + ' <span class="badge">' + badge + '</span></span>' +
             '<span class="dv-total">' + dividasMoeda(custoQuitar(f)) + '</span>' +
           '</div>' +
           '<div class="dv-falta">' +
             (ultima ? 'última parcela em ' + escapar(rotuloMes(ultima)) : 'sem data definida') +
             ' · parcela ' + Math.min(parcelasPagas(f) + 1, f.parcelas) + ' de ' + f.parcelas +
           '</div>' +
         '</div>';
  });

  if (temNominal) {
    h += '<div class="aviso-desconto">📐 é a soma das parcelas que faltam, não o valor de quitação. ' +
         'Seu banco pode dar desconto pra antecipar — confirme com ele e toque na dívida pra registrar.</div>';
  }

  $('#list-dividas').innerHTML = h;
  $('#grupo-dividas').hidden = false;
}

/* =========================================================
   Folha: nova / editar dívida
   ========================================================= */
function abrirDivida(id) {
  dividaEditandoId = id || null;
  var f = id ? db.fixos.find(function (x) { return x.id === id; }) : null;

  $('#divida-title').textContent = f ? 'Editar dívida' : 'Nova dívida';
  $('#dv-descricao').value = f ? (f.descricao || '') : '';
  $('#dv-valor').value = f ? moedaCurta(f.valor) : '';
  $('#dv-dia').value = f && f.dia ? f.dia : '';
  $('#dv-parcelas').value = f ? (f.parcelas || '') : '';

  var atual = 1;
  if (f && ehDivida(f)) {
    atual = Math.max(1, Math.min(parcelaNoMes(f, ymAtualDoSistema()), f.parcelas));
  }
  $('#dv-atual').value = f ? atual : 1;

  dividaPrevia();
  abrirOverlay('#overlay-divida');
  setTimeout(function () { $('#dv-descricao').focus(); }, 250);
}

/* Prévia ao vivo do form */
function dividaPrevia() {
  var el = $('#dv-previa');
  var v = parseValor($('#dv-valor').value);
  var tot = parseInt($('#dv-parcelas').value, 10);
  var at = parseInt($('#dv-atual').value, 10);

  if (!v || !tot || tot < 1) {
    el.textContent = 'Preencha o valor da parcela e o total de parcelas pra ver a projeção.';
    return;
  }
  if (!at || at < 1) at = 1;
  if (at > tot) {
    el.textContent = 'Você está na parcela ' + at + ', mas o total é ' + tot + '. Confere aí 🤔';
    return;
  }

  var restam = tot - at + 1;                      // a parcela atual ainda vai ser paga
  var soma = r2(restam * v);
  var ultima = ymDeslocado(ymAtualDoSistema(), tot - at);

  el.textContent = 'Faltam ' + restam + (restam === 1 ? ' parcela · ' : ' parcelas · ') +
                   formatarMoeda(soma) + ' · última em ' + rotuloMes(ultima);
}

function salvarDivida() {
  var desc = $('#dv-descricao').value.trim();
  var valor = parseValor($('#dv-valor').value);
  var dia = parseInt($('#dv-dia').value, 10);
  var tot = parseInt($('#dv-parcelas').value, 10);
  var at = parseInt($('#dv-atual').value, 10);

  if (!desc) { toast('Escreve o que é essa dívida 🙂'); return; }
  if (!valor || valor <= 0) { toast('Falta o valor da parcela'); return; }
  if (!tot || tot < 1) { toast('Quantas parcelas são no total?'); return; }
  if (!at || at < 1) at = 1;
  if (at > tot) { toast('A parcela atual não pode passar do total'); return; }
  if (!dia || dia < 1 || dia > 31) dia = null;

  var hoje = ymAtualDoSistema();
  var desde = ymDeslocado(hoje, -(at - 1));
  var novo = !dividaEditandoId;
  var f;

  if (novo) {
    f = {
      id: novoId(),
      descricao: desc,
      valor: r2(valor),
      tipo: 'saida',
      categoria: 'Dívida',
      dia: dia,
      desde: desde,
      parcelas: tot,
      quitacaoInformada: null
    };
    db.fixos.push(f);
  } else {
    f = db.fixos.find(function (x) { return x.id === dividaEditandoId; });
    if (!f) { toast('Essa dívida não existe mais 🤷'); fecharOverlay('#overlay-divida'); render(); return; }
    f.descricao = desc;
    f.valor = r2(valor);
    f.tipo = 'saida';
    f.categoria = f.categoria || 'Dívida';
    f.dia = dia;
    f.desde = desde;
    f.parcelas = tot;
  }

  dividasResincronizar(f.id);
  salvar();
  fecharOverlay('#overlay-divida');
  dividaEditandoId = null;

  if (novo) dividaAvisarDuplicata(f);

  render();
  toast(novo ? 'Dívida cadastrada 🧾' : 'Dívida atualizada');
}

/* Aviso de duplicata — NUNCA transforma nada sozinho, só oferece. */
function dividaAvisarDuplicata(f) {
  var hoje = ymAtualDoSistema();
  var m = db.meses[hoje];
  if (!m) return;

  var candidatos = m.lancamentos.filter(function (l) {
    return l.tipo === 'saida' && !l.fixoId && !l.origem &&
           Math.abs(l.valor - f.valor) <= 0.01;
  });
  if (!candidatos.length) return;

  var mudou = false;
  candidatos.forEach(function (l) {
    var ok = confirm(
      'Já existe "' + (l.descricao || 'sem nome') + '" de ' + formatarMoeda(l.valor) +
      ' neste mês.\n\nÉ a mesma coisa que a parcela de "' + f.descricao + '"?\n\n' +
      'OK = é essa, pode apagar o lançamento avulso (a parcela já entrou sozinha)\n' +
      'Cancelar = são coisas diferentes'
    );
    if (ok) {
      m.lancamentos = m.lancamentos.filter(function (x) { return x.id !== l.id; });
      mudou = true;
    }
  });

  if (mudou) { salvar(); toast('Lançamento repetido removido'); }
}

/* =========================================================
   Ações da dívida (quitar / banco / editar / excluir)
   ========================================================= */
function abrirDividaAcoes(id) {
  var f = db.fixos.find(function (x) { return x.id === id; });
  if (!f || !ehDivida(f)) return;
  dividaAcaoId = id;

  $('#da-titulo').textContent = f.descricao || 'Dívida';

  var banco = quitacaoValida(f);
  var ultima = ultimaParcelaYm(f);
  var linhas = [];
  linhas.push('Parcela ' + Math.min(parcelasPagas(f) + 1, f.parcelas) + ' de ' + f.parcelas +
              ' · ' + formatarMoeda(f.valor) + ' por mês');
  linhas.push('Faltam ' + parcelasRestantes(f) + ' × ' + formatarMoeda(f.valor));
  linhas.push((banco != null ? '🔒 Pra quitar (o banco passou): ' : '📐 Pagando até o fim: ') +
              formatarMoeda(custoQuitar(f)));
  if (ultima) linhas.push('Última parcela em ' + rotuloMes(ultima));

  $('#da-info').innerHTML = linhas.map(escapar).join('<br>') +
    '<br><span class="aviso-desconto">seu banco pode dar desconto pra antecipar — confirme o valor com ele</span>';

  abrirOverlay('#overlay-divida-acoes');
}

/* 7.5 — quitar não é grátis: vira uma saída gorda no mês atual. */
function quitarDivida(f) {
  var hoje = ymAtualDoSistema();
  var valor = custoQuitar(f);                     // ANTES de mexer em nada
  garantirMes(hoje);
  var mes = db.meses[hoje];

  mes.lancamentos = mes.lancamentos.filter(function (l) {
    return !(l.fixoId === f.id && l.status !== 'ok');
  });
  mes.lancamentos.push({
    id: novoId(),
    fixoId: null,
    origem: 'quitacao',
    descricao: 'Quitação — ' + f.descricao,
    valor: valor,
    tipo: 'saida',
    categoria: 'Quitação',
    dia: diaDeHoje(hoje),
    status: 'previsto'
  });

  db.fixos = db.fixos.filter(function (x) { return x.id !== f.id; });
  limparFixoDosMesesFuturos(f.id, hoje);
  salvar();
  render();
}

function excluirDivida(f) {
  var hoje = ymAtualDoSistema();
  db.fixos = db.fixos.filter(function (x) { return x.id !== f.id; });
  limparFixoDosMesesFuturos(f.id, ymDeslocado(hoje, -1));   // tira do mês atual também
  salvar();
  render();
}

function dividaInformarBanco(f) {
  var atual = (f.quitacaoInformada && typeof f.quitacaoInformada.valor === 'number')
    ? f.quitacaoInformada.valor : 0;
  pedirValor(
    'Quanto o banco cobra pra quitar?',
    'O valor que ele te passou pra pagar tudo de uma vez, hoje. Se as parcelas mudarem, eu descarto esse número sozinho.',
    'Valor pra quitar (R$)',
    atual,
    function (v) {
      var alvo = db.fixos.find(function (x) { return x.id === f.id; });
      if (!alvo) return;
      if (!v || v <= 0) {
        alvo.quitacaoInformada = null;
        toast('Voltei pra soma das parcelas 📐');
      } else {
        alvo.quitacaoInformada = { valor: r2(v), em: hojeISO(), restantes: parcelasRestantes(alvo) };
        toast('Valor do banco guardado 🔒');
      }
      salvar();
      render();
    }
  );
}

/* =========================================================
   Eventos
   ========================================================= */
function ligarEventosDividas() {
  /* ---- Form ---- */
  $('#divida-cancel').addEventListener('click', function () {
    dividaEditandoId = null;
    fecharOverlay('#overlay-divida');
  });
  $('#divida-save').addEventListener('click', salvarDivida);

  ['#dv-valor', '#dv-parcelas', '#dv-atual'].forEach(function (sel) {
    $(sel).addEventListener('input', dividaPrevia);
  });

  /* ---- Card "Se eu quitasse tudo agora" ---- */
  $('#card-quitar').addEventListener('click', function (e) {
    if (e.target.closest('#q-caixa')) dividasEditarCaixa();
  });
  $('#card-quitar').addEventListener('change', function (e) {
    if (e.target.id !== 'q-usar-guardado') return;
    db.config.usarGuardadoNaQuitacao = !!e.target.checked;
    salvar();
    render();
    if (db.config.usarGuardadoNaQuitacao) {
      toast('Cuidado: se você digitou o saldo cheio da conta, o guardado já está lá dentro');
    }
  });

  /* ---- Card "Acelerar" ---- */
  $('#card-acelerar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-passo]');
    if (!b) return;
    var passo = parseInt(b.dataset.passo, 10) || 0;
    extraAcelerar = Math.max(0, (extraAcelerar || 0) + passo);
    renderDividasAcelerar();
  });

  /* ---- Lista ---- */
  $('#list-dividas').addEventListener('click', function (e) {
    var item = e.target.closest('.divida-item');
    if (!item) return;
    abrirDividaAcoes(item.dataset.id);
  });

  /* ---- Folha de ações ---- */
  $('#da-fechar').addEventListener('click', function () {
    dividaAcaoId = null;
    fecharOverlay('#overlay-divida-acoes');
  });

  $('#da-quitar').addEventListener('click', function () {
    var f = db.fixos.find(function (x) { return x.id === dividaAcaoId; });
    if (!f) return;
    var ok = confirm(
      'Quitar "' + f.descricao + '" agora?\n\n' +
      'Vou lançar uma saída de ' + formatarMoeda(custoQuitar(f)) + ' neste mês e apagar as parcelas que faltavam.\n\n' +
      'Quitar não é de graça: o seu mês vai sentir.'
    );
    if (!ok) return;
    fecharOverlay('#overlay-divida-acoes');
    dividaAcaoId = null;
    quitarDivida(f);
    toast('Quitada ⚡ — olha o mês');
  });

  $('#da-banco').addEventListener('click', function () {
    var f = db.fixos.find(function (x) { return x.id === dividaAcaoId; });
    if (!f) return;
    fecharOverlay('#overlay-divida-acoes');
    dividaInformarBanco(f);
  });

  $('#da-editar').addEventListener('click', function () {
    var id = dividaAcaoId;
    fecharOverlay('#overlay-divida-acoes');
    dividaAcaoId = null;
    abrirDivida(id);
  });

  $('#da-excluir').addEventListener('click', function () {
    var f = db.fixos.find(function (x) { return x.id === dividaAcaoId; });
    if (!f) return;
    if (!confirm('Excluir "' + f.descricao + '"?\n\nSomem as parcelas ainda não pagas. O que você já marcou como pago continua no histórico.')) return;
    fecharOverlay('#overlay-divida-acoes');
    dividaAcaoId = null;
    excluirDivida(f);
    toast('Dívida excluída 🗑️');
  });
}
