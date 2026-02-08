"use strict";

const REQUIRED_CONFIG_KEYS = ["GOOGLE_CLIENT_ID", "SHEET_ID", "SHEET_NAME"];
const DEFAULT_RANGE = "A:F";

const state = {
  tokenClient: null,
  accessToken: null,
  sheetId: null,
  rows: [],
  filteredRows: [],
  editingRow: null,
  isOffline: false,
};

const ui = {
  statusPill: document.getElementById("status-pill"),
  signIn: document.getElementById("btn-signin"),
  signOut: document.getElementById("btn-signout"),
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
    GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID,
    SHEET_ID: config.SHEET_ID,
    SHEET_NAME: config.SHEET_NAME,
    SHEET_RANGE: config.SHEET_RANGE || DEFAULT_RANGE,
  };
}

function setStatus(text, isAuthed) {
  ui.statusPill.textContent = text;
  ui.signIn.disabled = !!isAuthed;
  ui.signOut.disabled = !isAuthed;
  ui.refresh.disabled = !isAuthed;
  ui.add.disabled = !isAuthed || state.isOffline;
}

function setOffline(isOffline) {
  state.isOffline = isOffline;
  document.body.classList.toggle("offline", isOffline);
  if (isOffline) {
    setStatus("Offline (cached)", state.accessToken);
    ui.add.disabled = true;
  } else if (state.accessToken) {
    setStatus("Signed in", true);
    ui.add.disabled = false;
  }
}

function initAuth() {
  const config = getConfig();
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: config.GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    callback: (response) => {
      if (response && response.access_token) {
        state.accessToken = response.access_token;
        setStatus("Signed in", true);
        setOffline(!navigator.onLine);
        loadAllData().catch(showError);
      }
    },
  });
}

function signIn() {
  state.tokenClient.requestAccessToken({ prompt: "consent" });
}

function signOut() {
  state.accessToken = null;
  setStatus("Signed out", false);
  state.rows = [];
  render();
}

async function apiFetch(url, options = {}) {
  if (!state.accessToken) {
    throw new Error("Not signed in");
  }
  const headers = Object.assign({}, options.headers, {
    Authorization: `Bearer ${state.accessToken}`,
  });
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  return response.json();
}

async function loadAllData() {
  const config = getConfig();
  const range = `${config.SHEET_NAME}!${config.SHEET_RANGE}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${encodeURIComponent(
    range
  )}`;
  const data = await apiFetch(url);
  const values = data.values || [];
  const headers = values[0] || [];
  if (headers.length && headers[0] !== "Active") {
    throw new Error(
      "Expected column A header to be 'Active'. Please add an 'Active' column as the first header."
    );
  }
  const rows = values.slice(1).map((row, index) => {
    return {
      rowIndex: index + 2,
      Active: normalizeActive(row[0]),
      Decaf: row[1] || "",
      "Grind setting": row[2] || "",
      Notes: row[3] || "",
      Taste: row[4] || "",
      Roast: row[5] || "",
    };
  });
  state.rows = rows;
  saveCache({ headers, rows });
  await ensureSheetId(config);
  render();
}

async function ensureSheetId(config) {
  if (state.sheetId) {
    return state.sheetId;
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}?fields=sheets.properties`;
  const data = await apiFetch(url);
  const sheet = (data.sheets || []).find(
    (item) => item.properties && item.properties.title === config.SHEET_NAME
  );
  if (!sheet) {
    throw new Error(`Sheet tab not found: ${config.SHEET_NAME}`);
  }
  state.sheetId = sheet.properties.sheetId;
  return state.sheetId;
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
    : "Changes are saved to your Google Sheet.";
  ui.modal.classList.remove("hidden");
}

function closeModal() {
  ui.modal.classList.add("hidden");
}

function getRowPayload() {
  return [
    ui.fieldActive.value,
    ui.fieldDecaf.value.trim(),
    ui.fieldGrind.value.trim(),
    ui.fieldNotes.value.trim(),
    ui.fieldTaste.value.trim(),
    ui.fieldRoast.value.trim(),
  ];
}

async function addRow() {
  const config = getConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${encodeURIComponent(
    `${config.SHEET_NAME}!${config.SHEET_RANGE}`
  )}:append?valueInputOption=USER_ENTERED`;
  await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [getRowPayload()] }),
  });
  await loadAllData();
}

async function updateRow() {
  const config = getConfig();
  if (!state.editingRow) {
    return;
  }
  const rowIndex = state.editingRow.rowIndex;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}/values/${encodeURIComponent(
    `${config.SHEET_NAME}!A${rowIndex}:F${rowIndex}`
  )}?valueInputOption=USER_ENTERED`;
  await apiFetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [getRowPayload()] }),
  });
  await loadAllData();
}

async function deleteRow() {
  const config = getConfig();
  if (!state.editingRow) {
    return;
  }
  await ensureSheetId(config);
  const rowIndex = state.editingRow.rowIndex;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.SHEET_ID}:batchUpdate`;
  await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: state.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });
  await loadAllData();
}

function saveCache(payload) {
  localStorage.setItem("coffeeCache", JSON.stringify({
    savedAt: new Date().toISOString(),
    payload,
  }));
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
  ui.statusPill.textContent = "Error";
  alert(String(error.message || error));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function registerEvents() {
  ui.signIn.addEventListener("click", signIn);
  ui.signOut.addEventListener("click", signOut);
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

  window.addEventListener("online", () => setOffline(false));
  window.addEventListener("offline", () => setOffline(true));
}

function initCacheView() {
  const cached = loadCache();
  if (cached) {
    state.rows = cached.rows || [];
    render();
    setOffline(!navigator.onLine);
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
    ui.statusPill.textContent = "Missing config";
    alert(String(error.message || error));
    return;
  }
  registerEvents();
  initCacheView();
  registerServiceWorker();
  setStatus("Signed out", false);
  if (window.google && google.accounts) {
    initAuth();
  } else {
    window.addEventListener("load", initAuth, { once: true });
  }
}

init();
