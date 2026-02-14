# Coffee Bean Tracker

Lightweight PWA for tracking beans, grind settings, and tasting notes from one Google Sheet.

## Current Architecture
- Frontend (`index.html`, `app.js`) calls an Apps Script web endpoint.
- Apps Script reads/writes sheet rows.
- No Google sign-in flow in the app UI.

## 1) Sheet Requirements
Use this exact header row in tab `ECM`:

`Active | Decaf | Grind setting | Notes | Taste | Roast`

## 2) Deploy Apps Script Backend
1. Open [script.new](https://script.new) while signed into your Google account.
2. Replace default code with `/Users/vleung1/Documents/New project/apps-script/Code.gs`.
3. In `SETTINGS`, fill:
- `SHEET_ID`
- `SHEET_NAME` (currently `ECM`)
- `API_TOKEN` (long random string)
4. Save.
5. Deploy -> New deployment -> Type: `Web app`.
6. Execute as: `Me`.
7. Who has access: `Anyone`.
8. Deploy and copy the `Web app URL`.

## 3) Configure Frontend
Edit `/Users/vleung1/Documents/New project/config.js`:

```js
window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  API_TOKEN: "same-token-used-in-apps-script"
};
```

## 4) Deploy Frontend
1. Commit and push to `main`.
2. GitHub Pages serves from root (`/`).
3. Open [https://vleung1.github.io/bean-tracker-vl/](https://vleung1.github.io/bean-tracker-vl/).

## Notes
- App caches last successful dataset for offline read.
- Add/Edit/Delete disabled while offline.
- If you change Apps Script code later, create a new deployment version and update `API_URL` only if deployment ID changes.
