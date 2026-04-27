function proximoPagamento() {
  const hoje = new Date();
  const dia  = hoje.getDate();
  const mes  = hoje.getMonth();
  const ano  = hoje.getFullYear();
  const dias = salarioConfig.dias.slice().sort((a, b) => a - b);

  for (const d of dias) {
    if (d > dia) return new Date(ano, mes, d);
  }
  // Próximo mês, primeiro dia de pagamento
  return new Date(ano, mes + 1, dias[0]);
}

function diasAteProximo(data) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);
  const diff = Math.round((data - hoje) / (1000 * 60 * 60 * 24));
  return diff;
}

function renderizarSalario() {
  const val    = salarioConfig.valor;
  const mensal = val * salarioConfig.dias.length;
  const anual  = mensal * 12;

  document.getElementById('sal-por-pgto').textContent = formatarMoeda(val);
  document.getElementById('sal-mensal').textContent   = formatarMoeda(mensal);
  document.getElementById('sal-anual').textContent    = formatarMoeda(anual);

  // Badges dos dias
  salarioConfig.dias.forEach((d, i) => {
    const el = document.getElementById(`badge-dia-${i + 1}`);
    if (el) el.textContent = `Dia ${d}`;
  });

  // Próximo pagamento
  const proximo = proximoPagamento();
  const dias    = diasAteProximo(proximo);
  const el      = document.getElementById('sal-proximo');
  el.textContent = dias === 0
    ? '🎉 É hoje!'
    : `${proximo.toLocaleDateString('pt-BR')} (em ${dias} dia${dias > 1 ? 's' : ''})`;

  // Input com valor atual
  document.getElementById('input-sal-valor').placeholder = `Atual: ${formatarMoeda(val)}`;

  renderizarHistorico();
}

function renderizarHistorico() {
  const lista = document.getElementById('lista-historico-sal');
  lista.innerHTML = '';

  const hist = [...salarioConfig.historico].reverse();
  const totalRecebido = salarioConfig.historico.reduce((a, h) => a + h.valor, 0);

  document.getElementById('sal-total-recebido').textContent =
    `Total recebido: ${formatarMoeda(totalRecebido)}`;

  if (hist.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhum recebimento registrado ainda.</p>';
    return;
  }

  hist.forEach((h, idx) => {
    const li = document.createElement('li');
    li.className = 'transacao-item entrada';
    li.innerHTML = `
      <div class="transacao-info">
        <span class="transacao-desc">💼 Salário</span>
        <span class="transacao-cat">${formatarDataCompleta(h.data)}</span>
      </div>
      <span class="transacao-valor">+ ${formatarMoeda(h.valor)}</span>
      <button class="btn-remover" onclick="removerHistorico(${salarioConfig.historico.length - 1 - idx})" title="Remover">✕</button>
    `;
    lista.appendChild(li);
  });
}

function removerHistorico(idx) {
  if (!confirm('Remover este recebimento do histórico?')) return;
  salarioConfig.historico.splice(idx, 1);
  salvarSalario();
  renderizarHistorico();
}

// Salvar novo valor de salário
document.getElementById('btn-sal-salvar').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('input-sal-valor').value);
  if (isNaN(val) || val <= 0) { alert('Informe um valor válido.'); return; }

  const anterior = salarioConfig.valor;
  salarioConfig.valor = val;
  salvarSalario();
  document.getElementById('input-sal-valor').value = '';

  const diff = val - anterior;
  if (diff !== 0) {
    alert(diff > 0
      ? `🎉 Parabéns pelo aumento de ${formatarMoeda(diff)}!`
      : `Salário atualizado para ${formatarMoeda(val)}.`
    );
  }
  renderizarSalario();
});

// Registrar recebimento manualmente
document.getElementById('btn-registrar-manual').addEventListener('click', () => {
  if (!confirm(`Registrar recebimento de ${formatarMoeda(salarioConfig.valor)} hoje?`)) return;

  const hoje = hojeISO();
  transacoes.push({
    descricao: '💼 Salário',
    valor: salarioConfig.valor,
    categoria: 'Salário',
    tipo: 'entrada',
    data: new Date().toISOString(),
    fixo: true
  });
  salvarTransacoes();

  salarioConfig.historico.push({ data: hoje, valor: salarioConfig.valor });
  salvarSalario();
  localStorage.setItem('dindin_salario_visto', hoje);

  renderizarHistorico();
  alert('✅ Recebimento registrado!');
});

renderizarSalario();
