"use strict";

const REQUIRED_CONFIG_KEYS = ["API_URL"];

const state = {
  rows: [],
  filteredRows: [],
  editingRow: null,
  isOffline: false,
  beanLabel: "Bean",
  activeFilter: "all",
};

const ui = {
  statusPill: document.getElementById("status-pill"),
  refresh: document.getElementById("btn-refresh"),
  add: document.getElementById("btn-add"),
  search: document.getElementById("search-input"),
  roastFilter: document.getElementById("roast-filter"),
  sort: document.getElementById("sort-select"),
  summary: document.getElementById("summary"),
  activeSummary: document.getElementById("active-summary"),
  chipAll: document.getElementById("chip-all"),
  chipActive: document.getElementById("chip-active"),
  chipInactive: document.getElementById("chip-inactive"),
  tableBody: document.getElementById("table-body"),
  empty: document.getElementById("empty-state"),
  colBeanLabel: document.getElementById("col-bean-label"),
  fieldBeanLabel: document.getElementById("field-bean-label"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalHint: document.getElementById("modal-hint"),
  close: document.getElementById("btn-close"),
  form: document.getElementById("bean-form"),
  delete: document.getElementById("btn-delete"),
  fieldBean: document.getElementById("field-decaf"),
  fieldGrind: document.getElementById("field-grind"),
  fieldTaste: document.getElementById("field-taste"),
  fieldRoast: document.getElementById("field-roast"),
  fieldNotes: document.getElementById("field-notes"),
  fieldActive: document.getElementById("field-active"),
};

function getConfig() {
  const config = window.CONFIG || {};
  const missing = REQUIRED_CONFIG_KEYS.filter((key) => !config[key]);
  if (missing.length) {
    throw new Error(`Missing config keys: ${missing.join(", ")}`);
  }
  return {
    API_URL: config.API_URL,
    API_TOKEN: config.API_TOKEN || "",
    APP_MODE: config.APP_MODE || "editor",
  };
}

function isEditorMode() {
  return getConfig().APP_MODE === "editor";
}

function setStatus(text) {
  if (ui.statusPill) {
    ui.statusPill.textContent = text;
  }
}

function setOffline(isOffline) {
  state.isOffline = isOffline;
  document.body.classList.toggle("offline", isOffline);
  const editorMode = isEditorMode();
  if (isOffline) {
    setStatus("Offline (cached)");
    if (ui.add) {
      ui.add.disabled = true;
    }
    if (ui.refresh) {
      ui.refresh.disabled = true;
    }
  } else {
    setStatus(editorMode ? "Connected (Editor)" : "Connected (View only)");
    if (ui.add) {
      ui.add.disabled = !editorMode;
    }
    if (ui.refresh) {
      ui.refresh.disabled = false;
    }
  }
}

async function apiRequest(action, payload = {}) {
  const config = getConfig();
  const url = new URL(config.API_URL);
  if (config.API_TOKEN) {
    url.searchParams.set("token", config.API_TOKEN);
  }
  url.searchParams.set("action", action);
  if (typeof payload.rowIndex !== "undefined") {
    url.searchParams.set("rowIndex", String(payload.rowIndex));
  }
  if (payload.row) {
    url.searchParams.set("row", JSON.stringify(payload.row));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Backend returned non-JSON response. Check Apps Script deployment settings.");
  }
  if (!data.ok) {
    throw new Error(data.error || "Unknown backend error");
  }
  return data;
}

async function loadAllData() {
  const data = await apiRequest("list");
  state.beanLabel = String(data.beanLabel || "Bean");
  state.rows = (data.rows || []).map((row) => ({
    rowIndex: Number(row.rowIndex),
    Active: normalizeActive(row.Active),
    Bean: row.Bean || row.Decaf || "",
    "Grind setting": row["Grind setting"] || "",
    Notes: row.Notes || "",
    Taste: row.Taste || "",
    Roast: row.Roast || "",
  }));

  saveCache({ rows: state.rows });
  render();
}

function applyFilters() {
  const query = ui.search.value.trim().toLowerCase();
  const roast = ui.roastFilter.value;

  state.filteredRows = state.rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.Bean.toLowerCase().includes(query) ||
      row.Notes.toLowerCase().includes(query);
    const matchesRoast = !roast || row.Roast === roast;
    const matchesActive =
      state.activeFilter === "all" ||
      (state.activeFilter === "active" && row.Active) ||
      (state.activeFilter === "inactive" && !row.Active);
    return matchesQuery && matchesRoast && matchesActive;
  });

  const sortKey = ui.sort.value;
  const sorted = [...state.filteredRows].sort((a, b) => {
    if (a.Active !== b.Active) {
      return a.Active ? -1 : 1;
    }
    if (sortKey === "taste") {
      return (parseFloat(b.Taste) || 0) - (parseFloat(a.Taste) || 0);
    }
    if (sortKey === "grind") {
      return (parseFloat(a["Grind setting"]) || 0) - (parseFloat(b["Grind setting"]) || 0);
    }
    if (sortKey === "roast") {
      return String(a.Roast).localeCompare(String(b.Roast));
    }
    return String(a.Bean).localeCompare(String(b.Bean));
  });
  state.filteredRows = sorted;
}

function applyColumnLabels() {
  ui.colBeanLabel.textContent = state.beanLabel;
  ui.fieldBeanLabel.textContent = state.beanLabel;
}

function renderActiveSummary() {
  const activeCount = state.rows.filter((row) => row.Active).length;
  const inactiveCount = state.rows.length - activeCount;
  ui.activeSummary.textContent = `Active: ${activeCount} | Inactive: ${inactiveCount}`;
}

function renderActiveChips() {
  const chips = [ui.chipAll, ui.chipActive, ui.chipInactive];
  chips.forEach((chip) => {
    chip.classList.toggle("is-selected", chip.dataset.activeFilter === state.activeFilter);
  });
}

function updateRoastFilter() {
  const roasts = [...new Set(state.rows.map((row) => row.Roast).filter(Boolean))].sort();
  const current = ui.roastFilter.value;
  ui.roastFilter.innerHTML = `<option value="">All roasts</option>`;
  roasts.forEach((roast) => {
    const option = document.createElement("option");
    option.value = roast;
    option.textContent = roast;
    ui.roastFilter.appendChild(option);
  });
  ui.roastFilter.value = current || "";
}

function render() {
  const editorMode = isEditorMode();
  applyColumnLabels();
  renderActiveSummary();
  renderActiveChips();
  updateRoastFilter();
  applyFilters();

  ui.tableBody.innerHTML = "";
  state.filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = row.Active ? "row-active" : "row-inactive";
    tr.innerHTML = `
      <td>${row.Active ? "Active" : "Inactive"}</td>
      <td>${escapeHtml(row.Bean)}</td>
      <td>${escapeHtml(row["Grind setting"])}</td>
      <td>${escapeHtml(row.Taste)}</td>
      <td>${escapeHtml(row.Roast)}</td>
      <td><div class="notes">${escapeHtml(row.Notes)}</div></td>
      <td>
        <div class="row-actions">
          ${editorMode ? `<button data-action="edit" data-row="${row.rowIndex}" class="ghost">Edit</button>` : ""}
        </div>
      </td>
    `;
    ui.tableBody.appendChild(tr);
  });

  const count = state.filteredRows.length;
  ui.summary.textContent = `${count} ${count === 1 ? "entry" : "entries"}`;
  ui.empty.classList.toggle("hidden", count > 0);
}

function openModal(row) {
  if (!isEditorMode()) {
    return;
  }
  state.editingRow = row || null;
  ui.modalTitle.textContent = row ? "Edit bean" : "Add bean";
  ui.fieldBean.value = row ? row.Bean : "";
  ui.fieldGrind.value = row ? row["Grind setting"] : "";
  ui.fieldTaste.value = row ? row.Taste : "";
  ui.fieldRoast.value = row ? row.Roast : "";
  ui.fieldNotes.value = row ? row.Notes : "";
  ui.fieldActive.value = row && !row.Active ? "FALSE" : "TRUE";
  ui.delete.classList.toggle("hidden", !row);
  ui.modalHint.textContent = state.isOffline
    ? "Offline mode: edits disabled until you reconnect."
    : "Changes are saved via the sheet API backend.";
  ui.modal.classList.remove("hidden");
}

function closeModal() {
  ui.modal.classList.add("hidden");
}

function getRowData() {
  const beanValue = ui.fieldBean.value.trim();
  return {
    Active: ui.fieldActive.value,
    Bean: beanValue,
    Decaf: beanValue,
    "Grind setting": ui.fieldGrind.value.trim(),
    Notes: ui.fieldNotes.value.trim(),
    Taste: ui.fieldTaste.value.trim(),
    Roast: ui.fieldRoast.value.trim(),
  };
}

async function addRow() {
  if (!isEditorMode()) {
    throw new Error("Read-only mode");
  }
  await apiRequest("add", { row: getRowData() });
  await loadAllData();
}

async function updateRow() {
  if (!isEditorMode()) {
    throw new Error("Read-only mode");
  }
  if (!state.editingRow) {
    return;
  }
  await apiRequest("update", {
    rowIndex: state.editingRow.rowIndex,
    row: getRowData(),
  });
  await loadAllData();
}

async function deleteRow() {
  if (!isEditorMode()) {
    throw new Error("Read-only mode");
  }
  if (!state.editingRow) {
    return;
  }
  await apiRequest("delete", {
    rowIndex: state.editingRow.rowIndex,
  });
  await loadAllData();
}

function saveCache(payload) {
  localStorage.setItem(
    "coffeeCache",
    JSON.stringify({
      savedAt: new Date().toISOString(),
      payload,
    })
  );
}

function loadCache() {
  const raw = localStorage.getItem("coffeeCache");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw).payload;
  } catch (error) {
    return null;
  }
}

function showError(error) {
  console.error(error);
  setStatus("Error");
  alert(String(error.message || error));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function registerEvents() {
  if (ui.refresh) {
    ui.refresh.addEventListener("click", () => loadAllData().catch(showError));
  }
  if (ui.add) {
    ui.add.addEventListener("click", () => openModal());
  }
  ui.close.addEventListener("click", closeModal);
  ui.modal.addEventListener("click", (event) => {
    if (event.target === ui.modal) {
      closeModal();
    }
  });

  ui.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.isOffline) {
      return;
    }
    try {
      if (state.editingRow) {
        await updateRow();
      } else {
        await addRow();
      }
      closeModal();
    } catch (error) {
      showError(error);
    }
  });

  ui.delete.addEventListener("click", async () => {
    if (!state.editingRow || state.isOffline) {
      return;
    }
    const confirmed = confirm("Delete this bean entry?");
    if (!confirmed) {
      return;
    }
    try {
      await deleteRow();
      closeModal();
    } catch (error) {
      showError(error);
    }
  });

  ui.search.addEventListener("input", render);
  ui.roastFilter.addEventListener("change", render);
  ui.sort.addEventListener("change", render);
  [ui.chipAll, ui.chipActive, ui.chipInactive].forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeFilter = chip.dataset.activeFilter;
      render();
    });
  });

  ui.tableBody.addEventListener("click", (event) => {
    if (!isEditorMode()) {
      return;
    }
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }
    const rowIndex = Number(button.dataset.row);
    const row = state.rows.find((item) => item.rowIndex === rowIndex);
    if (row) {
      openModal(row);
    }
  });

  window.addEventListener("online", () => {
    setOffline(false);
    loadAllData().catch(showError);
  });
  window.addEventListener("offline", () => setOffline(true));
}

function initCacheView() {
  const cached = loadCache();
  if (cached) {
    state.rows = cached.rows || [];
    render();
  }
}

function normalizeActive(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value || "").trim().toLowerCase();
  if (text === "" || text === "true" || text === "yes" || text === "1") {
    return true;
  }
  return false;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function init() {
  try {
    getConfig();
  } catch (error) {
    setStatus("Missing config");
    alert(String(error.message || error));
    return;
  }

  registerEvents();
  initCacheView();
  registerServiceWorker();
  document.body.classList.toggle("view-only", !isEditorMode());
  if (ui.add && !isEditorMode()) {
    ui.add.classList.add("hidden");
  }
  setOffline(!navigator.onLine);

  if (!state.isOffline) {
    loadAllData().catch(showError);
  }
}

init();
