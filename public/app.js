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
const balanceCard = document.querySelector("#balanceCard");
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
const magneticDock = document.querySelector("#magneticDock");
const dashboardNavLinks = document.querySelectorAll(".sidebar-link, .dock-item");

const fields = {
  sourceLabel: document.querySelector("#sourceLabel"),
  accountName: document.querySelector("#accountName"),
  accountStatus: document.querySelector("#accountStatus"),
  lastUpdated: document.querySelector("#lastUpdated"),
  balanceTitle: document.querySelector("#balanceTitle"),
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
  outcomePeriodEyebrow: document.querySelector("#outcomePeriodEyebrow"),
  primaryResultsValue: document.querySelector("#primaryResultsValue"),
  primaryResultsLabel: document.querySelector("#primaryResultsLabel"),
  primaryResultsBreakdown: document.querySelector("#primaryResultsBreakdown"),
  primaryResultsHint: document.querySelector("#primaryResultsHint"),
  costPerContactTitle: document.querySelector("#costPerContactTitle"),
  costPerContactValue: document.querySelector("#costPerContactValue"),
  costPerContactHint: document.querySelector("#costPerContactHint"),
  outcomeSpendValue: document.querySelector("#outcomeSpendValue"),
  outcomeSpendHint: document.querySelector("#outcomeSpendHint"),
  intentValue: document.querySelector("#intentValue"),
  intentHint: document.querySelector("#intentHint"),
  lpViewsValue: document.querySelector("#lpViewsValue"),
  lpViewsHint: document.querySelector("#lpViewsHint"),
  eventFunnelList: document.querySelector("#eventFunnelList"),
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
  ownerEventMix: document.querySelector("#ownerEventMix"),
  ownerEventMixHint: document.querySelector("#ownerEventMixHint"),
  bestCostValue: document.querySelector("#bestCostValue"),
  bestCostHint: document.querySelector("#bestCostHint"),
  zeroResultValue: document.querySelector("#zeroResultValue"),
  zeroResultHint: document.querySelector("#zeroResultHint"),
  topSpendValue: document.querySelector("#topSpendValue"),
  topSpendHint: document.querySelector("#topSpendHint"),
  bestAdResultName: document.querySelector("#bestAdResultName"),
  bestAdResultHint: document.querySelector("#bestAdResultHint"),
  bestAdCostName: document.querySelector("#bestAdCostName"),
  bestAdCostHint: document.querySelector("#bestAdCostHint"),
  topAdSpendName: document.querySelector("#topAdSpendName"),
  topAdSpendHint: document.querySelector("#topAdSpendHint"),
  adsCountPill: document.querySelector("#adsCountPill")
};

let selectedAdAccountId = localStorage.getItem("t8m_meta_ad_account_id") || "";
let dashboardRequestId = 0;
let dashboardController = null;
let financeRefreshTimer = null;

initDashboardNavigation();
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
    startFinanceAutoRefresh();
  } catch (error) {
    if (error.name === "AbortError") return;
    if (requestId !== dashboardRequestId) return;
    if (error.status === 401) {
      showLogin();
      loginMessage.textContent = "Sessão expirada.";
      return;
    }
    fields.sourceLabel.textContent = "Indisponível";
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
  renderFinanceCard(data);
  fields.remainingCapValue.textContent = account.spendCapConfigured
    ? account.remainingCap.formatted
    : "Sem limite";
  fields.spendCapValue.textContent = account.spendCapConfigured
    ? `Limite Meta: ${account.spendCap.formatted}`
    : "Nenhum spending cap configurado na conta.";
  fields.todaySpendValue.textContent = data.summary.spendToday.formatted;
  fields.todayImpressionsValue.textContent = `${formatNumber(
    data.summary.impressionsToday
  )} impressões no período`;
  fields.activeCampaignsValue.textContent = String(data.summary.activeCampaigns);
  fields.todayResultsValue.textContent = summaryResultText(data);
  fields.timezoneValue.textContent = account.timezone;
  fields.periodLabel.textContent = periodLabel;
  fields.outcomePeriodEyebrow.textContent = periodLabel;
  fields.campaignPeriodEyebrow.textContent = periodLabel;
  fields.adsPeriodEyebrow.textContent = periodLabel;
  fields.adsCountPill.textContent = `${formatNumber((data.ads || []).length)} anúncios no recorte`;

  renderOutcomeSnapshot(data, periodLabel);
  renderExecutiveSummary(data, periodLabel);
  renderBestAds(data.ads || []);
  renderCampaignRows(data.campaigns);
  renderCampaignCards(data.campaigns);
  renderAdRows(data.ads || []);
  renderAdCards(data.ads || []);
  emptyState.classList.toggle("hidden", data.campaigns.length > 0);
  adsEmptyState.classList.toggle("hidden", (data.ads || []).length > 0);
}

function renderFinanceCard(data) {
  const account = data.account || {};
  const finance = account.finance || {};
  const primary = finance.primary || account.availableBalance || account.balance;
  const financeUpdatedAt = finance.updatedAt || data.updatedAt;
  balanceCard.classList.remove("danger-card", "ok-card");
  fields.balanceTitle.textContent = finance.cardTitle || "Financeiro Meta";

  if (data.source?.mode !== "live") {
    fields.balanceValue.textContent = primary?.formatted || "--";
    fields.balanceHint.textContent = "Dados de demonstracao.";
    return;
  }

  if (account.balanceLow) {
    balanceCard.classList.add("danger-card");
    fields.balanceValue.textContent = primary?.formatted || "Atenção";
    fields.balanceHint.textContent =
      finance.primarySource === "spend_cap"
        ? `Limite restante baixo. Conferir limite/recarga no Meta antes de escalar. Atualizado em ${formatDateTime(financeUpdatedAt)}.`
        : `Saldo baixo. Recarregar a conta antes de escalar campanhas. Atualizado em ${formatDateTime(financeUpdatedAt)}.`;
    return;
  }

  if (finance.confidence === "unavailable") {
    fields.balanceValue.textContent = "Não informado";
    fields.balanceHint.textContent = "A Meta não retornou saldo/limite para esta conta agora.";
    return;
  }

  balanceCard.classList.add(finance.isActionableBalance ? "ok-card" : "balance-card");
  fields.balanceValue.textContent = primary?.formatted || "--";
  fields.balanceHint.textContent = financeHint(account, finance, financeUpdatedAt);
}

function financeHint(account, finance, updatedAt) {
  const updatedText = updatedAt ? ` Atualizado em ${formatDateTime(updatedAt)}.` : "";
  const warningText = finance.warning ? `${finance.warning} ` : "";

  if (finance.confidence === "estimated") {
    return `${warningText}${finance.primaryLabel}: limite ${account.spendCap.formatted} menos gasto acumulado ${account.amountSpent.formatted}.${updatedText}`;
  }

  if (finance.confidence === "direct") {
    return `${warningText}${finance.primaryLabel}.${updatedText}`;
  }

  if (finance.confidence === "billing") {
    return `${warningText}${finance.primaryLabel}; não é verba disponível de pré-pagamento.${updatedText}`;
  }

  return `${warningText}Aguardando retorno financeiro da Meta.${updatedText}`;
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
    connectorStatus.textContent = connected ? "Conectado" : "Não conectado";
    connectMetaButton.classList.toggle("hidden", connected);
    disconnectMetaButton.classList.toggle("hidden", !connected || status.mode === "server");

    if (connected && status.adAccountLocked) {
      accountPicker.classList.add("hidden");
      connectorHint.textContent = "Credenciais definidas no servidor.";
      return;
    }

    if (connected) {
      connectorHint.textContent = "Selecione a conta de anúncios.";
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
    connectorHint.textContent = "Não foi possível verificar a conexão.";
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
    connectorHint.textContent = "Nenhuma conta de anúncios encontrada.";
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

function buildFinanceUrl() {
  const params = new URLSearchParams();
  if (selectedAdAccountId) params.set("adAccountId", selectedAdAccountId);
  return `/api/meta/finance?${params.toString()}`;
}

function startFinanceAutoRefresh() {
  window.clearInterval(financeRefreshTimer);
  financeRefreshTimer = window.setInterval(loadFinanceSnapshot, 60000);
}

async function loadFinanceSnapshot() {
  if (dashboardView.classList.contains("hidden")) return;

  try {
    const data = await request(buildFinanceUrl());
    renderFinanceCard(data);
  } catch {
    // The main dashboard remains usable if only the lightweight finance refresh fails.
  }
}

function selectedPeriodLabel() {
  if (periodSelect.value === "custom" && sinceDate.value && untilDate.value) {
    return `${formatDateOnly(sinceDate.value)} a ${formatDateOnly(untilDate.value)}`;
  }

  return periodSelect.options[periodSelect.selectedIndex]?.textContent || "Hoje";
}

function renderOutcomeSnapshot(data, periodLabel) {
  const snapshot = getOutcomeSnapshot(data);
  const spend = moneyRaw(data.summary?.spendToday);
  const currency = data.account?.currency || "BRL";

  fields.primaryResultsValue.textContent = formatNumber(snapshot.primaryCount);
  fields.primaryResultsLabel.textContent = snapshot.primaryLabel;
  fields.primaryResultsBreakdown.innerHTML = renderOutcomeChips(snapshot.primaryBreakdown);
  fields.primaryResultsHint.textContent = snapshot.primaryHint;
  fields.costPerContactTitle.textContent = snapshot.costTitle;
  fields.costPerContactValue.textContent =
    snapshot.primaryCount > 0 ? formatMoney(spend / snapshot.primaryCount, currency) : "--";
  fields.costPerContactHint.textContent =
    snapshot.primaryCount > 0
      ? `por ${snapshot.primaryUnit} no período selecionado`
      : "Aguardando Lead, Contato ou Conversa da Meta.";
  fields.outcomeSpendValue.textContent = data.summary?.spendToday?.formatted || "--";
  fields.outcomeSpendHint.textContent = `${formatNumber(
    data.summary?.impressionsToday
  )} impressões no período.`;
  fields.intentValue.textContent = formatNumber(snapshot.intentTotal);
  fields.intentHint.textContent = snapshot.intentHint;
  fields.lpViewsValue.textContent = snapshot.contentViews
    ? formatNumber(snapshot.contentViews)
    : "--";
  fields.lpViewsHint.textContent = snapshot.contentViews
    ? "Visualizações de conteúdo retornadas pelo pixel."
    : "A Meta não retornou ViewContent neste recorte.";
  fields.eventFunnelList.innerHTML = renderFunnelSteps(snapshot);
}

function getOutcomeSnapshot(data) {
  const campaigns = data.campaigns || [];
  const resultGroups = aggregateResultBreakdown(campaigns);
  const eventGroups = aggregateResultBreakdown(campaigns, "eventBreakdown");
  const contactGroups = eventGroups.filter((group) =>
    ["lead", "contact", "message"].includes(group.key)
  );
  const intentGroups = eventGroups.filter((group) =>
    ["checkout", "add_to_cart"].includes(group.key)
  );
  const contactTotal = sumGroups(contactGroups);
  const intentTotal = sumGroups(intentGroups);
  const contentViews = groupCount(eventGroups, "view_content");
  const summaryResults = Number(data.summary?.resultsToday || 0);

  if (contactTotal > 0) {
    return {
      primaryCount: contactTotal,
      primaryLabel: contactTotal === 1 ? "contato captado" : "contatos captados",
      primaryUnit: "contato captado",
      costTitle: "Custo por contato",
      primaryBreakdown: contactGroups,
      primaryHint:
        "Este é o número que importa primeiro: soma Lead de formulário, Contato do site e Conversa iniciada quando a Meta retorna esses eventos.",
      intentTotal,
      intentHint: intentGroups.length
        ? `${intentGroups.map(formatActionGroup).join(" + ")} antes do contato.`
        : "Sem checkout ou carrinho retornado neste recorte.",
      contentViews,
      eventGroups,
      contactTotal,
      resultGroups
    };
  }

  if (intentTotal > 0) {
    return {
      primaryCount: intentTotal,
      primaryLabel: intentTotal === 1 ? "intenção forte na LP" : "intenções fortes na LP",
      primaryUnit: "intenção forte",
      costTitle: "Custo por intenção",
      primaryBreakdown: intentGroups,
      primaryHint:
        "Ainda não voltou Lead/Contato, então o painel destaca quem avançou para carrinho ou checkout dentro da página.",
      intentTotal,
      intentHint: intentGroups.map(formatActionGroup).join(" + "),
      contentViews,
      eventGroups,
      contactTotal,
      resultGroups
    };
  }

  return {
    primaryCount: summaryResults,
    primaryLabel: summaryResultNoun(campaigns, summaryResults),
    primaryUnit: "resultado",
    costTitle: "Custo por ação",
    primaryBreakdown: resultGroups,
    primaryHint:
      summaryResults > 0
        ? "A Meta retornou ações, mas sem detalhar contato direto neste recorte."
        : "Sem contato, conversa ou intenção forte retornada pela Meta neste período.",
    intentTotal,
    intentHint: "Sem checkout ou carrinho retornado neste recorte.",
    contentViews,
    eventGroups,
    contactTotal,
    resultGroups
  };
}

function renderOutcomeChips(groups) {
  if (!groups.length) return `<span class="outcome-chip muted">Sem eventos de contato</span>`;
  return groups
    .map((group) => `<span class="outcome-chip">${escapeHtml(formatActionGroup(group))}</span>`)
    .join("");
}

function renderFunnelSteps(snapshot) {
  const contactBreakdown =
    snapshot.contactTotal > 0
      ? snapshot.primaryBreakdown.map(formatActionGroup).join(" + ")
      : "Sem contato direto";
  const steps = [
    {
      label: "Conteúdo visto",
      value: snapshot.contentViews,
      detail: "ViewContent da página",
      accent: "info"
    },
    {
      label: "Carrinho",
      value: groupCount(snapshot.eventGroups, "add_to_cart"),
      detail: "AddToCart no site",
      accent: "muted"
    },
    {
      label: "Checkout iniciado",
      value: groupCount(snapshot.eventGroups, "checkout"),
      detail: "InitiateCheckout no site",
      accent: "warn"
    },
    {
      label: "Contatos captados",
      value: snapshot.contactTotal,
      detail: contactBreakdown,
      accent: "brand"
    }
  ];
  const maxValue = Math.max(...steps.map((step) => step.value), 1);

  return steps
    .map(
      (step) => `
        <div class="funnel-step ${step.accent}">
          <div>
            <strong>${escapeHtml(step.label)}</strong>
            <span>${escapeHtml(step.detail)}</span>
          </div>
          <div class="funnel-meter" aria-hidden="true">
            <span style="width: ${Math.max((step.value / maxValue) * 100, step.value ? 8 : 0)}%"></span>
          </div>
          <b>${formatNumber(step.value)}</b>
        </div>
      `
    )
    .join("");
}

function groupCount(groups, key) {
  return Number(groups.find((group) => group.key === key)?.count || 0);
}

function sumGroups(groups) {
  return groups.reduce((sum, group) => sum + Number(group.count || 0), 0);
}

function summaryResultText(data) {
  const total = Number(data.summary?.resultsToday || 0);
  const noun = summaryResultNoun(data.campaigns || [], total);
  return `${formatNumber(total)} ${noun} no período`;
}

function summaryResultNoun(items, total) {
  const groups = aggregateResultBreakdown(items);
  const hasContact = groups.some((group) => ["lead", "contact", "message"].includes(group.key));
  const hasIntent = groups.some((group) => ["checkout", "add_to_cart"].includes(group.key));

  if (hasContact) return total === 1 ? "contato captado" : "contatos captados";
  if (hasIntent) return total === 1 ? "intenção no site" : "intenções no site";

  return total === 1 ? "resultado" : "resultados";
}

function eventMixSummary(items) {
  const groups = aggregateResultBreakdown(items, "eventBreakdown");
  const directContactGroups = groups.filter((group) =>
    ["lead", "contact", "message"].includes(group.key)
  );
  const siteIntentGroups = groups.filter((group) =>
    ["checkout", "add_to_cart"].includes(group.key)
  );
  const contentGroup = groups.find((group) => group.key === "view_content");

  if (directContactGroups.length) {
    return {
      title: directContactGroups.map(formatActionGroup).join(" + "),
      hint: [
        "Esses eventos entram como contatos captados, mesmo quando o formulário não dispara Lead.",
        siteIntentGroups.length ? `Também apareceu: ${siteIntentGroups.map(formatActionGroup).join(" + ")}.` : "",
        contentGroup ? `${formatActionGroup(contentGroup)} ficam como sinal de tráfego, não como contato.` : ""
      ]
        .filter(Boolean)
        .join(" ")
    };
  }

  if (siteIntentGroups.length) {
    return {
      title: siteIntentGroups.map(formatActionGroup).join(" + "),
      hint: [
        "Sem Lead/Contato retornado; estes eventos indicam intenção forte dentro da LP.",
        contentGroup ? `${formatActionGroup(contentGroup)} mostram volume na página.` : ""
      ]
        .filter(Boolean)
        .join(" ")
    };
  }

  if (contentGroup) {
    return {
      title: formatActionGroup(contentGroup),
      hint: "A Meta retornou visualizações de conteúdo, mas ainda não retornou contato ou intenção forte neste recorte."
    };
  }

  return {
    title: "Sem evento",
    hint: "A Meta não retornou Lead, Contato, Conversa ou intenção no site neste recorte."
  };
}

function aggregateResultBreakdown(items, field = "resultBreakdown") {
  const totals = new Map();
  for (const item of items || []) {
    for (const group of item[field] || item.resultBreakdown || []) {
      const key = group.key || group.label;
      const current = totals.get(key) || { key, label: group.label, count: 0 };
      current.count += Number(group.count || 0);
      totals.set(key, current);
    }
  }

  const order = ["lead", "contact", "message", "checkout", "add_to_cart", "purchase", "link_click"];
  return [...totals.values()]
    .filter((group) => group.count > 0)
    .sort((a, b) => actionOrder(a.key, order) - actionOrder(b.key, order));
}

function actionOrder(key, order) {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
}

function renderResultBreakdown(item) {
  const text = resultBreakdownText(item);
  const trail = eventTrailText(item);
  if (!text && !trail) return "";
  return [
    text
      ? `<div class="result-breakdown" title="${escapeHtml(item.resultHint || "")}">${escapeHtml(
          text
        )}</div>`
      : "",
    trail ? `<div class="event-trail">${escapeHtml(trail)}</div>` : ""
  ].join("");
}

function resultBreakdownText(item, limit = 3) {
  const groups = item.resultBreakdown || [];
  if (!groups.length) return "";
  const visibleGroups = groups.slice(0, limit);
  const extra = groups.length > visibleGroups.length ? ` +${groups.length - visibleGroups.length}` : "";
  return `${visibleGroups.map(formatActionGroup).join(" + ")}${extra}`;
}

function formatActionGroup(group) {
  const labels = {
    lead: ["lead de formulário", "leads de formulário"],
    contact: ["contato", "contatos"],
    message: ["conversa", "conversas"],
    purchase: ["compra", "compras"],
    checkout: ["checkout iniciado", "checkouts iniciados"],
    add_to_cart: ["adição ao carrinho", "adições ao carrinho"],
    view_content: ["visualização de conteúdo", "visualizações de conteúdo"],
    link_click: ["clique no link", "cliques no link"]
  };
  const count = Number(group.count || 0);
  const [singular, pluralValue] = labels[group.key] || [
    String(group.label || "evento").toLowerCase(),
    String(group.label || "eventos").toLowerCase()
  ];
  return `${formatNumber(count)} ${count === 1 ? singular : pluralValue}`;
}

function eventTrailText(item) {
  const resultKeys = new Set((item.resultBreakdown || []).map((group) => group.key));
  const extraGroups = (item.eventBreakdown || [])
    .filter((group) => !resultKeys.has(group.key))
    .filter((group) => group.key !== "link_click")
    .slice(0, 3);

  if (!extraGroups.length) return "";
  return `Também: ${extraGroups.map(formatActionGroup).join(" + ")}`;
}

function renderExecutiveSummary(data, periodLabel) {
  const campaigns = data.campaigns || [];
  const ads = data.ads || [];
  const summary = data.summary || {};
  const account = data.account || {};
  const finance = account.finance || {};
  const currency = account.currency || "BRL";
  const spend = moneyRaw(summary.spendToday);
  const results = Number(summary.resultsToday || 0);
  const balanceLow = Boolean(account.balanceLow);
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
  const deliveredAds = ads.filter((ad) => moneyRaw(ad.spendToday) > 0 || ad.impressions > 0);
  const eventMix = eventMixSummary(campaigns);
  const bestResultAd = [...deliveredAds]
    .filter((ad) => ad.resultCount > 0)
    .sort((a, b) => b.resultCount - a.resultCount || moneyRaw(a.spendToday) - moneyRaw(b.spendToday))[0];
  const topSpendCtr = parsePercent(topSpendCampaign?.ctr);
  const warning = data.warnings?.[0] || "";
  const blockingAdWarning = warning && !ads.length;
  const hasDirectBalance =
    finance.primarySource === "total_prepay_balance" ||
    finance.primarySource === "prepay_account_balance";

  let health = {
    level: "ok",
    label: "Rodando",
    title: "Conta rodando com caminho claro de acompanhamento"
  };
  if (balanceLow) {
    health = hasDirectBalance
      ? { level: "danger", label: "Recarregar", title: "Ação imediata: recarregar saldo" }
      : { level: "danger", label: "Financeiro", title: "Ação imediata: conferir limite no Meta" };
  } else if (data.source?.mode !== "live") {
    health = { level: "warn", label: "Demonstração", title: "Painel pronto para dados reais" };
  } else if (!campaigns.length) {
    health = { level: "danger", label: "Sem entrega", title: "Sem entrega no período selecionado" };
  } else if (spend > 0 && results === 0) {
    health = { level: "warn", label: "Revisar", title: "Gasto ativo sem contato/ação capturado" };
  } else if (zeroResultCampaigns.length > 0 || (topSpendCtr !== null && topSpendCtr < 1)) {
    health = { level: "warn", label: "Acompanhar", title: "Conta rodando com ponto de atenção" };
  }

  fields.ownerSignalTitle.textContent = health.title;
  fields.ownerSignalText.textContent = buildExecutiveText({
    campaigns,
    ads,
    averageCost,
    bestResultAd,
    bestResultCampaign,
    finance,
    spend,
    results,
    topSpendCampaign,
    periodLabel,
    currency,
    zeroResultCampaigns,
    balanceLow,
    balanceFormatted: finance.primary?.formatted || account.availableBalance?.formatted,
    hasDirectBalance,
    warning
  });
  setHealth(health.level, health.label);
  fields.ownerSpendPace.textContent =
    averageCost === null
    ? "Ainda sem custo médio por contato/ação neste período."
      : `Custo médio: ${formatMoney(averageCost, currency)} por contato/ação.`;
  fields.ownerEventMix.textContent = eventMix.title;
  fields.ownerEventMixHint.textContent = eventMix.hint;

  if (bestResultCampaign) {
    fields.ownerBestCampaign.textContent = shortName(bestResultCampaign.name);
    fields.ownerBestCampaignHint.textContent = `${formatNumber(
      bestResultCampaign.resultCount
    )} ${bestResultCampaign.resultLabel.toLowerCase()} com ${
      bestResultCampaign.spendToday.formatted
    } investidos.`;
  } else {
    fields.ownerBestCampaign.textContent = "Ainda sem destaque";
    fields.ownerBestCampaignHint.textContent = "Nenhuma campanha trouxe contato/ação neste recorte.";
  }

  if (balanceLow) {
    fields.ownerAttention.textContent = hasDirectBalance ? "Recarga" : "Limite";
    fields.ownerAttentionHint.textContent = `Saldo atual: ${
      finance.primary?.formatted || account.availableBalance?.formatted || "--"
    }. ${hasDirectBalance ? "Recarregar" : "Conferir limite ou recarga no Meta"} antes de mexer em escala.`;
  } else if (blockingAdWarning) {
    fields.ownerAttention.textContent = "Anúncios";
    fields.ownerAttentionHint.textContent =
      "A Meta não liberou os anúncios agora, mas as campanhas seguem atualizadas.";
  } else if (zeroResultCampaigns.length) {
    fields.ownerAttention.textContent = shortName(zeroResultCampaigns[0].name);
    fields.ownerAttentionHint.textContent = `Gastou ${
      zeroResultCampaigns[0].spendToday.formatted
    } sem contato/ação no período.`;
  } else if (!campaigns.length) {
    fields.ownerAttention.textContent = "Sem campanha";
    fields.ownerAttentionHint.textContent = "Não houve entrega com gasto neste recorte.";
  } else if (topSpendCtr !== null && topSpendCtr < 1) {
    fields.ownerAttention.textContent = shortName(topSpendCampaign.name);
    fields.ownerAttentionHint.textContent = `Maior investimento do período com CTR de ${topSpendCampaign.ctr}. Vale revisar criativo ou público.`;
  } else {
    fields.ownerAttention.textContent = bestResultAd ? "Escalar com cuidado" : "Sem alerta crítico";
    fields.ownerAttentionHint.textContent = bestResultAd
      ? `${shortName(bestResultAd.name)} é o melhor anúncio por contato/ação. Manter orçamento e acompanhar custo.`
      : "As campanhas com gasto trouxeram contato/ação no recorte.";
  }

  fields.bestCostValue.textContent = bestCostCampaign?.costPerResult.formatted || "--";
  fields.bestCostHint.textContent = bestCostCampaign
    ? shortName(bestCostCampaign.name)
    : "Aguardando campanhas com contato ou ação.";
  fields.zeroResultValue.textContent = String(zeroResultCampaigns.length);
  fields.zeroResultHint.textContent = zeroResultCampaigns.length
    ? zeroResultCampaigns.length === 1
      ? shortName(zeroResultCampaigns[0].name)
      : `${shortName(zeroResultCampaigns[0].name)} e mais ${
          zeroResultCampaigns.length - 1
        } em atenção.`
    : "Nenhuma campanha com gasto ficou sem contato/ação.";
  fields.topSpendValue.textContent = topSpendCampaign?.spendToday.formatted || "--";
  fields.topSpendHint.textContent = topSpendCampaign
    ? shortName(topSpendCampaign.name)
    : "Sem investimento no período.";
}

function buildExecutiveText({
  campaigns,
  ads,
  averageCost,
  bestResultAd,
  bestResultCampaign,
  finance,
  spend,
  results,
  topSpendCampaign,
  periodLabel,
  currency,
  zeroResultCampaigns,
  balanceLow,
  balanceFormatted,
  hasDirectBalance,
  warning
}) {
  const campaignText = plural(campaigns.length, "campanha com entrega", "campanhas com entrega");
  const adText = plural(ads.length, "anúncio analisado", "anúncios analisados");
  const resultText = summaryResultNoun(campaigns, results);
  const averageText =
    averageCost !== null
      ? `, custo médio de ${formatMoney(averageCost, currency)} por contato/ação`
      : "";
  const pieces = [
    `${periodLabel}: ${formatMoney(spend, currency)} em ${campaigns.length} ${campaignText}, ${formatNumber(results)} ${resultText}, ${ads.length} ${adText}${averageText}.`
  ];

  if (bestResultCampaign || bestResultAd) {
    const bestParts = [];
    if (bestResultCampaign) {
      bestParts.push(
        `campanha ${shortName(bestResultCampaign.name)} com ${formatNumber(
          bestResultCampaign.resultCount
        )} ${bestResultCampaign.resultLabel.toLowerCase()}`
      );
    }
    if (bestResultAd) bestParts.push(`anúncio ${shortName(bestResultAd.name)}`);
    pieces.push(`Melhor sinal: ${bestParts.join(" e ")}.`);
  }

  if (balanceLow) {
    pieces.push(
      hasDirectBalance
        ? `Próxima ação: recarregar antes de otimizar, saldo atual ${balanceFormatted}.`
        : `Próxima ação: conferir limite ou recarga no Meta antes de otimizar, valor atual ${balanceFormatted}.`
    );
  } else if (zeroResultCampaigns.length) {
    pieces.push(
      `Próxima ação: revisar ${shortName(zeroResultCampaigns[0].name)}, que gastou ${
        zeroResultCampaigns[0].spendToday.formatted
      } sem contato/ação.`
    );
  } else if (topSpendCampaign) {
    pieces.push(
      `Próxima ação: manter a verba em observação, maior concentração está em ${shortName(
        topSpendCampaign.name
      )}.`
    );
  }

  if (!balanceLow && finance?.primary?.formatted && finance?.isActionableBalance) {
    pieces.push(`Financeiro: ${finance.primary.formatted} disponível agora.`);
  }

  if (warning) {
    pieces.push("A leitura de anúncios depende de permissão/retorno da Meta neste momento.");
  }

  return pieces.join(" ");
}

function renderBestAds(ads) {
  const deliveredAds = ads.filter((ad) => moneyRaw(ad.spendToday) > 0 || ad.impressions > 0);
  const bestResultAd = [...deliveredAds]
    .filter((ad) => ad.resultCount > 0)
    .sort((a, b) => b.resultCount - a.resultCount || moneyRaw(a.spendToday) - moneyRaw(b.spendToday))[0];
  const bestCostAd = [...deliveredAds]
    .filter((ad) => ad.resultCount > 0 && moneyRaw(ad.costPerResult, null) !== null)
    .sort((a, b) => moneyRaw(a.costPerResult) - moneyRaw(b.costPerResult))[0];
  const topSpendAd = [...deliveredAds].sort(
    (a, b) => moneyRaw(b.spendToday) - moneyRaw(a.spendToday)
  )[0];

  setBestAdCard({
    nameField: fields.bestAdResultName,
    hintField: fields.bestAdResultHint,
    ad: bestResultAd,
    fallbackName: "Sem contato/ação ainda",
    hint: bestResultAd
      ? `${formatNumber(bestResultAd.resultCount)} ${bestResultAd.resultLabel.toLowerCase()}${
          resultBreakdownText(bestResultAd) ? ` (${resultBreakdownText(bestResultAd)})` : ""
        } | ${bestResultAd.spendToday.formatted}`
      : "Nenhum anúncio trouxe contato/ação no recorte."
  });
  setBestAdCard({
    nameField: fields.bestAdCostName,
    hintField: fields.bestAdCostHint,
    ad: bestCostAd,
    fallbackName: "Sem custo calculado",
    hint: bestCostAd
      ? `${bestCostAd.costPerResult.formatted} por ${bestCostAd.resultLabel.toLowerCase()}`
      : "Aguardando anúncio com contato ou ação."
  });
  setBestAdCard({
    nameField: fields.topAdSpendName,
    hintField: fields.topAdSpendHint,
    ad: topSpendAd,
    fallbackName: "Sem investimento",
    hint: topSpendAd
      ? `${topSpendAd.spendToday.formatted} | ${formatNumber(topSpendAd.impressions)} impressões`
      : "Nenhum anúncio teve gasto no recorte."
  });
}

function setBestAdCard({ nameField, hintField, ad, fallbackName, hint }) {
  nameField.textContent = ad ? shortName(ad.name, 54) : fallbackName;
  hintField.textContent = hint;
}

function renderDashboardError(message) {
  fields.primaryResultsValue.textContent = "--";
  fields.primaryResultsLabel.textContent = "contatos/ações indisponíveis";
  fields.primaryResultsBreakdown.innerHTML = `<span class="outcome-chip muted">Meta indisponível</span>`;
  fields.primaryResultsHint.textContent =
    message || "Tente atualizar novamente em alguns instantes.";
  fields.costPerContactTitle.textContent = "Custo por contato";
  fields.costPerContactValue.textContent = "--";
  fields.costPerContactHint.textContent = "Custo pausado até a próxima atualização.";
  fields.outcomeSpendValue.textContent = "--";
  fields.outcomeSpendHint.textContent = "Investimento indisponível agora.";
  fields.intentValue.textContent = "--";
  fields.intentHint.textContent = "Eventos da LP indisponíveis agora.";
  fields.lpViewsValue.textContent = "--";
  fields.lpViewsHint.textContent = "Visualizações indisponíveis agora.";
  fields.eventFunnelList.innerHTML = "";
  fields.ownerSignalTitle.textContent = "Não foi possível atualizar";
  fields.ownerSignalText.textContent = message || "Tente atualizar novamente em alguns instantes.";
  setHealth("danger", "Indisponível");
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
            ${renderResultBreakdown(campaign)}
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
              <dt>Contatos/Ações</dt>
              <dd>
                ${formatNumber(campaign.resultCount)}
                ${renderResultBreakdown(campaign)}
              </dd>
            </div>
            <div>
              <dt>Investimento</dt>
              <dd>${campaign.spendToday.formatted}</dd>
            </div>
            <div>
              <dt>Custo</dt>
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
            ${renderResultBreakdown(ad)}
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
              <dt>Contatos/Ações</dt>
              <dd>
                ${formatNumber(ad.resultCount)}
                ${renderResultBreakdown(ad)}
              </dd>
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
  window.clearInterval(financeRefreshTimer);
  dashboardView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
}

function initDashboardNavigation() {
  initMagneticDock();

  const sectionIds = [...dashboardNavLinks]
    .map((link) => link.getAttribute("href"))
    .filter((href) => href?.startsWith("#"))
    .map((href) => href.slice(1));
  const sections = [...new Set(sectionIds)]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveNavItem(visible.target.id);
    },
    { rootMargin: "-22% 0px -58% 0px", threshold: [0.08, 0.18, 0.32] }
  );

  sections.forEach((section) => observer.observe(section));
  setActiveNavItem(sections[0].id);
}

function initMagneticDock() {
  if (!magneticDock) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const items = [...magneticDock.querySelectorAll(".dock-item")];
  const resetItems = () => {
    items.forEach((item) => {
      item.style.removeProperty("--dock-scale");
      item.style.removeProperty("--dock-y");
    });
  };

  magneticDock.addEventListener("pointermove", (event) => {
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
      const influence = Math.max(0, 1 - distance / 118);
      item.style.setProperty("--dock-scale", (1 + influence * 0.34).toFixed(3));
      item.style.setProperty("--dock-y", `${(-influence * 9).toFixed(1)}px`);
    });
  });
  magneticDock.addEventListener("pointerleave", resetItems);
  magneticDock.addEventListener("blur", resetItems, true);
}

function setActiveNavItem(sectionId) {
  dashboardNavLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${sectionId}`);
  });
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

function parsePercent(value) {
  if (!value) return null;
  const number = Number(String(value).replace("%", "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function shortName(value, limit = 46) {
  const clean = String(value || "").trim();
  if (!clean) return "--";
  return clean.length > limit ? `${clean.slice(0, Math.max(limit - 3, 12))}...` : clean;
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
