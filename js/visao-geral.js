function render() {
  const { entradas, saidas, livre } = calcularTotais();

  document.getElementById('total-entradas').textContent = formatarMoeda(entradas);
  document.getElementById('total-saidas').textContent   = formatarMoeda(saidas);
  document.getElementById('total-livre').textContent    = formatarMoeda(livre);

  // Potencial de investimento
  const base = livre > 0 ? livre : 0;
  document.getElementById('pot-10').textContent = formatarMoeda(base * 0.10);
  document.getElementById('pot-20').textContent = formatarMoeda(base * 0.20);
  document.getElementById('pot-30').textContent = formatarMoeda(base * 0.30);

  // Termômetro
  const fill  = document.getElementById('termometro-fill');
  const info  = document.getElementById('termometro-info');
  const label = document.getElementById('limite-restante-label');

  if (limiteGastos <= 0) {
    fill.style.width = '0%';
    fill.style.background = '#34d399';
    info.textContent  = 'Configure seu limite abaixo.';
    label.textContent = '—';
    return;
  }

  const pct      = Math.min((saidas / limiteGastos) * 100, 100);
  const restante = limiteGastos - saidas;

  fill.style.width = pct + '%';
  fill.style.background = pct < 60 ? '#34d399' : pct < 85 ? '#fbbf24' : '#f87171';

  label.textContent = restante >= 0
    ? `${formatarMoeda(restante)} restantes`
    : `${formatarMoeda(Math.abs(restante))} acima do limite`;

  info.textContent = pct < 60
    ? '✅ Você está dentro do orçamento.'
    : pct < 85
    ? '⚠️ Já usou mais de 60% do limite.'
    : '🚨 Limite quase esgotado!';
}

// Salvar limite
document.getElementById('btn-salvar-limite').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('input-limite').value);
  if (isNaN(val) || val <= 0) { alert('Informe um valor válido.'); return; }
  limiteGastos = val;
  salvarLimite(val);
  document.getElementById('input-limite').value = '';
  render();
});

// Preenche placeholder com limite já salvo
if (limiteGastos > 0) {
  document.getElementById('input-limite').placeholder = `Atual: ${formatarMoeda(limiteGastos)}`;
}

render();
