"use strict";

const REQUIRED_CONFIG_KEYS = ["API_URL", "API_TOKEN"];

const state = {
  rows: [],
  filteredRows: [],
  editingRow: null,
  isOffline: false,
};

const ui = {
  statusPill: document.getElementById("status-pill"),
  refresh: document.getElementById("btn-refresh"),
  add: document.getElementById("btn-add"),
  search: document.getElementById("search-input"),
  roastFilter: document.getElementById("roast-filter"),
  notesFilter: document.getElementById("notes-filter"),
  sort: document.getElementById("sort-select"),
  summary: document.getElementById("summary"),
  tableBody: document.getElementById("table-body"),
  empty: document.getElementById("empty-state"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modal-title"),
  modalHint: document.getElementById("modal-hint"),
  close: document.getElementById("btn-close"),
  form: document.getElementById("bean-form"),
  delete: document.getElementById("btn-delete"),
  fieldDecaf: document.getElementById("field-decaf"),
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
    API_TOKEN: config.API_TOKEN,
  };
}

function setStatus(text) {
  ui.statusPill.textContent = text;
}

function setOffline(isOffline) {
  state.isOffline = isOffline;
  document.body.classList.toggle("offline", isOffline);
  if (isOffline) {
    setStatus("Offline (cached)");
    ui.add.disabled = true;
    ui.refresh.disabled = true;
  } else {
    setStatus("Connected");
    ui.add.disabled = false;
    ui.refresh.disabled = false;
  }
}

async function apiRequest(action, payload = {}) {
  const config = getConfig();
  const response = await fetch(config.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: config.API_TOKEN,
      action,
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Unknown backend error");
  }
  return data;
}

async function loadAllData() {
  const data = await apiRequest("list");
  state.rows = (data.rows || []).map((row) => ({
    rowIndex: Number(row.rowIndex),
    Active: normalizeActive(row.Active),
    Decaf: row.Decaf || "",
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
  const notesOnly = ui.notesFilter.checked;

  state.filteredRows = state.rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.Decaf.toLowerCase().includes(query) ||
      row.Notes.toLowerCase().includes(query);
    const matchesRoast = !roast || row.Roast === roast;
    const matchesNotes = !notesOnly || row.Notes.trim().length > 0;
    return matchesQuery && matchesRoast && matchesNotes;
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
    return String(a.Decaf).localeCompare(String(b.Decaf));
  });
  state.filteredRows = sorted;
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
  updateRoastFilter();
  applyFilters();

  ui.tableBody.innerHTML = "";
  state.filteredRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.Active ? "Active" : "Inactive"}</td>
      <td>${escapeHtml(row.Decaf)}</td>
      <td>${escapeHtml(row["Grind setting"])}</td>
      <td>${escapeHtml(row.Taste)}</td>
      <td>${escapeHtml(row.Roast)}</td>
      <td><div class="notes">${escapeHtml(row.Notes)}</div></td>
      <td>
        <div class="row-actions">
          <button data-action="edit" data-row="${row.rowIndex}" class="ghost">Edit</button>
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
  state.editingRow = row || null;
  ui.modalTitle.textContent = row ? "Edit bean" : "Add bean";
  ui.fieldDecaf.value = row ? row.Decaf : "";
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
  return {
    Active: ui.fieldActive.value,
    Decaf: ui.fieldDecaf.value.trim(),
    "Grind setting": ui.fieldGrind.value.trim(),
    Notes: ui.fieldNotes.value.trim(),
    Taste: ui.fieldTaste.value.trim(),
    Roast: ui.fieldRoast.value.trim(),
  };
}

async function addRow() {
  await apiRequest("add", { row: getRowData() });
  await loadAllData();
}

async function updateRow() {
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
  ui.refresh.addEventListener("click", () => loadAllData().catch(showError));
  ui.add.addEventListener("click", () => openModal());
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
  ui.notesFilter.addEventListener("change", render);
  ui.sort.addEventListener("change", render);

  ui.tableBody.addEventListener("click", (event) => {
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
  setOffline(!navigator.onLine);

  if (!state.isOffline) {
    loadAllData().catch(showError);
  }
}

init();
