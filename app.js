const STORAGE_KEY = "wealthOverviewData";
const initialData = {
  assets: [],
  debts: [],
  income: [],
  expenses: [],
  snapshots: [],
};
const categories = {
  assets: [
    "Girokonto",
    "Tagesgeld",
    "Bargeld",
    "ETF / Aktien / Fonds",
    "Gold / Edelmetalle",
    "Immobilien",
    "Auto / Sachwerte",
    "Lebensversicherung / Rentenversicherung",
    "betriebliche Altersvorsorge",
    "private Rente",
  ],
  debts: [
    "Immobilienkredit",
    "Autokredit",
    "Privatkredit",
    "Kreditkarte",
    "Leasing",
    "offene Zahlungen",
  ],
  income: [
    "Gehalt",
    "Mieteinnahmen",
    "Kindergeld",
    "Ausschuettungen",
    "Sonstige Einnahme",
  ],
  expenses: [
    "Versicherungen",
    "Hausgeld",
    "Kredite",
    "Lebensmittel",
    "Auto",
    "Urlaub",
    "Sparrate",
    "Sonstige Ausgabe",
  ],
};
const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
function loadData() {
  try {
    return { ...initialData, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return { ...initialData };
  }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function number(value) {
  return Number.parseFloat(value || 0) || 0;
}
function formatMoney(value) {
  return money.format(number(value));
}
function totals(data) {
  const totalAssets = data.assets.reduce((s, i) => s + number(i.value), 0);
  const totalDebts = data.debts.reduce((s, i) => s + number(i.balance), 0);
  const totalIncome = data.income.reduce((s, i) => s + number(i.amount), 0);
  const totalExpenses = data.expenses.reduce((s, i) => s + number(i.amount), 0);
  const surplus = totalIncome - totalExpenses;
  const liquidity = data.assets
    .filter((i) => ["Girokonto", "Tagesgeld", "Bargeld"].includes(i.category))
    .reduce((s, i) => s + number(i.value), 0);
  return {
    totalAssets,
    totalDebts,
    netWorth: totalAssets - totalDebts,
    totalIncome,
    totalExpenses,
    surplus,
    savingsRate: totalIncome > 0 ? (surplus / totalIncome) * 100 : 0,
    liquidity,
  };
}
function setText(selector, value) {
  document.querySelectorAll(selector).forEach((n) => (n.textContent = value));
}
function fillCategories() {
  document
    .querySelectorAll("[data-asset-categories]")
    .forEach(
      (s) =>
        (s.innerHTML = categories.assets
          .map((v) => `<option>${v}</option>`)
          .join("")),
    );
  document
    .querySelectorAll("[data-debt-categories]")
    .forEach(
      (s) =>
        (s.innerHTML = categories.debts
          .map((v) => `<option>${v}</option>`)
          .join("")),
    );
  document
    .querySelectorAll("[data-income-categories]")
    .forEach(
      (s) =>
        (s.innerHTML = categories.income
          .map((v) => `<option>${v}</option>`)
          .join("")),
    );
  document
    .querySelectorAll("[data-expense-categories]")
    .forEach(
      (s) =>
        (s.innerHTML = categories.expenses
          .map((v) => `<option>${v}</option>`)
          .join("")),
    );
}
function renderGlobalMetrics(data) {
  const s = totals(data);
  setText("[data-total-assets]", formatMoney(s.totalAssets));
  setText("[data-total-debts]", formatMoney(s.totalDebts));
  setText("[data-net-worth]", formatMoney(s.netWorth));
  setText("[data-total-income]", formatMoney(s.totalIncome));
  setText("[data-total-expenses]", formatMoney(s.totalExpenses));
  setText("[data-surplus]", formatMoney(s.surplus));
  setText(
    "[data-savings-rate]",
    `${s.savingsRate.toFixed(1).replace(".", ",")} %`,
  );
  setText("[data-liquidity]", formatMoney(s.liquidity));
  setText("[data-snapshot-count]", `${data.snapshots.length} Monate`);
  const debtPaydown =
    data.snapshots.length >= 2
      ? data.snapshots[0].totalDebts -
        data.snapshots[data.snapshots.length - 1].totalDebts
      : 0;
  setText("[data-debt-paydown]", formatMoney(debtPaydown));
  setText(
    "[data-investment-value]",
    formatMoney(
      data.assets
        .filter((i) => i.category === "ETF / Aktien / Fonds")
        .reduce((s, i) => s + number(i.value), 0),
    ),
  );
  setText(
    "[data-retirement-value]",
    formatMoney(
      data.assets
        .filter((i) =>
          [
            "Lebensversicherung / Rentenversicherung",
            "betriebliche Altersvorsorge",
            "private Rente",
          ].includes(i.category),
        )
        .reduce((s, i) => s + number(i.value), 0),
    ),
  );
}
function formToObject(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  form
    .querySelectorAll("input[type='checkbox']")
    .forEach((input) => (values[input.name] = input.checked));
  return values;
}
function upsert(collection, entry) {
  return entry.id
    ? collection.map((item) =>
        item.id === entry.id ? { ...item, ...entry } : item,
      )
    : [
        ...collection,
        { ...entry, id: uid(), createdAt: new Date().toISOString() },
      ];
}
function fillForm(form, entry) {
  Object.entries(entry).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });
}
function emptyRow(message, colspan) {
  return `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}
function renderAssets(data) {
  const table = document.querySelector("[data-assets-table]");
  if (!table) return;
  table.innerHTML = data.assets.length
    ? data.assets
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.valuationDate || "-")}</td><td class="right">${formatMoney(i.value)}</td><td><div class="row-actions"><button class="ghost" data-edit-asset="${i.id}">Bearbeiten</button><button class="danger" data-delete-asset="${i.id}">Loeschen</button></div></td></tr>`,
        )
        .join("")
    : emptyRow("Noch keine Vermoegenswerte erfasst.", 5);
}
function renderDebts(data) {
  const table = document.querySelector("[data-debts-table]");
  if (!table) return;
  table.innerHTML = data.debts.length
    ? data.debts
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.lender || "-")}</td><td class="right">${formatMoney(i.balance)}</td><td><div class="row-actions"><button class="ghost" data-edit-debt="${i.id}">Bearbeiten</button><button class="danger" data-delete-debt="${i.id}">Loeschen</button></div></td></tr>`,
        )
        .join("")
    : emptyRow("Noch keine Schulden erfasst.", 5);
}
function renderCashflow(data) {
  renderCashflowTable("[data-income-table]", data.income, "income");
  renderCashflowTable("[data-expenses-table]", data.expenses, "expense");
}
function renderCashflowTable(selector, items, type) {
  const table = document.querySelector(selector);
  if (!table) return;
  table.innerHTML = items.length
    ? items
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.category)}</td><td class="right">${formatMoney(i.amount)}</td><td><div class="row-actions"><button class="danger" data-delete-${type}="${i.id}">Loeschen</button></div></td></tr>`,
        )
        .join("")
    : emptyRow("Noch keine Eintraege erfasst.", 4);
}
function renderRecent(data) {
  const table = document.querySelector("[data-recent-items]");
  if (!table) return;
  const items = [
    ...data.assets.map((i) => ({
      type: "Vermoegen",
      name: i.name,
      category: i.category,
      value: i.value,
      createdAt: i.createdAt,
    })),
    ...data.debts.map((i) => ({
      type: "Schuld",
      name: i.name,
      category: i.category,
      value: i.balance,
      createdAt: i.createdAt,
    })),
  ]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8);
  table.innerHTML = items.length
    ? items
        .map(
          (i) =>
            `<tr><td>${i.type}</td><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.category)}</td><td class="right">${formatMoney(i.value)}</td></tr>`,
        )
        .join("")
    : emptyRow("Noch keine Eintraege erfasst.", 4);
}
function groupByCategory(items, valueKey) {
  return items.reduce((groups, item) => {
    groups[item.category] =
      (groups[item.category] || 0) + number(item[valueKey]);
    return groups;
  }, {});
}
function renderBars(selector, groups) {
  const container = document.querySelector(selector);
  if (!container) return;
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  container.innerHTML = entries.length
    ? entries
        .map(
          ([label, value]) =>
            `<div class="bar-row"><strong>${escapeHtml(label)}</strong><div class="bar-track"><span style="width:${(value / max) * 100}%"></span></div><span class="right">${formatMoney(value)}</span></div>`,
        )
        .join("")
    : `<p class="empty">Noch keine Daten fuer diese Auswertung.</p>`;
}
function renderNetWorthChart(data) {
  document.querySelectorAll("[data-net-worth-chart]").forEach((container) => {
    const snapshots = data.snapshots.slice(-12);
    const max = Math.max(...snapshots.map((i) => Math.abs(i.netWorth)), 1);
    container.innerHTML = snapshots.length
      ? snapshots
          .map(
            (i) =>
              `<div class="bar-column"><div class="bar-fill" title="${formatMoney(i.netWorth)}" style="height:${Math.max(6, (Math.abs(i.netWorth) / max) * 220)}px"></div><span>${escapeHtml(i.month)}</span></div>`,
          )
          .join("")
      : `<p class="empty">Speichere einen Monat, um die Entwicklung zu sehen.</p>`;
  });
}
function renderReports(data) {
  renderBars("[data-asset-bars]", groupByCategory(data.assets, "value"));
  renderBars("[data-debt-bars]", groupByCategory(data.debts, "balance"));
  renderNetWorthChart(data);
}
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
function exportCsv(data) {
  const sections = [
    ["assets", data.assets],
    ["debts", data.debts],
    ["income", data.income],
    ["expenses", data.expenses],
  ];
  const rows = sections.flatMap(([section, items]) => {
    if (!items.length) return [[section]];
    const keys = [...new Set(items.flatMap((item) => Object.keys(item)))];
    return [
      [section],
      keys,
      ...items.map((item) => keys.map((key) => item[key])),
    ];
  });
  download(
    "vermoegensuebersicht.csv",
    rows.map((row) => row.map(csvEscape).join(";")).join("\n"),
    "text/csv;charset=utf-8",
  );
}
function saveSnapshot(data) {
  const s = totals(data);
  const month = new Date().toISOString().slice(0, 7);
  data.snapshots = [
    ...data.snapshots.filter((i) => i.month !== month),
    {
      month,
      totalAssets: s.totalAssets,
      totalDebts: s.totalDebts,
      netWorth: s.netWorth,
      surplus: s.surplus,
      createdAt: new Date().toISOString(),
    },
  ];
  saveData(data);
}
function bindEvents(data) {
  document
    .querySelector("[data-quick-asset-form]")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      const entry = formToObject(e.currentTarget);
      entry.valuationDate = new Date().toISOString().slice(0, 10);
      data.assets = upsert(data.assets, entry);
      saveData(data);
      location.reload();
    });
  document
    .querySelector("[data-asset-form]")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      data.assets = upsert(data.assets, formToObject(e.currentTarget));
      saveData(data);
      location.reload();
    });
  document
    .querySelector("[data-debt-form]")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      data.debts = upsert(data.debts, formToObject(e.currentTarget));
      saveData(data);
      location.reload();
    });
  document
    .querySelector("[data-income-form]")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      data.income = upsert(data.income, formToObject(e.currentTarget));
      saveData(data);
      location.reload();
    });
  document
    .querySelector("[data-expense-form]")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      data.expenses = upsert(data.expenses, formToObject(e.currentTarget));
      saveData(data);
      location.reload();
    });
  document.body.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    handleCollectionAction(t, "asset", "assets", data, "[data-asset-form]");
    handleCollectionAction(t, "debt", "debts", data, "[data-debt-form]");
    handleCollectionAction(t, "income", "income", data);
    handleCollectionAction(t, "expense", "expenses", data);
    if (t.matches("[data-save-snapshot]")) {
      saveSnapshot(data);
      location.reload();
    }
    if (t.matches("[data-export-json]"))
      download(
        "vermoegensuebersicht-backup.json",
        JSON.stringify(data, null, 2),
        "application/json",
      );
    if (t.matches("[data-export-csv]")) exportCsv(data);
    if (t.matches("[data-print-report]")) window.print();
    if (
      t.matches("[data-clear-data]") &&
      confirm("Alle lokalen Daten wirklich loeschen?")
    ) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
  document
    .querySelector("[data-import-json]")
    ?.addEventListener("change", async (e) => {
      const file = e.currentTarget.files?.[0];
      if (!file) return;
      saveData({ ...initialData, ...JSON.parse(await file.text()) });
      location.reload();
    });
}
function handleCollectionAction(
  target,
  singular,
  collectionName,
  data,
  formSelector,
) {
  const editId =
    target.dataset[`edit${singular[0].toUpperCase() + singular.slice(1)}`];
  const deleteId =
    target.dataset[`delete${singular[0].toUpperCase() + singular.slice(1)}`];
  if (editId && formSelector) {
    const form = document.querySelector(formSelector);
    const entry = data[collectionName].find((item) => item.id === editId);
    if (form && entry) fillForm(form, entry);
  }
  if (deleteId) {
    data[collectionName] = data[collectionName].filter(
      (item) => item.id !== deleteId,
    );
    saveData(data);
    location.reload();
  }
}
function init() {
  const data = loadData();
  fillCategories();
  renderGlobalMetrics(data);
  renderAssets(data);
  renderDebts(data);
  renderCashflow(data);
  renderRecent(data);
  renderReports(data);
  bindEvents(data);
}
init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
