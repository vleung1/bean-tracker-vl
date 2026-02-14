# Coffee Bean Tracker

Two URLs are supported:
- Public read-only: `/`
- Private editor: `/editor/`

## URL Model
- Public URL: [https://vleung1.github.io/bean-tracker-vl/](https://vleung1.github.io/bean-tracker-vl/)
- Editor URL: [https://vleung1.github.io/bean-tracker-vl/editor/](https://vleung1.github.io/bean-tracker-vl/editor/)

## Sheet Requirements
Use this header row in tab `ECM`:

`Active | Bean | Grind setting | Notes | Taste | Roast`

`Bean` can also be `Decaf`; the app will map either label.

## Backend Setup (Apps Script)
Create two Apps Script web app deployments.

### 1) Public Read-only Deployment
1. Open [script.new](https://script.new).
2. Paste `/Users/vleung1/Documents/New project/apps-script/Code.public.gs`.
3. Fill `SETTINGS`:
- `SHEET_ID`
- `SHEET_NAME`
- `PUBLIC_TOKEN` (optional; leave blank for fully public reads)
4. Deploy as Web app:
- Execute as: `Me`
- Who has access: `Anyone`
5. Copy the `/exec` URL (this is `PUBLIC_API_URL`).

### 2) Editor Deployment (CRUD)
1. Create another Apps Script project.
2. Paste `/Users/vleung1/Documents/New project/apps-script/Code.editor.gs`.
3. Fill `SETTINGS`:
- `SHEET_ID`
- `SHEET_NAME`
- `API_TOKEN` (required, long random string)
4. Deploy as Web app:
- Execute as: `Me`
- Who has access: `Anyone`
5. Copy the `/exec` URL (this is `EDITOR_API_URL`).

## Frontend Config

### Public (`/`)
Edit `/Users/vleung1/Documents/New project/config.js`:

```js
window.CONFIG = {
  API_URL: "PUBLIC_API_URL",
  API_TOKEN: "PUBLIC_TOKEN_IF_USED",
  APP_MODE: "public"
};
```

### Editor (`/editor/`)
Edit `/Users/vleung1/Documents/New project/editor/config.js`:

```js
window.CONFIG = {
  API_URL: "EDITOR_API_URL",
  API_TOKEN: "EDITOR_API_TOKEN",
  APP_MODE: "editor"
};
```

## Deploy Frontend
1. Commit and push to `main`.
2. GitHub Pages serves from root.
3. Visit public URL for read-only sharing.
4. Use `/editor/` for private edits.

## Notes
- Public UI hides Add/Edit/Delete controls.
- Editor UI enables Add/Edit/Delete controls.
- If Apps Script code changes, deploy a new version.
- If mobile shows stale UI, clear Safari site data for `vleung1.github.io`.
