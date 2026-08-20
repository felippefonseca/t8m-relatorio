export async function getDashboardData(options = {}) {
  const accessToken = options.accessToken || process.env.META_ACCESS_TOKEN;
  const adAccountId = options.adAccountId || process.env.META_AD_ACCOUNT_ID;
  const hasMetaConfig = Boolean(accessToken && adAccountId);

  if (!hasMetaConfig) {
    if (process.env.DEMO_MODE === "false") {
      throw new Error("Credenciais da Meta Ads ausentes.");
    }
    return getDemoData(options);
  }

  try {
    return await getMetaDashboardData({ ...options, accessToken, adAccountId });
  } catch (error) {
    if (process.env.DEMO_MODE === "false") throw error;

    const demo = getDemoData(options);
    demo.source = {
      mode: "demo",
      label: "Demonstracao",
      detail: "A conexao com a Meta falhou; exibindo dados ficticios."
    };
    demo.error = error.message;
    return demo;
  }
}

async function getMetaDashboardData(options) {
  const currencyFallback = "BRL";
  const accountId = normalizeAdAccountId(options.adAccountId);
  const range = normalizeRange(options);
  const accountFields = [
    "id",
    "name",
    "account_id",
    "account_status",
    "amount_spent",
    "balance",
    "currency",
    "spend_cap",
    "timezone_name"
  ].join(",");

  const account = await graphFetch(`/${accountId}`, { fields: accountFields }, options);
  const currency = account.currency || currencyFallback;
  const campaigns = await fetchCampaignsWithInsights(accountId, currency, range, options);
  const spend = campaigns.reduce((sum, campaign) => sum + campaign.spendRaw, 0);
  const results = campaigns.reduce((sum, campaign) => sum + campaign.resultCount, 0);
  const amountSpent = metaMinorToNumber(account.amount_spent, currency);
  const spendCap = metaMinorToNumber(account.spend_cap, currency);
  const balance = metaMinorToNumber(account.balance, currency);
  const remainingCap =
    spendCap && spendCap > 0 && amountSpent !== null
      ? Math.max(spendCap - amountSpent, 0)
      : null;

  return {
    source: {
      mode: "live",
      label: "Meta Ads | T8M",
      detail: "Dados atualizados pela API da Meta para a conta configurada."
    },
    period: range,
    updatedAt: new Date().toISOString(),
    account: {
      id: account.id,
      name: account.name || "T8M Energia Solar",
      status: accountStatusLabel(account.account_status),
      currency,
      timezone: account.timezone_name || "UTC",
      balance: moneyPayload(balance, currency),
      amountSpent: moneyPayload(amountSpent, currency),
      spendCap: moneyPayload(spendCap, currency),
      remainingCap: moneyPayload(remainingCap, currency)
    },
    summary: {
      activeCampaigns: campaigns.length,
      spendToday: moneyPayload(spend, currency),
      resultsToday: results,
      impressionsToday: campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0),
      clicksToday: campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
    },
    campaigns
  };
}

async function fetchCampaignsWithInsights(accountId, currency, range, options) {
  const campaignRows = await fetchCampaignRows(accountId, range, options);
  const insightRows = await fetchCampaignInsights(accountId, range, options);
  const campaignsById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const insightsById = new Map(insightRows.map((row) => [row.campaign_id, row]));
  const ids = new Set([...campaignsById.keys(), ...insightsById.keys()]);

  return [...ids]
    .map((id) => mapCampaign(campaignsById.get(id), insightsById.get(id), currency))
    .sort((a, b) => b.spendRaw - a.spendRaw);
}

async function fetchCampaignRows(accountId, range, options) {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "objective",
    "daily_budget",
    "lifetime_budget",
    "budget_remaining",
    "start_time",
    "stop_time",
    "updated_time"
  ].join(",");

  const params = {
    fields,
    filtering: JSON.stringify([
      { field: "effective_status", operator: "IN", value: statusFilterForRange(range) }
    ]),
    limit: "100"
  };

  return fetchAllPages(`/${accountId}/campaigns`, params, options);
}

async function fetchCampaignInsights(accountId, range, options) {
  const params = {
    level: "campaign",
    fields: [
      "campaign_id",
      "campaign_name",
      "spend",
      "impressions",
      "reach",
      "clicks",
      "ctr",
      "cpc",
      "cpm",
      "actions"
    ].join(","),
    filtering: JSON.stringify([
      {
        field: "campaign.effective_status",
        operator: "IN",
        value: statusFilterForRange(range)
      }
    ]),
    limit: "100"
  };

  if (range.timeRange) {
    params.time_range = JSON.stringify(range.timeRange);
  } else {
    params.date_preset = range.datePreset;
  }

  return fetchAllPages(`/${accountId}/insights`, params, options);
}

async function fetchAllPages(endpoint, params, options) {
  const rows = [];
  let page = await graphFetch(endpoint, params, options);
  rows.push(...(page.data || []));

  let guard = 0;
  while (page.paging?.next && guard < 5) {
    page = await fetchUrl(page.paging.next);
    rows.push(...(page.data || []));
    guard += 1;
  }

  return rows;
}

function mapCampaign(campaign = {}, insights = {}, currency) {
  const budgetRaw = campaign.daily_budget || campaign.lifetime_budget || null;
  const spendRaw = numberOrZero(insights.spend);
  const impressions = Math.round(numberOrZero(insights.impressions));
  const clicks = Math.round(numberOrZero(insights.clicks));
  const ctr = numberOrZero(insights.ctr);
  const resultMetric = getResultMetric(insights.actions || [], campaign.objective);
  const resultCount = resultMetric.count;
  const costPerResult = resultCount > 0 ? spendRaw / resultCount : null;

  return {
    id: campaign.id || insights.campaign_id,
    name: campaign.name || insights.campaign_name || "Campanha sem nome",
    status: campaign.effective_status || campaign.status || "HISTORICO",
    objective: campaign.objective || "Sem objetivo informado",
    budgetType: campaign.daily_budget ? "Diario" : campaign.lifetime_budget ? "Total" : "Sem verba",
    budget: moneyPayload(metaMinorToNumber(budgetRaw, currency), currency),
    budgetRemaining: moneyPayload(
      metaMinorToNumber(campaign.budget_remaining, currency),
      currency
    ),
    spendToday: moneyPayload(spendRaw, currency),
    spendTodayRaw: spendRaw,
    spendRaw,
    resultCount,
    resultLabel: resultMetric.label,
    costPerResult: moneyPayload(costPerResult, currency),
    impressions,
    reach: Math.round(numberOrZero(insights.reach)),
    clicks,
    ctr: `${ctr.toFixed(2)}%`,
    cpc: moneyPayload(numberOrNull(insights.cpc), currency),
    cpm: moneyPayload(numberOrNull(insights.cpm), currency),
    startTime: campaign.start_time || null,
    stopTime: campaign.stop_time || null,
    updatedTime: campaign.updated_time || null
  };
}

function normalizeRange(options = {}) {
  if (options.since && options.until) {
    return {
      key: "custom",
      label: `${formatShortDate(options.since)} a ${formatShortDate(options.until)}`,
      timeRange: { since: options.since, until: options.until }
    };
  }

  const preset = allowedDatePresets().has(options.datePreset)
    ? options.datePreset
    : "today";

  return {
    key: preset,
    label: datePresetLabel(preset),
    datePreset: preset
  };
}

function allowedDatePresets() {
  return new Set(["today", "yesterday", "last_7d", "last_30d", "this_month", "last_month"]);
}

function datePresetLabel(preset) {
  const labels = {
    today: "Hoje",
    yesterday: "Ontem",
    last_7d: "Ultimos 7 dias",
    last_30d: "Ultimos 30 dias",
    this_month: "Este mes",
    last_month: "Mes passado"
  };
  return labels[preset] || "Hoje";
}

function statusFilterForRange(range) {
  if (range.key === "today") return ["ACTIVE"];
  return ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED"];
}

function getResultMetric(actions, objective = "") {
  const actionMap = new Map(
    actions.map((action) => [action.action_type, numberOrZero(action.value)])
  );
  const objectiveName = String(objective).toUpperCase();
  const candidates = objectiveName.includes("LEAD")
    ? [
        ["lead", "Leads"],
        ["onsite_conversion.lead_grouped", "Leads"],
        ["offsite_conversion.fb_pixel_lead", "Leads"],
        ["onsite_conversion.messaging_conversation_started_7d", "Conversas"]
      ]
    : objectiveName.includes("SALES") || objectiveName.includes("CONVERSION")
      ? [
          ["purchase", "Compras"],
          ["omni_purchase", "Compras"],
          ["offsite_conversion.fb_pixel_purchase", "Compras"],
          ["lead", "Leads"],
          ["onsite_conversion.messaging_conversation_started_7d", "Conversas"]
        ]
      : [
          ["onsite_conversion.messaging_conversation_started_7d", "Conversas"],
          ["messaging_conversation_started_7d", "Conversas"],
          ["lead", "Leads"],
          ["onsite_conversion.lead_grouped", "Leads"],
          ["link_click", "Cliques no link"]
        ];

  for (const [type, label] of candidates) {
    const value = actionMap.get(type);
    if (value > 0) return { count: Math.round(value), label };
  }

  return { count: 0, label: "Resultados" };
}

async function graphFetch(endpoint, params = {}, options = {}) {
  const version = process.env.META_API_VERSION || "v25.0";
  const url = new URL(`https://graph.facebook.com/${version}${endpoint}`);
  url.searchParams.set("access_token", options.accessToken || process.env.META_ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return fetchUrl(url.toString());
}

export async function graphFetchWithToken(endpoint, params = {}, accessToken) {
  return graphFetch(endpoint, params, { accessToken });
}

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      json.error?.message ||
      `Erro ${response.status} ao consultar a API da Meta Ads.`;
    throw new Error(message);
  }

  return json;
}

function normalizeAdAccountId(value = "") {
  const clean = value.trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

function metaMinorToNumber(value, currency) {
  const number = numberOrNull(value);
  if (number === null) return null;
  const digits = currencyFractionDigits(currency);
  return number / 10 ** digits;
}

function currencyFractionDigits(currency) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function moneyPayload(value, currency) {
  if (value === null || Number.isNaN(value)) {
    return { raw: null, formatted: "Nao informado" };
  }

  return {
    raw: Number(value),
    formatted: new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL"
    }).format(Number(value))
  };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrNull(value) || 0;
}

function accountStatusLabel(status) {
  const labels = {
    1: "Ativa",
    2: "Desativada",
    3: "Com pendencia",
    7: "Em analise",
    8: "Aguardando pagamento",
    9: "Periodo de carencia",
    100: "Fechamento pendente",
    101: "Fechada",
    201: "Ativa",
    202: "Fechada"
  };
  return labels[status] || "Status nao informado";
}

function getDemoData(options = {}) {
  const currency = "BRL";
  const range = normalizeRange(options);
  const factor = periodFactor(range.key);
  const campaigns = [
    makeDemoCampaign({
      currency,
      factor,
      id: "238601234501",
      name: "Kit de Energia Solar | Vale do Aco",
      objective: "OUTCOME_LEADS",
      spend: 87.6,
      results: 9,
      resultLabel: "Leads",
      impressions: 18420,
      reach: 13980,
      clicks: 612,
      ctr: 3.32
    }),
    makeDemoCampaign({
      currency,
      factor,
      id: "238601234502",
      name: "Kit Anti-Apagao | Video",
      objective: "OUTCOME_ENGAGEMENT",
      spend: 48.8,
      results: 7,
      resultLabel: "Conversas",
      impressions: 7620,
      reach: 5110,
      clicks: 298,
      ctr: 3.91
    }),
    makeDemoCampaign({
      currency,
      factor,
      id: "238601234503",
      name: "Seguro Solar | Vale do Aco",
      objective: "OUTCOME_ENGAGEMENT",
      spend: 64.3,
      results: 4,
      resultLabel: "Conversas",
      impressions: 21450,
      reach: 19820,
      clicks: 381,
      ctr: 1.78
    })
  ];

  return {
    source: {
      mode: "demo",
      label: "Demonstracao",
      detail: "Dados ficticios no visual da T8M para validar a experiencia."
    },
    period: range,
    updatedAt: new Date().toISOString(),
    account: {
      id: "act_demo",
      name: "T8M Energia Solar",
      status: "Ativa",
      currency,
      timezone: "America/Sao_Paulo",
      balance: moneyPayload(1250, currency),
      amountSpent: moneyPayload(9750, currency),
      spendCap: moneyPayload(11000, currency),
      remainingCap: moneyPayload(1250, currency)
    },
    summary: {
      activeCampaigns: campaigns.length,
      spendToday: moneyPayload(
        campaigns.reduce((sum, campaign) => sum + campaign.spendRaw, 0),
        currency
      ),
      resultsToday: campaigns.reduce((sum, campaign) => sum + campaign.resultCount, 0),
      impressionsToday: campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0),
      clicksToday: campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
    },
    campaigns
  };
}

function makeDemoCampaign(data) {
  const spend = roundMoney(data.spend * data.factor);
  const results = Math.max(Math.round(data.results * data.factor), data.factor > 1 ? 1 : 0);
  const impressions = Math.round(data.impressions * data.factor);
  const reach = Math.round(data.reach * Math.min(data.factor, 6));
  const clicks = Math.round(data.clicks * data.factor);

  return {
    id: data.id,
    name: data.name,
    status: "ACTIVE",
    objective: data.objective,
    budgetType: "Diario",
    budget: moneyPayload(180, data.currency),
    budgetRemaining: moneyPayload(92.4, data.currency),
    spendToday: moneyPayload(spend, data.currency),
    spendTodayRaw: spend,
    spendRaw: spend,
    resultCount: results,
    resultLabel: data.resultLabel,
    costPerResult: moneyPayload(results > 0 ? spend / results : null, data.currency),
    impressions,
    reach,
    clicks,
    ctr: `${data.ctr.toFixed(2)}%`,
    cpc: moneyPayload(clicks > 0 ? spend / clicks : null, data.currency),
    cpm: moneyPayload(impressions > 0 ? (spend / impressions) * 1000 : null, data.currency),
    startTime: "2026-08-01T08:00:00-0300",
    stopTime: null,
    updatedTime: new Date().toISOString()
  };
}

function periodFactor(key) {
  const factors = {
    today: 1,
    yesterday: 0.82,
    last_7d: 6.4,
    last_30d: 22,
    this_month: 14,
    last_month: 26,
    custom: 5
  };
  return factors[key] || 1;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function formatShortDate(value) {
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}
