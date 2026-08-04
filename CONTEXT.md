# 📁 CONTEXT.md — Planejador (estado do projeto)

> Documento de contexto para retomar o projeto em qualquer sessão.
> Última atualização: 2026-07-20
> Projeto anterior (arquivado): ver `CONTEXT-Dindin.md`

---

## 1. O que é

**Planejador — Meu mês financeiro.** App de **planejamento financeiro mensal**, simples e direto ao ponto. Substituiu o antigo "Dindin" (que era complexo demais: 7 páginas, cartão, investimentos, desejos).

O foco agora é **um mês por vez**: o que tenho **a receber** e **a pagar**, marcando o que já aconteceu, com **saldo projetado** na cara. Uso diário no PC e no celular.

## 2. Decisões de arquitetura (definidas com o Hitalo)

| Decisão | Escolha | Por quê |
|---------|---------|---------|
| Persistência | **`localStorage`** (local no aparelho) | Zero setup, funciona offline. Sem backend. |
| Sincronização PC ↔ celular | **Manual**, via Exportar/Importar `.json` | Ele escolheu simplicidade em vez de nuvem. |
| Acesso | **URL publicada no Vercel** + **PWA** instalável | Usar de qualquer lugar, instalar no celular, offline. |
| Stack | HTML + CSS + **JS puro** | Sem frameworks, sem build, sem `npm install`. |

## 3. Stack e estrutura

- **1 tela** (`index.html`) — SPA simples, sem navegação entre páginas.
- `css/style.css` — design claro/escuro (variáveis CSS + `prefers-color-scheme` + toggle `data-theme`). **Nada de neon roxo** (o Hitalo não curtiu no projeto antigo) — agora é indigo sóbrio + verde/vermelho semânticos.
- `js/app.js` — toda a lógica (sem módulos; funções globais).
- `manifest.json` + `sw.js` + `icon.svg`/`icon-192.png`/`icon-512.png` — camada PWA.
- `dev-server.js` — servidor estático Node p/ rodar local (`node dev-server.js` → localhost:3000). Necessário porque SW não roda em `file://`.
- `vercel.json` — deploy estático (headers no-cache p/ `sw.js` e `manifest.json`).

## 4. Modelo de dados (`localStorage['planejador_v1']`)

```js
{
  version: 1,
  config: { tema: 'auto' | 'light' | 'dark' },
  fixos: [ { id, descricao, valor, tipo, categoria, dia, desde: 'YYYY-MM' } ],
  meses: {
    'YYYY-MM': {
      lancamentos: [ { id, fixoId, descricao, valor, tipo:'entrada'|'saida', categoria, dia, status:'previsto'|'ok' } ],
      removidos: [ fixoId ]
    }
  }
}
```

### Regras importantes de lógica
- **Recorrentes (`fixos`)** são "materializados" em cada mês aberto (`garantirMes` / `materializarFixos`): viram um `lancamento` com `fixoId`. Editar/marcar a instância NÃO afeta os outros meses.
- **Excluir recorrente** dá 3 opções: só deste mês (adiciona ao array `removidos` p/ não re-materializar) ou parar de repetir (remove o `fixo`).
- `parseValor` aceita formato pt-BR (`1.150,00`), US (`1150.00`) e simples.
- `status: 'ok'` = já realizado (recebido/pago). Alimenta a barra de "realizado".

## 5. Rodar / Deploy

```bash
node dev-server.js         # http://localhost:3000
git push origin main       # deploy automático Vercel
```

## 6. Status

### ✅ Pronto e testado
- [x] Meses navegáveis + botão "mês atual"
- [x] Adicionar/editar/excluir entradas e saídas (valor, dia, categoria)
- [x] Recorrentes com materialização por mês (testado: julho→agosto)
- [x] Marcar previsto/realizado + barra de progresso
- [x] Saldo projetado, a receber, a pagar
- [x] Copiar itens do mês anterior
- [x] Exportar/Importar backup `.json`
- [x] Reset total
- [x] Tema claro/escuro (auto/manual)
- [x] PWA (manifest + SW offline + ícones)

### 🔜 Ideias futuras (não pedidas ainda)
- [ ] Gráfico de evolução dos meses
- [ ] Categorias com totais/resumo
- [ ] Metas de economia
- [ ] Se um dia quiser sincronizar de verdade: migrar `localStorage` → Supabase (decisão adiada de propósito)

## 6.1 ⚠️ REGRAS DURAS DA v2 (não quebrar, nunca)

```
1. 4 ABAS É O TETO. Nenhuma aba nova. Toda feature futura cabe dentro de
   Mês / Guardar / Dívidas / Desejos, ou é recusada. (O Dindin morreu de 7 telas.)

2. app.js declara TODAS as globais. Os outros .js contêm SOMENTE funções.
   Nenhum let/const/var em escopo de arquivo fora do app.js (bug c333d62:
   SyntaxError silencioso que quebra a página inteira).
   Cada arquivo tem seu próprio 'use strict' (script clássico não herda).

3. Nenhum saldo é armazenado. Carteira, dívida e "livre" são SEMPRE derivados.
   Uma fonte da verdade por dado.

4. Separação NUNCA entra em entrPrev/saidPrev — guardar não é despesa.
   Parcela de dívida SEMPRE entra — esse dinheiro sai da conta de verdade.
   calcular() não muda. livre = saldoProjetado − separadoNoMes.

5. salvar() sempre com try/catch. importar() sempre chama migrar().

6. sw.js: js/ e css/ são servidos REDE-PRIMEIRO (cache só como fallback offline).
   Ainda assim, bump o CACHE a cada deploy que mude código.

7. O app NÃO dá conselho financeiro. A % é meta DELE (nasce 0).
   Zero juros, zero CET, zero ranking de qual dívida quitar primeiro.

8. Progressive disclosure: sem dívida, sem carteira e sem pct, a tela Mês é
   pixel a pixel a de antes. O app só cresce na medida em que ele usa.

9. Desejos: preço SEMPRE digitado à mão (nunca de scraping). Imagem só por URL,
   nunca base64. Falha do microlink é silenciosa, form continua funcional.

10. Nunca renderizar Infinity/NaN na tela. ritmo <= 0 -> "sem ritmo definido".
```

## 6.2 Estrutura de arquivos v2

```
index.html            ← única página, 4 <section class="view">
css/style.css         ← design system + blocos da v2
js/app.js             ← ÚNICO com globais: estado, migração, rotas, calcular(), garantirMes()
js/mes.js             ← aba Mês + o disparo do gatilho no toggleStatus
js/carteiras.js       ← aba Guardar (carteiras + orçamento) + folha de sugestão
js/dividas.js         ← aba Dívidas (ehDivida/parcelaNoMes são chamadas pelo app.js)
js/desejos.js         ← aba Desejos + microlink
sw.js                 ← rede-primeiro pra código, cache-first pro resto
```

Blueprint completo com as 24 correções do painel, todas as fórmulas verificadas
(97 asserções em Node) e as 22 armadilhas: gerado em 2026-08-03, resumido aqui.

## 7. Deploy/repo

- Deploy: Vercel (mesmo fluxo do Dindin). Confirmar com o Hitalo se mantém o repo `hitalorosa/dindin` ou cria um novo (ex: `planejador`).
