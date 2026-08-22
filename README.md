# Painel Meta Ads | T8M Energia Solar

Painel privado para a T8M acompanhar investimento, campanhas com entrega, anuncios em veiculacao, historico de performance e campos financeiros retornados pelo Meta Ads.

Ele usa a identidade dos relatorios antigos: fundo escuro, laranja T8M, cards compactos e tabela de performance.

## Visual do painel

O painel usa uma estrutura inspirada no `dashboard-01` do shadcn: navegacao lateral, blocos executivos, tabelas densas e leitura rapida para o dono acompanhar o que importa sem abrir o Gerenciador de Anuncios.

Como o projeto atual e HTML/JS direto, sem React, Tailwind e `components.json`, os comandos `npx shadcn@latest add dashboard-01` e `npx shadcn@latest add @componentry/magnetic-dock` nao sao aplicados diretamente. O comportamento do dock magnetico foi implementado em JavaScript nativo para manter a publicacao da Vercel e a conexao do Meta funcionando sem migrar a base.

## Como rodar localmente

1. Copie `.env.example` para `.env`.
2. Ajuste `CLIENT_USERNAME`, `CLIENT_PASSWORD` e `SESSION_SECRET`.
3. Preencha `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID` com os dados da conta de anuncios da T8M, ou configure o conector OAuth.
4. Rode:

```bash
npm start
```

O painel abre em `http://localhost:4173`.

## Dados reais da conta da T8M

O painel consulta a conta configurada em `META_AD_ACCOUNT_ID`. O ID pode ser informado com ou sem `act_`.

O token da Meta deve ter acesso de leitura a essa conta de anuncios e permissao para consultar campanhas e insights. Para leitura, o escopo principal e `ads_read`; `business_management` ajuda a listar contas do Business Manager. Em producao, defina:

```bash
DEMO_MODE=false
```

Assim, se a credencial falhar, o painel mostra erro em vez de dados ficticios.

Observacao sobre financeiro: os campos `balance`, `spend_cap` e `amount_spent` sao retornados pela API da Meta, mas `balance` pode representar cobranca/faturamento e nao necessariamente o saldo disponivel visto no Gerenciador de Anuncios. Por isso o painel exibe esse bloco como "Financeiro Meta" e nao como saldo real confirmado.
Quando esse campo vem abaixo do limite de seguranca configurado, o painel mostra "Recarregar conta" para evitar que a midia pare. O limite padrao e R$ 100,00 e pode ser ajustado com:

```bash
FINANCE_ALERT_THRESHOLD=100
```

## Historico

O seletor de periodo no painel permite carregar:

- Hoje
- Ontem
- Ultimos 7 dias
- Ultimos 30 dias
- Este mes
- Mes passado
- Intervalo personalizado

Para historico, a API muda o periodo enviado ao Meta Ads usando `date_preset` ou `time_range`.
Nos recortes historicos, a lista mostra apenas campanhas e anuncios que tiveram entrega/gasto no periodo, evitando que campanhas antigas sem movimento poluam o painel.

O relatorio antigo de 15 a 24 de junho de 2026 tambem fica preservado no painel em:

```text
/relatorio-15-24-jun.html
```

## Conector Meta Ads

O sistema ja tem rotas prontas para OAuth:

- `/api/meta/status`
- `/api/meta/connect`
- `/api/meta/callback`
- `/api/meta/accounts`
- `/api/meta/disconnect`

Para ativar o botao "Conectar Meta", configure:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`

No app da Meta, cadastre a URL de callback:

```text
https://seu-dominio.vercel.app/api/meta/callback
```

Se `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID` estiverem definidos no servidor, o painel usa essas credenciais diretamente e bloqueia a conta no servidor. Se nao estiverem, o conector OAuth permite conectar e selecionar a conta de anuncios pelo painel.

## Publicar na Vercel

O projeto ja inclui `vercel.json` e rotas seguras em `/api`.

No painel da Vercel, configure as variaveis:

- `CLIENT_USERNAME`
- `CLIENT_PASSWORD`
- `SESSION_SECRET`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `META_API_VERSION`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `DEMO_MODE=false`

Depois publique normalmente. A pasta `public/` vira a interface e `api/` fica responsavel por login e dados da Meta.

## Campos usados

- Conta: `name`, `account_status`, `amount_spent`, `balance`, `currency`, `spend_cap`, `timezone_name`.
- Campanhas: campanhas com `effective_status=ACTIVE`.
- Periodo selecionado: `spend`, `impressions`, `reach`, `clicks`, `ctr`, `cpc`, `cpm`, `actions`.
- Anuncios: `name`, `effective_status`, `campaign_id`, `campaign`, `creative`, `preview_shareable_link`.
- Historico de anuncios: a listagem prioriza os insights do periodo, entao anuncios com gasto/entrega aparecem mesmo quando a Meta nao retorna todos os detalhes de criativo.
- Preview: o sistema usa o link compartilhavel quando a Meta retorna. Quando nao retorna, o painel tenta consultar `/previews` com `MOBILE_FEED_STANDARD` somente no clique do usuario para nao deixar a troca de periodo lenta.
