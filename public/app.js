const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
const campaignRows = document.querySelector("#campaignRows");
const mobileCampaigns = document.querySelector("#mobileCampaigns");
const adRows = document.querySelector("#adRows");
const mobileAds = document.querySelector("#mobileAds");
const emptyState = document.querySelector("#emptyState");
const adsEmptyState = document.querySelector("#adsEmptyState");
const periodSelect = document.querySelector("#periodSelect");
const customRange = document.querySelector("#customRange");
const sinceDate = document.querySelector("#sinceDate");
const untilDate = document.querySelector("#untilDate");
const applyPeriodButton = document.querySelector("#applyPeriodButton");
const connectMetaButton = document.querySelector("#connectMetaButton");
const disconnectMetaButton = document.querySelector("#disconnectMetaButton");
const connectorStatus = document.querySelector("#connectorStatus");
const connectorHint = document.querySelector("#connectorHint");
const accountPicker = document.querySelector("#accountPicker");
const adAccountSelect = document.querySelector("#adAccountSelect");

const fields = {
  sourceLabel: document.querySelector("#sourceLabel"),
  accountName: document.querySelector("#accountName"),
  accountStatus: document.querySelector("#accountStatus"),
  lastUpdated: document.querySelector("#lastUpdated"),
  balanceValue: document.querySelector("#balanceValue"),
  balanceHint: document.querySelector("#balanceHint"),
  remainingCapValue: document.querySelector("#remainingCapValue"),
  spendCapValue: document.querySelector("#spendCapValue"),
  todaySpendValue: document.querySelector("#todaySpendValue"),
  todayImpressionsValue: document.querySelector("#todayImpressionsValue"),
  activeCampaignsValue: document.querySelector("#activeCampaignsValue"),
  todayResultsValue: document.querySelector("#todayResultsValue"),
  timezoneValue: document.querySelector("#timezoneValue"),
  periodLabel: document.querySelector("#periodLabel"),
  campaignPeriodEyebrow: document.querySelector("#campaignPeriodEyebrow"),
  adsPeriodEyebrow: document.querySelector("#adsPeriodEyebrow"),
  ownerSignalTitle: document.querySelector("#ownerSignalTitle"),
  ownerSignalText: document.querySelector("#ownerSignalText"),
  ownerHealth: document.querySelector("#ownerHealth"),
  ownerSpendPace: document.querySelector("#ownerSpendPace"),
  ownerBestCampaign: document.querySelector("#ownerBestCampaign"),
  ownerBestCampaignHint: document.querySelector("#ownerBestCampaignHint"),
  ownerAttention: document.querySelector("#ownerAttention"),
  ownerAttentionHint: document.querySelector("#ownerAttentionHint"),
  bestCostValue: document.querySelector("#bestCostValue"),
  bestCostHint: document.querySelector("#bestCostHint"),
  zeroResultValue: document.querySelector("#zeroResultValue"),
  zeroResultHint: document.querySelector("#zeroResultHint"),
  topSpendValue: document.querySelector("#topSpendValue"),
  topSpendHint: document.querySelector("#topSpendHint")
};

let selectedAdAccountId = localStorage.getItem("t8m_meta_ad_account_id") || "";
let dashboardRequestId = 0;
let dashboardController = null;

boot();

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const button = loginForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Entrando...";

  try {
    const formData = new FormData(loginForm);
    await request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });
    showDashboard();
    await loadConnectorStatus();
    await loadDashboard();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

refreshButton.addEventListener("click", loadDashboard);
applyPeriodButton.addEventListener("click", loadDashboard);

periodSelect.addEventListener("change", () => {
  customRange.classList.toggle("hidden", periodSelect.value !== "custom");
  if (periodSelect.value !== "custom") loadDashboard();
});

adAccountSelect.addEventListener("change", () => {
  selectedAdAccountId = adAccountSelect.value;
  localStorage.setItem("t8m_meta_ad_account_id", selectedAdAccountId);
  loadDashboard();
});

connectMetaButton.addEventListener("click", async () => {
  connectMetaButton.disabled = true;
  connectMetaButton.textContent = "Conectando...";
  try {
    const response = await request("/api/meta/connect", { method: "POST" });
    window.location.href = response.authorizationUrl;
  } catch (error) {
    connectorHint.textContent = error.message;
  } finally {
    connectMetaButton.disabled = false;
    connectMetaButton.textContent = "Conectar Meta";
  }
});

disconnectMetaButton.addEventListener("click", async () => {
  await request("/api/meta/disconnect", { method: "POST" }).catch(() => null);
  selectedAdAccountId = "";
  localStorage.removeItem("t8m_meta_ad_account_id");
  await loadConnectorStatus();
  await loadDashboard();
});

logoutButton.addEventListener("click", async () => {
  await request("/api/logout", { method: "POST" }).catch(() => null);
  loginForm.reset();
  showLogin();
});

document.addEventListener("click", handlePreviewClick);

async function boot() {
  try {
    const session = await request("/api/session");
    if (session.authenticated) {
      showDashboard();
      await loadConnectorStatus();
      await loadDashboard();
      return;
    }
  } catch {
    // Falls through to login.
  }
  showLogin();
}

async function loadDashboard() {
  dashboardController?.abort();
  dashboardController = new AbortController();
  const requestId = ++dashboardRequestId;
  setDashboardLoading(true);

  try {
    const data = await request(buildDashboardUrl(), { signal: dashboardController.signal });
    if (requestId !== dashboardRequestId) return;
    renderDashboard(data);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== dashboardRequestId) return;
    if (error.status === 401) {
      showLogin();
      loginMessage.textContent = "Sessao expirada.";
      return;
    }
    fields.sourceLabel.textContent = "Indisponivel";
    fields.lastUpdated.textContent = error.message;
    renderDashboardError(error.message);
  } finally {
    if (requestId === dashboardRequestId) setDashboardLoading(false);
  }
}

function renderDashboard(data) {
  const account = data.account;
  const periodLabel = data.period?.label || selectedPeriodLabel();
  fields.sourceLabel.textContent = data.source.label;
  fields.accountName.textContent = account.name;
  fields.accountStatus.textContent = `Conta ${account.status.toLowerCase()}`;
  fields.lastUpdated.textContent = `Atualizado em ${formatDateTime(data.updatedAt)}`;
  fields.balanceValue.textContent = data.source.mode === "live" ? "Conferir no Meta" : account.balance.formatted;
  fields.balanceHint.textContent =
    data.source.mode === "live"
      ? `API retornou ${account.balance.formatted}; pode diferir do saldo visivel no Gerenciador.`
      : "Dados de demonstracao";
  fields.remainingCapValue.textContent = account.spendCapConfigured
    ? account.remainingCap.formatted
    : "Sem limite";
  fields.spendCapValue.textContent = account.spendCapConfigured
    ? `Limite Meta: ${account.spendCap.formatted}`
    : "Nenhum spending cap configurado na conta.";
  fields.todaySpendValue.textContent = data.summary.spendToday.formatted;
  fields.todayImpressionsValue.textContent = `${formatNumber(
    data.summary.impressionsToday
  )} impressoes no periodo`;
  fields.activeCampaignsValue.textContent = String(data.summary.activeCampaigns);
  fields.todayResultsValue.textContent = `${formatNumber(
    data.summary.resultsToday
  )} resultados no periodo`;
  fields.timezoneValue.textContent = account.timezone;
  fields.periodLabel.textContent = periodLabel;
  fields.campaignPeriodEyebrow.textContent = periodLabel;
  fields.adsPeriodEyebrow.textContent = periodLabel;

  renderExecutiveSummary(data, periodLabel);
  renderCampaignRows(data.campaigns);
  renderCampaignCards(data.campaigns);
  renderAdRows(data.ads || []);
  renderAdCards(data.ads || []);
  emptyState.classList.toggle("hidden", data.campaigns.length > 0);
  adsEmptyState.classList.toggle("hidden", (data.ads || []).length > 0);
}

function setDashboardLoading(isLoading) {
  dashboardView.classList.toggle("is-loading", isLoading);
  refreshButton.disabled = isLoading;
  refreshButton.textContent = isLoading ? "Atualizando..." : "Atualizar";
  applyPeriodButton.disabled = isLoading;
  periodSelect.disabled = isLoading;
  sinceDate.disabled = isLoading;
  untilDate.disabled = isLoading;
}

async function loadConnectorStatus() {
  try {
    const status = await request("/api/meta/status");
    const connected = status.connected;
    connectorStatus.classList.toggle("connected", connected);
    connectorStatus.textContent = connected ? "Conectado" : "Nao conectado";
    connectMetaButton.classList.toggle("hidden", connected);
    disconnectMetaButton.classList.toggle("hidden", !connected || status.mode === "server");

    if (connected && status.adAccountLocked) {
      accountPicker.classList.add("hidden");
      connectorHint.textContent = "Credenciais definidas no servidor.";
      return;
    }

    if (connected) {
      connectorHint.textContent = "Selecione a conta de anuncios.";
      await loadAdAccounts();
      return;
    }

    accountPicker.classList.add("hidden");
    connectMetaButton.disabled = !status.appReady;
    connectorHint.textContent = status.appReady
      ? "Pronto para conectar via Meta OAuth."
      : `Configure ${status.missing.join(" e ")}.`;
  } catch {
    connectorStatus.textContent = "Indisponivel";
    connectorHint.textContent = "Nao foi possivel verificar a conexao.";
  }
}

async function loadAdAccounts() {
  const response = await request("/api/meta/accounts");
  const accounts = response.accounts || [];
  accountPicker.classList.toggle("hidden", accounts.length === 0);

  adAccountSelect.innerHTML = accounts
    .map(
      (account) =>
        `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)} (${escapeHtml(
          account.id
        )})</option>`
    )
    .join("");

  if (!accounts.length) {
    connectorHint.textContent = "Nenhuma conta de anuncios encontrada.";
    return;
  }

  if (!selectedAdAccountId || !accounts.some((account) => account.id === selectedAdAccountId)) {
    selectedAdAccountId = accounts[0].id;
    localStorage.setItem("t8m_meta_ad_account_id", selectedAdAccountId);
  }
  adAccountSelect.value = selectedAdAccountId;
}

function buildDashboardUrl() {
  const params = new URLSearchParams();
  const period = periodSelect.value;

  if (period === "custom") {
    if (sinceDate.value && untilDate.value) {
      params.set("since", sinceDate.value);
      params.set("until", untilDate.value);
    } else {
      params.set("datePreset", "today");
    }
  } else {
    params.set("datePreset", period);
  }

  if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId);
  return `/api/dashboard?${params.toString()}`;
}

function selectedPeriodLabel() {
  if (periodSelect.value === "custom" && sinceDate.value && untilDate.value) {
    return `${formatDateOnly(sinceDate.value)} a ${formatDateOnly(untilDate.value)}`;
  }

  return periodSelect.options[periodSelect.selectedIndex]?.textContent || "Hoje";
}

function renderExecutiveSummary(data, periodLabel) {
  const campaigns = data.campaigns || [];
  const ads = data.ads || [];
  const summary = data.summary || {};
  const account = data.account || {};
  const currency = account.currency || "BRL";
  const spend = moneyRaw(summary.spendToday);
  const results = Number(summary.resultsToday || 0);
  const averageCost = results > 0 ? spend / results : null;
  const campaignsWithSpend = campaigns.filter((campaign) => moneyRaw(campaign.spendToday) > 0);
  const zeroResultCampaigns = campaignsWithSpend.filter((campaign) => !campaign.resultCount);
  const bestResultCampaign = [...campaigns]
    .filter((campaign) => campaign.resultCount > 0)
    .sort((a, b) => b.resultCount - a.resultCount || moneyRaw(a.spendToday) - moneyRaw(b.spendToday))[0];
  const bestCostCampaign = [...campaigns]
    .filter((campaign) => campaign.resultCount > 0 && moneyRaw(campaign.costPerResult, null) !== null)
    .sort((a, b) => moneyRaw(a.costPerResult) - moneyRaw(b.costPerResult))[0];
  const topSpendCampaign = [...campaigns].sort(
    (a, b) => moneyRaw(b.spendToday) - moneyRaw(a.spendToday)
  )[0];
  const warning = data.warnings?.[0] || "";

  let health = { level: "ok", label: "Saudável", title: "Conta ativa e gerando resultado" };
  if (data.source?.mode !== "live") {
    health = { level: "warn", label: "Demonstração", title: "Painel pronto para dados reais" };
  } else if (!campaigns.length) {
    health = { level: "danger", label: "Sem entrega", title: "Nenhuma entrega no período" };
  } else if (spend > 0 && results === 0) {
    health = { level: "warn", label: "Acompanhar", title: "Há gasto, mas sem resultado" };
  } else if (zeroResultCampaigns.length > 0) {
    health = { level: "warn", label: "Atenção", title: "Conta rodando com pontos para olhar" };
  }

  fields.ownerSignalTitle.textContent = health.title;
  fields.ownerSignalText.textContent = buildExecutiveText({
    campaigns,
    ads,
    spend,
    results,
    periodLabel,
    currency,
    zeroResultCampaigns,
    warning
  });
  setHealth(health.level, health.label);
  fields.ownerSpendPace.textContent =
    averageCost === null
      ? "Ainda sem custo medio por resultado neste periodo."
      : `Custo médio: ${formatMoney(averageCost, currency)} por resultado.`;

  if (bestResultCampaign) {
    fields.ownerBestCampaign.textContent = shortName(bestResultCampaign.name);
    fields.ownerBestCampaignHint.textContent = `${formatNumber(
      bestResultCampaign.resultCount
    )} ${bestResultCampaign.resultLabel.toLowerCase()} com ${
      bestResultCampaign.spendToday.formatted
    } investidos.`;
  } else {
    fields.ownerBestCampaign.textContent = "Ainda sem destaque";
    fields.ownerBestCampaignHint.textContent = "Nenhuma campanha trouxe resultado neste recorte.";
  }

  if (warning) {
    fields.ownerAttention.textContent = "Anúncios";
    fields.ownerAttentionHint.textContent =
      "A Meta não liberou os anúncios agora, mas as campanhas seguem atualizadas.";
  } else if (zeroResultCampaigns.length) {
    fields.ownerAttention.textContent = shortName(zeroResultCampaigns[0].name);
    fields.ownerAttentionHint.textContent = `Gastou ${
      zeroResultCampaigns[0].spendToday.formatted
    } sem resultado no período.`;
  } else if (!campaigns.length) {
    fields.ownerAttention.textContent = "Sem campanha";
    fields.ownerAttentionHint.textContent = "Não houve entrega com gasto neste recorte.";
  } else {
    fields.ownerAttention.textContent = "Sem alerta critico";
    fields.ownerAttentionHint.textContent = "As campanhas com gasto trouxeram resultado no recorte.";
  }

  fields.bestCostValue.textContent = bestCostCampaign?.costPerResult.formatted || "--";
  fields.bestCostHint.textContent = bestCostCampaign
    ? shortName(bestCostCampaign.name)
    : "Aguardando campanhas com resultado.";
  fields.zeroResultValue.textContent = String(zeroResultCampaigns.length);
  fields.zeroResultHint.textContent = zeroResultCampaigns.length
    ? zeroResultCampaigns.length === 1
      ? shortName(zeroResultCampaigns[0].name)
      : `${shortName(zeroResultCampaigns[0].name)} e mais ${
          zeroResultCampaigns.length - 1
        } em atenção.`
    : "Nenhuma campanha com gasto ficou sem resultado.";
  fields.topSpendValue.textContent = topSpendCampaign?.spendToday.formatted || "--";
  fields.topSpendHint.textContent = topSpendCampaign
    ? shortName(topSpendCampaign.name)
    : "Sem investimento no período.";
}

function buildExecutiveText({
  campaigns,
  ads,
  spend,
  results,
  periodLabel,
  currency,
  zeroResultCampaigns,
  warning
}) {
  const campaignText = plural(campaigns.length, "campanha com entrega", "campanhas com entrega");
  const adText = plural(ads.length, "anúncio analisado", "anúncios analisados");
  const resultText = plural(results, "resultado", "resultados");
  const pieces = [
    `${periodLabel}: ${campaigns.length} ${campaignText}, ${ads.length} ${adText}, ${formatMoney(
      spend,
      currency
    )} investidos e ${formatNumber(results)} ${resultText}.`
  ];

  if (zeroResultCampaigns.length) {
    pieces.push(
      `${zeroResultCampaigns.length} ${plural(
        zeroResultCampaigns.length,
        "campanha gastou",
        "campanhas gastaram"
      )} sem resultado.`
    );
  }

  if (warning) {
    pieces.push("A leitura de anúncios depende de permissão/retorno da Meta neste momento.");
  }

  return pieces.join(" ");
}

function renderDashboardError(message) {
  fields.ownerSignalTitle.textContent = "Nao foi possivel atualizar";
  fields.ownerSignalText.textContent = message || "Tente atualizar novamente em alguns instantes.";
  setHealth("danger", "Indisponivel");
  fields.ownerSpendPace.textContent = "Dados pausados até a próxima tentativa.";
}

function setHealth(level, label) {
  fields.ownerHealth.className = `health-pill ${level}`;
  fields.ownerHealth.textContent = label;
}

function renderCampaignRows(campaigns) {
  campaignRows.innerHTML = campaigns
    .map(
      (campaign) => `
        <tr>
          <td>
            <div class="campaign-name">
              <strong>${escapeHtml(campaign.name)}</strong>
              <span class="meta">
                <span>${escapeHtml(campaign.id)}</span>
                <span class="status-badge">${escapeHtml(campaign.status)}</span>
              </span>
            </div>
          </td>
          <td>${escapeHtml(readableObjective(campaign.objective))}</td>
          <td>
            <strong>${formatNumber(campaign.resultCount)}</strong>
            <div class="subtle">${escapeHtml(campaign.resultLabel)}</div>
          </td>
          <td>${campaign.spendToday.formatted}</td>
          <td>${campaign.costPerResult.formatted}</td>
          <td>${formatNumber(campaign.reach)}</td>
          <td>${formatNumber(campaign.impressions)}</td>
          <td>${escapeHtml(campaign.ctr)}</td>
        </tr>
      `
    )
    .join("");
}

function renderCampaignCards(campaigns) {
  mobileCampaigns.innerHTML = campaigns
    .map(
      (campaign) => `
        <article class="campaign-card">
          <header>
            <h3>${escapeHtml(campaign.name)}</h3>
            <span class="status-badge">${escapeHtml(campaign.status)}</span>
          </header>
          <dl>
            <div>
              <dt>Objetivo</dt>
              <dd>${escapeHtml(readableObjective(campaign.objective))}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>${formatNumber(campaign.resultCount)}</dd>
            </div>
            <div>
              <dt>Investimento</dt>
              <dd>${campaign.spendToday.formatted}</dd>
            </div>
            <div>
              <dt>CPR</dt>
              <dd>${campaign.costPerResult.formatted}</dd>
            </div>
            <div>
              <dt>Alcance</dt>
              <dd>${formatNumber(campaign.reach)}</dd>
            </div>
            <div>
              <dt>CTR</dt>
              <dd>${escapeHtml(campaign.ctr)}</dd>
            </div>
          </dl>
        </article>
      `
    )
    .join("");
}

function renderAdRows(ads) {
  adRows.innerHTML = ads
    .map(
      (ad) => `
        <tr>
          <td>${renderAdPreview(ad)}</td>
          <td>
            <div class="ad-copy">
              <strong>${escapeHtml(ad.name)}</strong>
              <span>${escapeHtml(truncateText(ad.text || ad.headline || "Sem texto capturado"))}</span>
            </div>
          </td>
          <td>${escapeHtml(shortName(ad.campaignName))}</td>
          <td>${escapeHtml(readableObjective(ad.objective))}</td>
          <td>
            <strong>${formatNumber(ad.resultCount)}</strong>
            <div class="subtle">${escapeHtml(ad.resultLabel)}</div>
          </td>
          <td>${ad.spendToday.formatted}</td>
          <td>${ad.costPerResult.formatted}</td>
          <td>${escapeHtml(ad.ctr)}</td>
        </tr>
      `
    )
    .join("");
}

function renderAdCards(ads) {
  mobileAds.innerHTML = ads
    .map(
      (ad) => `
        <article class="ad-card">
          <header>
            ${renderAdPreview(ad)}
            <div>
              <h3>${escapeHtml(ad.name)}</h3>
              <span class="status-badge">${escapeHtml(ad.status)}</span>
            </div>
          </header>
          <p>${escapeHtml(truncateText(ad.text || ad.headline || "Sem texto capturado", 140))}</p>
          <dl>
            <div>
              <dt>Campanha</dt>
              <dd>${escapeHtml(shortName(ad.campaignName))}</dd>
            </div>
            <div>
              <dt>Objetivo</dt>
              <dd>${escapeHtml(readableObjective(ad.objective))}</dd>
            </div>
            <div>
              <dt>Investimento</dt>
              <dd>${ad.spendToday.formatted}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>${formatNumber(ad.resultCount)}</dd>
            </div>
          </dl>
        </article>
      `
    )
    .join("");
}

function renderAdPreview(ad) {
  const href = ad.previewUrl || ad.destinationUrl || "";
  const label = ad.previewUrl ? "Abrir preview" : ad.destinationUrl ? "Abrir destino" : "Sem preview";
  const media = ad.thumbnailUrl
    ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${escapeHtml(ad.thumbnailUrl)}" />`
    : `<span class="ad-thumb-placeholder">Preview</span>`;

  if (!href) {
    if (ad.id || ad.creativeId) {
      return `
        <button
          class="ad-preview-link preview-button"
          data-preview-ad-id="${escapeHtml(ad.id || "")}"
          data-preview-creative-id="${escapeHtml(ad.creativeId || "")}"
          type="button"
        >
          ${media}
          <span>Gerar preview</span>
        </button>
      `;
    }

    return `<div class="ad-preview-link disabled">${media}<span>${label}</span></div>`;
  }

  return `
    <a
      aria-label="${escapeHtml(label)} de ${escapeHtml(ad.name)}"
      class="ad-preview-link"
      href="${escapeHtml(href)}"
      rel="noopener noreferrer"
      target="_blank"
    >
      ${media}
      <span>${label}</span>
    </a>
  `;
}

async function handlePreviewClick(event) {
  const button = event.target.closest("[data-preview-ad-id]");
  if (!button) return;

  event.preventDefault();
  const label = button.querySelector("span:last-child");
  const originalLabel = label?.textContent || "Gerar preview";
  const previewWindow = window.open("", "_blank");
  button.disabled = true;
  if (label) label.textContent = "Abrindo...";

  try {
    const params = new URLSearchParams();
    if (button.dataset.previewAdId) params.set("adId", button.dataset.previewAdId);
    if (button.dataset.previewCreativeId) {
      params.set("creativeId", button.dataset.previewCreativeId);
    }
    const response = await request(`/api/meta/preview?${params.toString()}`);
    if (previewWindow) {
      previewWindow.location.href = response.previewUrl;
    } else {
      window.location.href = response.previewUrl;
    }
    if (label) label.textContent = "Abrir preview";
  } catch (error) {
    previewWindow?.close();
    button.classList.add("preview-error");
    if (label) label.textContent = "Indisponível";
    window.setTimeout(() => {
      button.classList.remove("preview-error");
      button.disabled = false;
      if (label) label.textContent = originalLabel;
    }, 2600);
    return;
  }

  button.disabled = false;
}

function showLogin() {
  dashboardView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || "Nao foi possivel completar a acao.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function formatMoney(value, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency
  }).format(Number(value || 0));
}

function formatDateOnly(value) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}

function readableObjective(value) {
  if (!value) return "Sem objetivo informado";
  const labels = {
    OUTCOME_AWARENESS: "Reconhecimento",
    OUTCOME_TRAFFIC: "Trafego",
    OUTCOME_ENGAGEMENT: "Engajamento",
    OUTCOME_LEADS: "Leads",
    OUTCOME_APP_PROMOTION: "App",
    OUTCOME_SALES: "Vendas",
    BRAND_AWARENESS: "Reconhecimento",
    REACH: "Alcance",
    TRAFFIC: "Trafego",
    ENGAGEMENT: "Engajamento",
    LEAD_GENERATION: "Leads",
    CONVERSIONS: "Conversoes",
    SALES: "Vendas",
    AWARENESS: "Reconhecimento"
  };
  return labels[value] || String(value).replaceAll("_", " ").toLowerCase();
}

function moneyRaw(payload, fallback = 0) {
  if (payload && typeof payload.raw === "number") return payload.raw;
  return fallback;
}

function shortName(value) {
  const clean = String(value || "").trim();
  if (!clean) return "--";
  return clean.length > 46 ? `${clean.slice(0, 43)}...` : clean;
}

function truncateText(value, limit = 96) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 3)}...`;
}

function plural(count, singular, pluralValue) {
  return count === 1 ? singular : pluralValue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
