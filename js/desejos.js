let listaDesejos = JSON.parse(localStorage.getItem('dindin_desejos')) || [];

function salvarDesejos() {
  localStorage.setItem('dindin_desejos', JSON.stringify(listaDesejos));
}

// produto sendo pré-visualizado
let produtoTemp = null;

// ── RESUMO ────────────────────────────────────────────
function atualizarResumo() {
  document.getElementById('desejo-qtd').textContent = listaDesejos.length;
  const total = listaDesejos.reduce((a, d) => a + (d.preco || 0), 0);
  document.getElementById('desejo-total').textContent = formatarMoeda(total);
}

// ── BUSCAR LINK ───────────────────────────────────────
document.getElementById('btn-analisar').addEventListener('click', analisarLink);
document.getElementById('input-url').addEventListener('keydown', e => {
  if (e.key === 'Enter') analisarLink();
});

async function analisarLink() {
  const url = document.getElementById('input-url').value.trim();
  if (!url) { alert('Cole um link válido.'); return; }

  const status = document.getElementById('link-status');
  const btn    = document.getElementById('btn-analisar');

  status.textContent = '⏳ Buscando produto...';
  status.style.color = 'var(--yellow)';
  btn.disabled = true;
  btn.textContent = '...';

  document.getElementById('produto-preview').style.display = 'none';
  produtoTemp = null;

  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`;
    const res    = await fetch(apiUrl);
    const data   = await res.json();

    if (data.status !== 'success') throw new Error('Produto não encontrado');

    const { title, description, image, price } = data.data;

    produtoTemp = {
      url,
      titulo: title || description || 'Produto sem título',
      imagem: image?.url || '',
      preco:  null
    };

    // Tenta extrair preço da resposta da API
    if (price?.amount) {
      produtoTemp.preco = parseFloat(price.amount);
    }

    preencherPreview(produtoTemp);
    status.textContent = '✅ Produto encontrado!';
    status.style.color = 'var(--green)';

  } catch (err) {
    status.textContent = '❌ Não foi possível buscar o produto.';
    status.style.color = 'var(--red)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analisar';
  }
}

function preencherPreview(produto) {
  const preview = document.getElementById('produto-preview');

  document.getElementById('preview-titulo').textContent = produto.titulo;

  const img = document.getElementById('preview-img');
  if (produto.imagem) {
    img.src = produto.imagem;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  const precoEl    = document.getElementById('preview-preco');
  const manualWrap = document.getElementById('preco-manual-wrap');

  if (produto.preco && produto.preco > 0) {
    precoEl.textContent = formatarMoeda(produto.preco);
    precoEl.style.display = 'block';
    manualWrap.style.display = 'none';
  } else {
    precoEl.style.display = 'none';
    manualWrap.style.display = 'flex';
    document.getElementById('input-preco-manual').value = '';
  }

  preview.style.display = 'flex';
}

// ── ADICIONAR DESEJO ──────────────────────────────────
document.getElementById('btn-adicionar-desejo').addEventListener('click', () => {
  if (!produtoTemp) return;

  // Se preço não foi achado, pega o manual
  if (!produtoTemp.preco || produtoTemp.preco <= 0) {
    const manual = parseFloat(document.getElementById('input-preco-manual').value);
    if (isNaN(manual) || manual <= 0) {
      alert('Insira o preço do produto.');
      return;
    }
    produtoTemp.preco = manual;
  }

  listaDesejos.push({ ...produtoTemp, id: Date.now() });
  salvarDesejos();
  renderizarGrid();
  atualizarResumo();

  // limpa
  document.getElementById('input-url').value = '';
  document.getElementById('produto-preview').style.display = 'none';
  document.getElementById('link-status').textContent = '';
  produtoTemp = null;
});

// ── GRID DE DESEJOS ───────────────────────────────────
function renderizarGrid() {
  const grid = document.getElementById('grid-desejos');
  grid.innerHTML = '';

  if (listaDesejos.length === 0) {
    grid.innerHTML = '<p class="vazio" style="padding:32px 0;">Sua lista de desejos está vazia.<br>Cole um link acima para começar! 🛍️</p>';
    return;
  }

  listaDesejos.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'desejo-card';
    card.innerHTML = `
      <button class="desejo-excluir" onclick="excluirDesejo(${idx})" title="Remover">✕</button>

      <a href="${item.url}" target="_blank" rel="noopener" class="desejo-img-link">
        ${item.imagem
          ? `<img class="desejo-img" src="${item.imagem}" alt="${item.titulo}" onerror="this.parentElement.innerHTML='<div class=desejo-sem-img>🛍️</div>'" />`
          : `<div class="desejo-sem-img">🛍️</div>`
        }
      </a>

      <div class="desejo-info">
        <p class="desejo-titulo">${item.titulo}</p>
        <span class="desejo-preco">${item.preco ? formatarMoeda(item.preco) : '—'}</span>
      </div>

      <a href="${item.url}" target="_blank" rel="noopener" class="desejo-btn-comprar">
        🛒 Comprar
      </a>
    `;
    grid.appendChild(card);
  });
}

function excluirDesejo(idx) {
  if (!confirm(`Remover "${listaDesejos[idx].titulo}" da lista?`)) return;
  listaDesejos.splice(idx, 1);
  salvarDesejos();
  renderizarGrid();
  atualizarResumo();
}

// ── INIT ─────────────────────────────────────────────
atualizarResumo();
renderizarGrid();
