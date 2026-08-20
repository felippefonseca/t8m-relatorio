import crypto from "node:crypto";

const dashboardCache = new Map();
const dashboardCacheTtlMs = Number(process.env.DASHBOARD_CACHE_TTL_MS || 30000);

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
    const liveOptions = { ...options, accessToken, adAccountId };
    const cacheKey = dashboardCacheKey(liveOptions);
    const cached = getCachedDashboard(cacheKey);
    if (cached) return cached;

    const data = await getMetaDashboardData(liveOptions);
    setCachedDashboard(cacheKey, data);
    return data;
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

export async function getAdPreviewData(options = {}) {
  const accessToken = options.accessToken || process.env.META_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Credenciais da Meta Ads ausentes.");

  const previewUrl = await fetchAdPreviewUrl(
    { id: options.adId, creativeId: options.creativeId },
    { accessToken }
  );

  if (!previewUrl) {
    throw new Error("A Meta nao liberou preview para este anuncio.");
  }

  return { previewUrl };
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
    "is_prepay_account",
    "spend_cap",
    "timezone_name"
  ].join(",");

  const account = await graphFetch(`/${accountId}`, { fields: accountFields }, options);
  const currency = account.currency || currencyFallback;
  const campaigns = await fetchCampaignsWithInsights(accountId, currency, range, options);
  const adsResult = await fetchAdsWithInsights(accountId, currency, range, options, campaigns);
  const spend = campaigns.reduce((sum, campaign) => sum + campaign.spendRaw, 0);
  const results = campaigns.reduce((sum, campaign) => sum + campaign.resultCount, 0);
  const amountSpent = metaMinorToNumber(account.amount_spent, currency);
  const spendCap = metaMinorToNumber(account.spend_cap, currency);
  const balance = metaMinorToNumber(account.balance, currency);
  const financeAlertThreshold = Number(process.env.FINANCE_ALERT_THRESHOLD || 100);
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
      balanceLabel: account.is_prepay_account
        ? "Campo financeiro retornado pela Meta"
        : "Campo de cobranca retornado pela Meta",
      balanceLow: balance !== null && balance <= financeAlertThreshold,
      balanceAlertThreshold: moneyPayload(financeAlertThreshold, currency),
      amountSpent: moneyPayload(amountSpent, currency),
      spendCap: moneyPayload(spendCap, currency),
      remainingCap: moneyPayload(remainingCap, currency),
      isPrepay: Boolean(account.is_prepay_account),
      spendCapConfigured: Boolean(spendCap && spendCap > 0)
    },
    summary: {
      activeCampaigns: campaigns.length,
      spendToday: moneyPayload(spend, currency),
      resultsToday: results,
      impressionsToday: campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0),
      clicksToday: campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
    },
    campaigns,
    ads: adsResult.ads,
    warnings: adsResult.warning ? [adsResult.warning] : []
  };
}

async function fetchCampaignsWithInsights(accountId, currency, range, options) {
  const campaignRows = await fetchCampaignRows(accountId, range, options);
  const insightRows = await fetchCampaignInsights(accountId, range, options);
  const campaignsById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const deliveredInsights = insightRows.filter((row) => insightHasDelivery(row));
  const insightsById = new Map(deliveredInsights.map((row) => [row.campaign_id, row]));
  const ids = new Set(insightsById.keys());

  if (range.key === "today") {
    campaignRows
      .filter((campaign) => campaign.effective_status === "ACTIVE")
      .forEach((campaign) => ids.add(campaign.id));
  }

  return [...ids]
    .map((id) => mapCampaign(campaignsById.get(id), insightsById.get(id), currency))
    .filter((campaign) => range.key === "today" || campaign.spendRaw > 0)
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
    limit: "250"
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
    limit: "250"
  };

  if (range.timeRange) {
    params.time_range = JSON.stringify(range.timeRange);
  } else {
    params.date_preset = range.datePreset;
  }

  return fetchAllPages(`/${accountId}/insights`, params, options);
}

async function fetchAdsWithInsights(accountId, currency, range, options, campaigns) {
  if (!campaigns.length) return { ads: [], warning: "" };

  try {
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const insightRows = await fetchAdInsights(accountId, range, options);
    let adRows = [];
    let warning = "";
    try {
      adRows = await fetchAdRows(accountId, range, options);
    } catch (error) {
      warning =
        "Alguns detalhes visuais dos criativos nao vieram da Meta, mas os anuncios com performance foram carregados.";
    }
    const adRowsById = new Map(adRows.map((ad) => [ad.id, ad]));
    const deliveredInsights = insightRows.filter(
      (row) => insightHasDelivery(row) && campaignById.has(row.campaign_id)
    );
    const insightsById = new Map(deliveredInsights.map((row) => [row.ad_id, row]));
    const ids = new Set(insightsById.keys());

    adRows
      .filter((ad) => campaignById.has(ad.campaign_id))
      .filter((ad) => range.key !== "today" || ad.effective_status === "ACTIVE")
      .forEach((ad) => ids.add(ad.id));

    const ads = [...ids]
      .map((id) => mapAd(adRowsById.get(id), insightsById.get(id), campaignById, currency))
      .filter((ad) => ad.id)
      .sort((a, b) => b.spendRaw - a.spendRaw || b.resultCount - a.resultCount)
      .slice(0, 80);

    return { ads, warning };
  } catch (error) {
    return {
      ads: [],
      warning:
        error.message ||
        "Nao foi possivel carregar os anuncios agora, mas os dados de campanha estao disponiveis."
    };
  }
}

async function fetchAdRows(accountId, range, options) {
  const fields = [
    "id",
    "name",
    "status",
    "effective_status",
    "campaign_id",
    "adset_id",
    "preview_shareable_link",
    "updated_time",
    "campaign{id,name,objective}",
    "creative{id,name,title,body,thumbnail_url,image_url,link_url,call_to_action_type,object_story_spec}"
  ].join(",");

  const params = {
    fields,
    limit: "250"
  };

  if (range.key === "today") {
    params.filtering = JSON.stringify([
      { field: "effective_status", operator: "IN", value: ["ACTIVE"] }
    ]);
  }

  return fetchAllPages(`/${accountId}/ads`, params, options);
}

async function fetchAdInsights(accountId, range, options) {
  const params = {
    level: "ad",
    fields: [
      "ad_id",
      "ad_name",
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
    limit: "250"
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

function mapAd(ad = {}, insights = {}, campaignById, currency) {
  const campaign = campaignById.get(ad.campaign_id || insights.campaign_id) || ad.campaign || {};
  const creative = ad.creative || {};
  const spendRaw = numberOrZero(insights.spend);
  const impressions = Math.round(numberOrZero(insights.impressions));
  const clicks = Math.round(numberOrZero(insights.clicks));
  const ctr = numberOrZero(insights.ctr);
  const objective = campaign.objective || ad.campaign?.objective || "Sem objetivo informado";
  const resultMetric = getResultMetric(insights.actions || [], objective);
  const resultCount = resultMetric.count;
  const story = creative.object_story_spec || {};
  const linkData = story.link_data || {};
  const videoData = story.video_data || {};
  const photoData = story.photo_data || {};

  return {
    id: ad.id || insights.ad_id,
    name: ad.name || insights.ad_name || "Anuncio sem nome",
    status: ad.effective_status || ad.status || "HISTORICO",
    campaignId: ad.campaign_id || insights.campaign_id || campaign.id || "",
    campaignName: campaign.name || insights.campaign_name || "Campanha sem nome",
    objective,
    creativeId: creative.id || "",
    headline: creative.title || linkData.name || videoData.title || creative.name || "",
    text: creative.body || linkData.message || videoData.message || photoData.caption || "",
    callToAction: creative.call_to_action_type || linkData.call_to_action?.type || "",
    destinationUrl: creative.link_url || linkData.link || "",
    thumbnailUrl: creative.thumbnail_url || creative.image_url || linkData.picture || "",
    previewUrl: ad.preview_shareable_link || "",
    spendToday: moneyPayload(spendRaw, currency),
    spendRaw,
    resultCount,
    resultLabel: resultMetric.label,
    costPerResult: moneyPayload(resultCount > 0 ? spendRaw / resultCount : null, currency),
    impressions,
    reach: Math.round(numberOrZero(insights.reach)),
    clicks,
    ctr: `${ctr.toFixed(2)}%`,
    cpc: moneyPayload(numberOrNull(insights.cpc), currency),
    cpm: moneyPayload(numberOrNull(insights.cpm), currency),
    updatedTime: ad.updated_time || null
  };
}

async function fetchAdPreviewUrl(ad, options) {
  const params = {
    fields: "body",
    ad_format: "MOBILE_FEED_STANDARD"
  };

  const candidates = [ad.id, ad.creativeId].filter(Boolean);

  for (const id of candidates) {
    try {
      const preview = await graphFetch(`/${id}/previews`, params, options);
      const body = preview.data?.[0]?.body || "";
      const src = extractIframeSrc(body);
      if (src) return src;
    } catch {
      // Some creative formats do not expose previews with this placement.
    }
  }

  return "";
}

function extractIframeSrc(html = "") {
  const match = String(html).match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1]) : "";
}

function decodeHtmlEntities(value = "") {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function insightHasDelivery(row = {}) {
  return (
    numberOrZero(row.spend) > 0 ||
    numberOrZero(row.impressions) > 0 ||
    totalActions(row.actions || []) > 0
  );
}

function totalActions(actions) {
  return actions.reduce((sum, action) => sum + numberOrZero(action.value), 0);
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
    last_7d: "Últimos 7 dias",
    last_30d: "Últimos 30 dias",
    this_month: "Este mês",
    last_month: "Mês passado"
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
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(Number(process.env.META_FETCH_TIMEOUT_MS || 12000))
    });
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new Error("A Meta demorou para responder. Tente atualizar novamente.");
    }
    throw error;
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      json.error?.message ||
      `Erro ${response.status} ao consultar a API da Meta Ads.`;
    throw new Error(message);
  }

  return json;
}

function dashboardCacheKey(options) {
  return crypto
    .createHash("sha256")
    .update(
      [
        options.accessToken || "",
        normalizeAdAccountId(options.adAccountId || ""),
        options.datePreset || "",
        options.since || "",
        options.until || ""
      ].join("|")
    )
    .digest("hex");
}

function getCachedDashboard(key) {
  const cached = dashboardCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > dashboardCacheTtlMs) {
    dashboardCache.delete(key);
    return null;
  }
  return cloneJson(cached.data);
}

function setCachedDashboard(key, data) {
  dashboardCache.set(key, { createdAt: Date.now(), data: cloneJson(data) });
  if (dashboardCache.size > 30) {
    const oldestKey = dashboardCache.keys().next().value;
    dashboardCache.delete(oldestKey);
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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
  const visibleCampaigns = campaigns.filter(
    (campaign) => range.key === "today" || campaign.spendRaw > 0
  );

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
      balanceLabel: "Campo financeiro retornado pela Meta",
      balanceLow: false,
      balanceAlertThreshold: moneyPayload(100, currency),
      amountSpent: moneyPayload(9750, currency),
      spendCap: moneyPayload(11000, currency),
      remainingCap: moneyPayload(1250, currency),
      isPrepay: true,
      spendCapConfigured: true
    },
    summary: {
      activeCampaigns: visibleCampaigns.length,
      spendToday: moneyPayload(
        visibleCampaigns.reduce((sum, campaign) => sum + campaign.spendRaw, 0),
        currency
      ),
      resultsToday: visibleCampaigns.reduce((sum, campaign) => sum + campaign.resultCount, 0),
      impressionsToday: visibleCampaigns.reduce((sum, campaign) => sum + campaign.impressions, 0),
      clicksToday: visibleCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
    },
    campaigns: visibleCampaigns,
    ads: visibleCampaigns.map((campaign, index) => makeDemoAd(campaign, index, currency)),
    warnings: []
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

function makeDemoAd(campaign, index, currency) {
  const spend = roundMoney(campaign.spendRaw * (index % 2 === 0 ? 0.62 : 0.38));
  const results = Math.max(Math.round(campaign.resultCount * (index % 2 === 0 ? 0.6 : 0.4)), 0);

  return {
    id: `${campaign.id}${index + 1}`,
    name: index % 2 === 0 ? "Criativo principal | WhatsApp" : "Video curto | Prova social",
    status: campaign.status,
    campaignId: campaign.id,
    campaignName: campaign.name,
    objective: campaign.objective,
    creativeId: "",
    headline: index % 2 === 0 ? "Energia solar para reduzir a conta" : "Clientes T8M em destaque",
    text:
      index % 2 === 0
        ? "Simule sua economia e fale com a equipe T8M."
        : "Veja como a T8M acompanha o projeto do começo ao fim.",
    callToAction: "WHATSAPP_MESSAGE",
    destinationUrl: "",
    thumbnailUrl: "",
    previewUrl: "",
    spendToday: moneyPayload(spend, currency),
    spendRaw: spend,
    resultCount: results,
    resultLabel: campaign.resultLabel,
    costPerResult: moneyPayload(results > 0 ? spend / results : null, currency),
    impressions: Math.round(campaign.impressions * 0.58),
    reach: Math.round(campaign.reach * 0.58),
    clicks: Math.round(campaign.clicks * 0.58),
    ctr: campaign.ctr,
    cpc: campaign.cpc,
    cpm: campaign.cpm,
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
