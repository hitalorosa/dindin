# 💰 Planejador — Meu mês financeiro

App simples de **planejamento financeiro mensal**. Você lança tudo que tem **a receber** (salário, freelas, rendimentos) e tudo que tem **a pagar/sair** no mês, marca o que já aconteceu, e vê na hora o **saldo projetado**.

> Feito pra usar todo dia — no computador e no celular. Sem burocracia.

---

## ✨ O que ele faz

- **Um mês por vez** — navegue entre meses (‹ ›) e planeje cada um.
- **Entradas e saídas** — com valor, dia do vencimento/recebimento e categoria.
- **Saldo projetado** — quanto vai sobrar (ou faltar) se tudo acontecer.
- **Previsto × realizado** — marque cada item conforme recebe/paga; a barra mostra o quanto do mês já rolou.
- **Recorrentes** — marque "repetir todo mês" e salário/aluguel/assinaturas aparecem sozinhos nos próximos meses.
- **Copiar do mês anterior** — repita a lista do mês passado com um toque.
- **Backup** — exporte/importe um arquivo `.json` (também é como você leva os dados do PC pro celular).
- **PWA** — instala como app na tela do celular e funciona **offline**.
- **Tema claro/escuro** — automático ou manual.

---

## 🗂️ Estrutura

```
Financeiro/
├── index.html          ← a única tela do app
├── css/style.css       ← visual (claro + escuro)
├── js/app.js           ← toda a lógica
├── manifest.json       ← configuração PWA
├── sw.js               ← service worker (offline)
├── icon.svg            ← ícone vetorial
├── icon-192.png        ← ícone PWA
├── icon-512.png        ← ícone PWA (instalação)
├── dev-server.js       ← servidor local p/ desenvolvimento
├── vercel.json         ← config de deploy
└── package.json
```

## 🧠 Como os dados são guardados

- Tudo fica no **`localStorage` do próprio aparelho** — nenhum dado sai do seu navegador, sem conta, sem servidor.
- Como é por aparelho, **PC e celular têm dados separados**. Para sincronizar: **Menu ☰ → Exportar** no aparelho A e **Importar** no aparelho B.
- Chave usada no localStorage: `planejador_v1`.

### Modelo de dados
```js
{
  version: 1,
  config: { tema: 'auto' | 'light' | 'dark' },
  fixos: [ { id, descricao, valor, tipo, categoria, dia, desde: 'YYYY-MM' } ],
  meses: {
    'YYYY-MM': {
      lancamentos: [ { id, fixoId, descricao, valor, tipo:'entrada'|'saida', categoria, dia, status:'previsto'|'ok' } ],
      removidos: [ fixoId ]   // recorrentes apagados só naquele mês
    }
  }
}
```
Os **recorrentes** (`fixos`) são "materializados" em cada mês que você abre — viram um lançamento normal com `fixoId`, que dá pra editar/marcar sem afetar os outros meses.

---

## 🚀 Rodar localmente

Precisa de um servidor HTTP (o service worker não roda via `file://`):

```bash
node dev-server.js
# abre em http://localhost:3000
```

## ☁️ Deploy (Vercel)

Site estático — o Vercel serve direto. A cada `git push` na `main`, deploy automático.

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

---

## 📲 Instalar no celular

1. Abra a URL do app no navegador do celular.
2. **Android/Chrome:** menu → *Instalar app* / *Adicionar à tela inicial*.
3. **iPhone/Safari:** botão compartilhar → *Adicionar à Tela de Início*.

Pronto: vira um app com ícone próprio e abre em tela cheia, offline.

---

*HTML + CSS + JavaScript puro. Sem frameworks, sem build, sem `npm install`.*
