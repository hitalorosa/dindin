function renderizarCarteiras() {
  const container = document.getElementById('lista-carteiras');
  container.innerHTML = '';

  document.getElementById('total-investido').textContent = formatarMoeda(totalInvestido());

  if (carteiras.length === 0) {
    container.innerHTML = '<p class="vazio">Nenhuma carteira criada. Crie uma acima!</p>';
    return;
  }

  carteiras.forEach((carteira, idx) => {
    const div = document.createElement('div');
    div.className = 'carteira-card';
    div.innerHTML = `
      <div class="carteira-header">
        <span class="carteira-nome">${carteira.icone || '📁'} ${carteira.nome}</span>
        <button class="btn-remover" onclick="removerCarteira(${idx})">✕</button>
      </div>
      <h3 class="carteira-saldo">${formatarMoeda(carteira.saldo)}</h3>
      <div class="carteira-acoes">
        <input type="number" id="mov-${idx}" class="input-movimentacao" placeholder="Valor" step="0.01" min="0" />
        <button class="btn-depositar" onclick="mover(${idx}, 'depositar')">+ Depositar</button>
        <button class="btn-retirar"   onclick="mover(${idx}, 'retirar')">− Retirar</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function removerCarteira(idx) {
  if (!confirm(`Excluir "${carteiras[idx].nome}"?`)) return;
  carteiras.splice(idx, 1);
  salvarCarteiras();
  renderizarCarteiras();
}

function mover(idx, acao) {
  const valor = parseFloat(document.getElementById(`mov-${idx}`).value);
  if (isNaN(valor) || valor <= 0) { alert('Informe um valor válido.'); return; }

  if (acao === 'retirar' && valor > carteiras[idx].saldo) {
    alert('Saldo insuficiente nesta carteira.');
    return;
  }

  carteiras[idx].saldo += acao === 'depositar' ? valor : -valor;
  salvarCarteiras();
  renderizarCarteiras();
}

document.getElementById('form-carteira').addEventListener('submit', function (e) {
  e.preventDefault();
  const nome  = document.getElementById('nome-carteira').value.trim();
  const icone = document.getElementById('icone-carteira').value.trim();
  if (!nome) return;

  carteiras.push({ nome, icone: icone || '📁', saldo: 0 });
  salvarCarteiras();
  renderizarCarteiras();
  this.reset();
});

renderizarCarteiras();
