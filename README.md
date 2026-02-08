# Coffee Bean Tracker

Lightweight PWA that reads/writes your Google Sheet (OAuth) to track beans, grind settings, and tasting notes.

## Setup
1. Copy `config.example.js` to `config.js`.
2. Fill in `GOOGLE_CLIENT_ID`, `SHEET_ID`, `SHEET_NAME`.
3. Serve locally with any static server.

## Google OAuth (required)
- Create a Google Cloud project.
- Enable Google Sheets API.
- Configure OAuth consent screen.
- Create OAuth Client ID (Web).
- Authorized JavaScript origins:
  - `http://localhost:5173` (or your local dev server)
  - Your GitHub Pages HTTPS origin.

## GitHub Pages
- Repo: `bean-tracker-vl`
- Pages source: `main` branch, `/` (root)

## Deploy
- Commit and push to GitHub.
- In repo settings, enable GitHub Pages (branch `main`, folder `/`).
- Visit the Pages URL and sign in.

## Notes
- Offline mode uses cached data (read-only).
- Delete/edit actions are disabled when offline.
