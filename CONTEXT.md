# 📁 CONTEXT.md — Dindin (Migração de Contexto)

> Documento de migração para nova conta do Claude.  
> Gerado em: 2026-05-21  
> Repositório: https://github.com/hitalorosa/dindin  
> Deploy: https://dindin-nine.vercel.app

---

## 1. Visão Geral do Projeto

**Dindin** é um app de finanças pessoais desenvolvido com **HTML + CSS + JavaScript puro** (sem frameworks), projetado para rodar no celular e desktop. Os dados ficam no `localStorage` do navegador — sem backend, sem banco de dados.

### Tecnologias
| Camada | Tecnologia |
|--------|-----------|
| Linguagem | JavaScript (vanilla) + Node.js (apenas dev server) |
| Interface | HTML5 + CSS3 (sem frameworks) |
| Persistência | `localStorage` |
| Fonte | Inter (Google Fonts) |
| Deploy | Vercel (plano Hobby, repo público obrigatório) |
| Repositório | GitHub — https://github.com/hitalorosa/dindin |
| Dev local | `node dev-server.js` na porta 3000 |

### APIs externas
- **Cotação do dólar**: `https://economia.awesomeapi.com.br/json/last/USD-BRL`
- **Metadados de produto (lista de desejos)**: `https://api.microlink.io/?url=ENCODED_URL&screenshot=false`

---

## 2. Estrutura de Arquivos

```
Dindin/
├── index.html              ← Visão Geral (dashboard)
├── transacoes.html         ← Transações
├── gastos-fixos.html       ← Gastos Fixos mensais
├── salario.html            ← Salário e histórico de recebimentos
├── cartao.html             ← Cartão de Crédito
├── investimentos.html      ← Carteiras de Investimento
├── desejos.html            ← Lista de Desejos
├── css/
│   └── style.css           ← Design system completo (dark purple neon)
├── js/
│   ├── app.js              ← Estado global + utilitários (carregado em TODAS as páginas)
│   ├── visao-geral.js      ← Dashboard
│   ├── transacoes.js       ← CRUD de transações
│   ├── gastos-fixos.js     ← Gastos fixos mensais
│   ├── salario.js          ← Config de salário
│   ├── cartao.js           ← Cartão de crédito + parcelas
│   ├── investimentos.js    ← Carteiras de investimento
│   └── desejos.js          ← Lista de desejos com Microlink API
├── dev-server.js           ← Servidor local Node.js (porta 3000) — excluído do Vercel
├── vercel.json             ← { "version": 2 }
├── .vercelignore           ← dev-server.js
├── package.json            ← { "scripts": { "dev": "node dev-server.js" } }
└── CONTEXT.md              ← Este arquivo
```

---

## 3. Arquitetura e Regras Críticas de Código

### 3.1 ⚠️ REGRA MAIS IMPORTANTE — Nunca redeclarar globais de app.js

`app.js` é carregado em **todas** as páginas antes dos scripts específicos. Ele declara todas as variáveis globais com `let`. Se qualquer outro arquivo JS redeclarar a mesma variável com `let` no escopo global, o navegador lança um **SyntaxError silencioso** que quebra o script inteiro da página.

```js
// ❌ ERRADO — quebra tudo
let gastosFixos = [...];   // em gastos-fixos.js

// ✅ CORRETO — usa a variável global de app.js diretamente
// gastosFixos já declarado em app.js — usar diretamente
```

### 3.2 Ordem de carregamento dos scripts

Todo `.html` deve terminar com:
```html
<script src="js/app.js"></script>
<script src="js/[modulo-da-pagina].js"></script>
```

### 3.3 localStorage — chaves utilizadas

| Chave | Conteúdo |
|-------|---------|
| `dindin_transacoes` | Array de transações |
| `dindin_carteiras` | Array de carteiras de investimento |
| `dindin_fixos` | Array de gastos fixos |
| `dindin_limite` | Número — limite de gastos mensais |
| `dindin_salario` | Objeto `{ valor, dias, historico }` |
| `dindin_cartao` | Objeto `{ limite, compras[] }` |
| `dindin_desejos` | Array de itens da lista de desejos |
| `dindin_salario_visto` | String ISO (YYYY-MM-DD) — evita mostrar modal 2x no mesmo dia |

---

## 4. Código Completo — js/app.js

```js
// ── DADOS GLOBAIS ────────────────────────────────────
let transacoes   = JSON.parse(localStorage.getItem('dindin_transacoes')) || [];
let carteiras    = JSON.parse(localStorage.getItem('dindin_carteiras'))  || [];
let gastosFixos  = JSON.parse(localStorage.getItem('dindin_fixos'))      || [];
let limiteGastos = parseFloat(localStorage.getItem('dindin_limite'))     || 0;
let salarioConfig = JSON.parse(localStorage.getItem('dindin_salario'))   || {
  valor: 1150,
  dias: [5, 20],
  historico: []
};
let cartaoConfig = JSON.parse(localStorage.getItem('dindin_cartao')) || {
  limite: 0,
  compras: []
};

function salvarTransacoes()  { localStorage.setItem('dindin_transacoes', JSON.stringify(transacoes)); }
function salvarCarteiras()   { localStorage.setItem('dindin_carteiras',  JSON.stringify(carteiras));  }
function salvarLimite(v)     { localStorage.setItem('dindin_limite', String(v)); }
function salvarCartao()      { localStorage.setItem('dindin_cartao', JSON.stringify(cartaoConfig)); }
function salvarSalario()     { localStorage.setItem('dindin_salario', JSON.stringify(salarioConfig)); }

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function formatarDataCompleta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function hojeISO() {
  return new Date().toISOString().split('T')[0];
}
function calcularTotais() {
  const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
  const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
  return { entradas, saidas, livre: entradas - saidas };
}
function totalInvestido() {
  return carteiras.reduce((a, c) => a + c.saldo, 0);
}

// Cotação do dólar
async function buscarDolar() {
  const el = document.getElementById('dolar-valor');
  if (!el) return;
  try {
    const res  = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await res.json();
    el.textContent = `💵 USD R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
  } catch {
    el.textContent = '💵 USD indisponível';
  }
}

// Modal de salário (aparece nos dias configurados)
function criarModalSalario() {
  const modal = document.createElement('div');
  modal.id = 'modal-salario';
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-box">
        <div class="modal-icone">💰</div>
        <h2 class="modal-titulo">Dia de salário!</h2>
        <p class="modal-texto">
          Seu salário de <strong>${formatarMoeda(salarioConfig.valor)}</strong> foi creditado hoje?
        </p>
        <div class="modal-botoes">
          <button class="modal-btn-sim" id="modal-sim">✅ Sim, recebi!</button>
          <button class="modal-btn-nao" id="modal-nao">Ainda não</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('modal-sim').addEventListener('click', () => {
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
    document.getElementById('modal-overlay').remove();
    if (typeof atualizarCards === 'function') atualizarCards();
    if (typeof renderizarLista === 'function') renderizarLista();
  });

  document.getElementById('modal-nao').addEventListener('click', () => {
    localStorage.setItem('dindin_salario_visto', hojeISO());
    document.getElementById('modal-overlay').remove();
  });
}

function verificarSalario() {
  const dia     = new Date().getDate();
  const jaVisto = localStorage.getItem('dindin_salario_visto');
  if (salarioConfig.dias.includes(dia) && jaVisto !== hojeISO()) {
    setTimeout(criarModalSalario, 800);
  }
}

buscarDolar();
verificarSalario();
```

---

## 5. Design System — css/style.css (variáveis e regras críticas)

```css
:root {
  --bg:        #07071a;
  --surface:   #0f0f2a;
  --surface2:  #161635;
  --border:    rgba(124,58,237,0.25);
  --purple:    #7c3aed;
  --purple2:   #a855f7;
  --blue:      #3b82f6;
  --pink:      #ec4899;
  --green:     #10b981;
  --red:       #ef4444;
  --yellow:    #f59e0b;
  --text:      #ffffff;
  --text2:     #a0a0c0;
  --text3:     #5a5a80;
  --radius:    20px;
  --radius-sm: 12px;
  --radius-pill: 999px;
}
```

**Regras críticas descobertas durante o desenvolvimento:**

- `.container` precisa ter `display: flex; flex-direction: column; gap: 16px;` — sem isso o conteúdo some.
- Nav links inativos: `color: rgba(255,255,255,0.45)` — `var(--text3)` ficava escuro demais.
- Links de navegação precisam de `text-decoration: none; display: block;` para funcionar como botões.

---

## 6. Funcionalidades por Página

### 📊 index.html — Visão Geral
- Cards: Entradas, Saídas, Livre, Total Investido
- Barra de limite de gastos (termômetro)
- Lista das últimas transações
- Cotação do dólar em tempo real no header

### 💸 transacoes.html — Transações
- Formulário: descrição, valor, categoria, tipo (entrada/saída), data
- Lista com filtro por tipo
- Cada transação salva com `data: new Date().toISOString()`

### 📋 gastos-fixos.html — Gastos Fixos
- Cards resumo: Total Fixo, Já Pago, Em Aberto
- Barra de progresso do mês (X de Y pagos)
- Toggle de pago/não-pago por item
- Botão "Reiniciar mês" (reset todos para não pago)
- Formulário: nome, valor, ícone, categoria

### 💼 salario.html — Salário
- Cards: Por Pagamento, Mensal (2x), Projeção Anual
- Configuração de valor e dias de pagamento
- Próximo pagamento calculado automaticamente
- Modal automático nos dias configurados (padrão: dias 5 e 20)
- Histórico de recebimentos com total

### 💳 cartao.html — Cartão de Crédito
- Painel visual do cartão (limite, fatura atual, disponível, barra de uso)
- Configuração de limite
- Formulário de nova compra: nome, valor, data, parcelas (1x até 12x)
- Toggle "É um gasto fixo?" — se marcado, automaticamente adiciona ao `dindin_fixos`
- Toda compra reflete em `dindin_transacoes` como saída
- Navegação de fatura por mês (‹ ›)
- Parcelas distribuídas corretamente por mês

### 📈 investimentos.html — Investimentos
- Card com Total Investido (soma de todas as carteiras)
- Criar carteiras com nome e ícone
- Por carteira: depositar e retirar valores
- Saldo individual por carteira

### ✨ desejos.html — Lista de Desejos
- Cole um link de produto → Microlink API extrai título, imagem e preço
- Se preço não encontrado → campo manual
- Grid de cards com imagem, título, preço e botão "Comprar"
- Resumo: quantidade de desejos e total

---

## 7. Integrações entre Módulos

```
Cartão de Crédito  →  Transações    (toda compra vira saída em dindin_transacoes)
Cartão de Crédito  →  Gastos Fixos  (se toggle "É fixo" ativado, vai para dindin_fixos)
Modal de Salário   →  Transações    (confirmar recebimento vira entrada em dindin_transacoes)
Modal de Salário   →  Histórico     (salvo em salarioConfig.historico)
```

---

## 8. Problemas Resolvidos (Bugs Históricos)

| Bug | Causa | Solução |
|-----|-------|---------|
| Páginas em branco via `file://` | Browser bloqueia CSS/JS por segurança | Servir via HTTP: `node dev-server.js` |
| Vercel detectava `server.js` como entrypoint Node.js | Nome padrão reconhecido | Renomear para `dev-server.js` + `.vercelignore` |
| Vercel rejeitava repo privado (Hobby plan) | Limitação do plano gratuito | Tornar repositório público no GitHub |
| Conteúdo invisível/esmagado no container | `.container` sem flex layout | Adicionar `display:flex; flex-direction:column; gap:16px` |
| Links de nav não funcionavam | `<a>` sem estilos adequados | `text-decoration:none; display:block` no CSS |
| **SyntaxError silencioso crítico** | `gastos-fixos.js` redeclarava `let gastosFixos` (já existe em `app.js`) | Remover a redeclaração — usar a global diretamente |
| Cartão → Fixos não funcionava | Consequência do bug acima + uso errado da variável em `cartao.js` | Corrigir `gastos-fixos.js` e usar `gastosFixos` global em `cartao.js` |
| Ícones da nav invisíveis | `var(--text3)` = `#5a5a80` (muito escuro no fundo escuro) | Mudar para `rgba(255,255,255,0.45)` |

---

## 9. Git e Deploy

### Fluxo de trabalho
```bash
# Desenvolvimento local
node dev-server.js          # abre em http://localhost:3000

# Após cada feature
git add <arquivos>
git commit -m "feat: descrição"
git push origin main        # Vercel deploy automático via GitHub
```

### Deploy no Vercel
- Conectado ao repo `hitalorosa/dindin` (público)
- Deploy automático a cada `git push`
- `vercel.json`: `{ "version": 2 }`
- `.vercelignore`: `dev-server.js`
- URL: https://dindin-nine.vercel.app

### Commits relevantes
- Arquitetura inicial multi-página
- Visual dark/purple neon
- Cartão de crédito com parcelas
- Integração cartão → transações → fixos
- Lista de desejos com Microlink API
- Fix: redeclaração de `gastosFixos` (bug crítico)

---

## 10. Status Atual

### ✅ Funcional
- [x] Dashboard (visão geral)
- [x] Transações (entrada/saída)
- [x] Gastos Fixos com toggle pago/não-pago
- [x] Salário com modal automático e histórico
- [x] Cartão de crédito com parcelas e fatura mensal
- [x] Integração cartão → transações
- [x] Integração cartão → gastos fixos (toggle "É fixo?")
- [x] Carteiras de investimento (depositar/retirar)
- [x] Lista de desejos com Microlink API
- [x] Cotação do dólar em tempo real
- [x] Dark theme purple neon
- [x] Deploy no Vercel

### 🔜 Pendente / A melhorar
- [ ] Paleta de cores — usuário disse "não gostei das cores, mas por enquanto seguimos assim" (revisar futuramente)
- [ ] Vercel pode precisar de redeploy manual se o último push não tiver sido aplicado ainda (ir ao dashboard Vercel → Redeploy)
- [ ] Possível: exportar dados (JSON) para backup
- [ ] Possível: filtros avançados em transações (por categoria, período)
- [ ] Possível: gráficos de evolução financeira

---

## 11. Instrução para nova sessão do Claude

Ao retomar o projeto em uma nova conta:

1. **Leia este arquivo primeiro** — ele contém todo o contexto
2. **Nunca redeclare variáveis globais de `app.js`** em outros módulos JS
3. **Para testar localmente**: `node dev-server.js` → http://localhost:3000
4. **Para fazer deploy**: `git push origin main` (Vercel faz o resto automaticamente)
5. **Repositório**: https://github.com/hitalorosa/dindin
6. **Paleta dark purple neon** — manter consistência visual

O projeto usa apenas HTML + CSS + JS puro. Sem npm install, sem bundlers, sem frameworks.
