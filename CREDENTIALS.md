# NodeZ — Credentials & API Setup

> Mirrors the live Notion credentials page at https://www.notion.so/343704adcc0e8189b99de292d4eab267
> The actual GitHub PAT secret is stored only in Notion + Windows Credential Manager. Never paste it into source files.

---

## GitHub

- **Repo:** https://github.com/omerzahav-pixel/claude-repo-for-NodeZ
- **Username:** `omerzahav-pixel`
- **Authentication:** Personal Access Token (PAT) with `repo` + `workflow` scopes
- **Token storage:** saved in Notion private page + Windows Credential Manager after first push
- **First push:** when git prompts for password, paste the PAT (starts with `ghp_`). Windows will cache it.

---

## Google Cloud / OAuth

- **Project name:** `nodez-493411`
- **OAuth client ID** (safe to commit, lives in source code):
  ```
  696635339426-rmc4kuoqvap7khdpota1tjm3764mu29n.apps.googleusercontent.com
  ```
- **OAuth client type:** Web application
- **Authorized JavaScript origins (already configured):**
  - `http://localhost:5173` (Vite dev server)
  - `http://localhost:8080`
- **Authorized JavaScript origins to add later:** the Cloudflare Pages production URL (e.g., `https://nodez.pages.dev`) — add after Phase 0 deploy
- **Authorized redirect URIs:** none (using GIS token model, not auth code flow)
- **APIs enabled:** Google Drive API, Google Calendar API
- **client_secret status:** the original was rotated and deleted after exposure. The current `client_id` above is safe to use.

---

## OAuth scopes the app will request

- `https://www.googleapis.com/auth/drive.appdata` — workspace JSON storage in invisible appdata folder
- `https://www.googleapis.com/auth/calendar` — read + write calendar events
- `openid email profile` — basic identity

---

## Cloudflare

- **Account:** ready, not yet connected to repo
- **Plan:** free tier (sufficient — unlimited bandwidth, 500 builds/month)
- **Setup steps for Phase 0:**
  1. Log in at dash.cloudflare.com
  2. Workers & Pages → Create → Pages → Connect to Git
  3. Authorize GitHub access for the `claude-repo-for-NodeZ` repo
  4. Build settings: framework preset = Vite, build command = `npm run build`, output directory = `dist`
  5. Deploy. Cloudflare gives you a URL like `claude-repo-for-nodez.pages.dev`
  6. **Then:** go back to console.cloud.google.com → Credentials → NodeZ Web Client → add the Cloudflare URL to Authorized JavaScript origins (otherwise OAuth fails in production)

---

## Security rules

- **Add to `.gitignore` immediately:**
  ```
  *client_secret*.json
  .env
  .env.local
  node_modules/
  dist/
  .DS_Store
  ```
- **Never commit:** any file containing `client_secret`, GitHub PATs, OAuth refresh tokens, API keys
- **Safe to commit:** the OAuth `client_id` above (it's a public identifier, not a secret)
- **Refresh tokens:** not used in this app (we use the GIS token model — short-lived access tokens only)
