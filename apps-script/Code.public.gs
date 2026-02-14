const SETTINGS = {
  SHEET_ID: "",
  SHEET_NAME: "ECM",
  PUBLIC_TOKEN: ""
};

function doGet(e) {
  const payload = e && e.parameter ? e.parameter : {};

  if (!SETTINGS.SHEET_ID || !SETTINGS.SHEET_NAME) {
    return json_({ ok: false, error: "Backend not configured (missing SHEET_ID or SHEET_NAME)" });
  }

  if (SETTINGS.PUBLIC_TOKEN) {
    if (!payload.token || payload.token !== SETTINGS.PUBLIC_TOKEN) {
      return json_({ ok: false, error: "Unauthorized" });
    }
  }

  const action = String(payload.action || "").toLowerCase();
  if (action !== "list") {
    return json_({ ok: false, error: "Read-only endpoint supports only 'list'" });
  }

  const sheet = getSheet_();
  if (!sheet) {
    return json_({ ok: false, error: "Sheet tab not found" });
  }

  return listRows_(sheet);
}

function doPost() {
  return json_({ ok: false, error: "Read-only endpoint does not accept POST" });
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SETTINGS.SHEET_ID);
  return ss.getSheetByName(SETTINGS.SHEET_NAME);
}

function listRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return json_({ ok: true, beanLabel: "Bean", rows: [] });
  }

  const values = sheet.getRange(1, 1, lastRow, 6).getDisplayValues();
  const headers = values[0] || [];
  if (headers[0] !== "Active") {
    return json_({ ok: false, error: "Column A header must be 'Active'" });
  }
  const beanLabel = String(headers[1] || "Bean").trim() || "Bean";

  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const row = values[i];
    rows.push({
      rowIndex: i + 1,
      Active: row[0] || "TRUE",
      Bean: row[1] || "",
      Decaf: row[1] || "",
      "Grind setting": row[2] || "",
      Notes: row[3] || "",
      Taste: row[4] || "",
      Roast: row[5] || ""
    });
  }

  return json_({ ok: true, beanLabel: beanLabel, rows: rows });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
