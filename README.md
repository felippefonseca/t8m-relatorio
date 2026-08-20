# Painel Meta Ads | T8M Energia Solar

Painel privado para a T8M acompanhar saldo da conta de anuncios, campanhas com entrega, anuncios em veiculacao e historico de performance no Meta Ads.

Ele usa a identidade dos relatorios antigos: fundo escuro, laranja T8M, cards compactos e tabela de performance.

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
- Preview: o sistema tenta usar o link compartilhavel do anuncio e, quando necessario, consulta `/previews` com `MOBILE_FEED_STANDARD`.
