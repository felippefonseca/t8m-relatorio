const loginView = document.querySelector("#loginView");
const dashboardView = document.querySelector("#dashboardView");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
const campaignRows = document.querySelector("#campaignRows");
const mobileCampaigns = document.querySelector("#mobileCampaigns");
const emptyState = document.querySelector("#emptyState");
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
  campaignPeriodEyebrow: document.querySelector("#campaignPeriodEyebrow")
};

let selectedAdAccountId = localStorage.getItem("t8m_meta_ad_account_id") || "";

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
  refreshButton.disabled = true;
  refreshButton.textContent = "Atualizando...";

  try {
    const data = await request(buildDashboardUrl());
    renderDashboard(data);
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      loginMessage.textContent = "Sessao expirada.";
      return;
    }
    fields.sourceLabel.textContent = "Indisponivel";
    fields.lastUpdated.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Atualizar";
  }
}

function renderDashboard(data) {
  const account = data.account;
  const periodLabel = data.period?.label || selectedPeriodLabel();
  fields.sourceLabel.textContent = data.source.label;
  fields.accountName.textContent = account.name;
  fields.accountStatus.textContent = `Conta ${account.status.toLowerCase()}`;
  fields.lastUpdated.textContent = `Atualizado em ${formatDateTime(data.updatedAt)}`;
  fields.balanceValue.textContent = account.balance.formatted;
  fields.balanceHint.textContent =
    data.source.mode === "live" ? "Saldo informado pela Meta" : "Dados de demonstracao";
  fields.remainingCapValue.textContent = account.remainingCap.formatted;
  fields.spendCapValue.textContent = `Limite total: ${account.spendCap.formatted}`;
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

  renderCampaignRows(data.campaigns);
  renderCampaignCards(data.campaigns);
  emptyState.classList.toggle("hidden", data.campaigns.length > 0);
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

function formatDateOnly(value) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}`;
}

function readableObjective(value) {
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
  return labels[value] || value.replaceAll("_", " ").toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
