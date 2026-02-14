const SETTINGS = {
  SHEET_ID: "",
  SHEET_NAME: "ECM",
  API_TOKEN: ""
};

function doGet(e) {
  return route_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let payload = {};
  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return json_({ ok: false, error: "Invalid JSON body" });
    }
  }
  return route_(payload);
}

function route_(payload) {
  if (!SETTINGS.SHEET_ID || !SETTINGS.SHEET_NAME || !SETTINGS.API_TOKEN) {
    return json_({ ok: false, error: "Backend not configured (SETTINGS missing values)" });
  }

  if (!payload || payload.token !== SETTINGS.API_TOKEN) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  const action = String(payload.action || "").toLowerCase();
  if (!action) {
    return json_({ ok: false, error: "Missing action" });
  }

  const sheet = getSheet_();
  if (!sheet) {
    return json_({ ok: false, error: "Sheet tab not found" });
  }

  if (action === "list") {
    return listRows_(sheet);
  }
  if (action === "add") {
    return addRow_(sheet, payload.row || {});
  }
  if (action === "update") {
    return updateRow_(sheet, payload.rowIndex, payload.row || {});
  }
  if (action === "delete") {
    return deleteRow_(sheet, payload.rowIndex);
  }

  return json_({ ok: false, error: "Unsupported action" });
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SETTINGS.SHEET_ID);
  return ss.getSheetByName(SETTINGS.SHEET_NAME);
}

function listRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return json_({ ok: true, rows: [] });
  }

  const values = sheet.getRange(1, 1, lastRow, 6).getDisplayValues();
  const headers = values[0] || [];
  if (headers[0] !== "Active") {
    return json_({ ok: false, error: "Column A header must be 'Active'" });
  }

  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    rows.push({
      rowIndex: i + 1,
      Active: row[0] || "TRUE",
      Decaf: row[1] || "",
      "Grind setting": row[2] || "",
      Notes: row[3] || "",
      Taste: row[4] || "",
      Roast: row[5] || ""
    });
  }

  return json_({ ok: true, rows: rows });
}

function addRow_(sheet, row) {
  const payload = sanitizeRow_(row);
  sheet.appendRow(payload);
  return json_({ ok: true });
}

function updateRow_(sheet, rowIndex, row) {
  const idx = Number(rowIndex);
  if (!Number.isInteger(idx) || idx < 2 || idx > sheet.getLastRow()) {
    return json_({ ok: false, error: "Invalid rowIndex" });
  }

  const payload = sanitizeRow_(row);
  sheet.getRange(idx, 1, 1, 6).setValues([payload]);
  return json_({ ok: true });
}

function deleteRow_(sheet, rowIndex) {
  const idx = Number(rowIndex);
  if (!Number.isInteger(idx) || idx < 2 || idx > sheet.getLastRow()) {
    return json_({ ok: false, error: "Invalid rowIndex" });
  }

  sheet.deleteRow(idx);
  return json_({ ok: true });
}

function sanitizeRow_(row) {
  return [
    normalizeActive_(row.Active),
    safe_(row.Decaf),
    safe_(row["Grind setting"]),
    safe_(row.Notes),
    safe_(row.Taste),
    safe_(row.Roast)
  ];
}

function normalizeActive_(value) {
  const text = String(value == null ? "TRUE" : value).trim().toUpperCase();
  if (text === "FALSE" || text === "NO" || text === "0") {
    return "FALSE";
  }
  return "TRUE";
}

function safe_(value) {
  return String(value == null ? "" : value).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
