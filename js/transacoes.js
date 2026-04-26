function renderizarLista() {
  const lista = document.getElementById('lista-transacoes');
  lista.innerHTML = '';

  if (transacoes.length === 0) {
    lista.innerHTML = '<p class="vazio">Nenhuma transação ainda. Adicione uma acima!</p>';
    return;
  }

  [...transacoes].reverse().forEach((t, idxInv) => {
    const idx = transacoes.length - 1 - idxInv;
    const li  = document.createElement('li');
    li.className = `transacao-item ${t.tipo}`;
    li.innerHTML = `
      <div class="transacao-info">
        <span class="transacao-desc">${t.descricao}</span>
        <span class="transacao-cat">${t.categoria}</span>
      </div>
      <span class="transacao-valor">
        ${t.tipo === 'entrada' ? '+' : '-'} ${formatarMoeda(t.valor)}
      </span>
      <button class="btn-remover" onclick="remover(${idx})">✕</button>
    `;
    lista.appendChild(li);
  });
}

function remover(idx) {
  transacoes.splice(idx, 1);
  salvarTransacoes();
  renderizarLista();
}

document.getElementById('form-transacao').addEventListener('submit', function (e) {
  e.preventDefault();
  const descricao = document.getElementById('descricao').value.trim();
  const valor     = parseFloat(document.getElementById('valor').value);
  const categoria = document.getElementById('categoria').value;
  const tipo      = document.querySelector('input[name="tipo"]:checked').value;

  if (!descricao || isNaN(valor) || valor <= 0) return;

  transacoes.push({ descricao, valor, categoria, tipo });
  salvarTransacoes();
  renderizarLista();
  this.reset();
  document.querySelector('input[name="tipo"][value="entrada"]').checked = true;
});

renderizarLista();
