# Deploying to cPanel (biai-crm.boraqs.com + biai-simulator.boraqs.com)

Two sites, one folder (`biai`) in the cPanel home directory:

| Site | What it is | Folder on the server |
|---|---|---|
| `https://biai-crm.boraqs.com` | The CRM: one Node.js app that serves the API and the web app | `~/biai/crm` |
| `https://biai-simulator.boraqs.com` | The channel simulator: static files only | `~/biai/simulator` |

GitHub Actions (`.github/workflows/deploy-cpanel.yml`) builds both and uploads them over FTPS on
every push to `main`. Do steps 1–4 once, in order. Never paste secrets into chat or commit them;
they go into cPanel or GitHub secret fields only.

## 1. Subdomains and HTTPS

1. cPanel → **Domains** → *Create A New Domain* → `biai-crm.boraqs.com`. Untick *Share document
   root*; keep the suggested document root (e.g. `biai-crm.boraqs.com`). The Node.js app answers
   this domain, so nothing goes in that folder.
2. *Create A New Domain* → `biai-simulator.boraqs.com`. Untick *Share document root* and set the
   document root to **`biai/simulator`**. The deploy uploads the simulator's files there.
3. cPanel → **SSL/TLS Status** → select both domains → *Run AutoSSL*. Wait for valid certificates.

## 2. PostgreSQL database

1. cPanel → **PostgreSQL Databases** → *Create New Database*: `biai`. cPanel adds your username as a
   prefix, e.g. `boraqs_biai`.
2. *Add New User*: `biai` with a strong generated password (e.g. `boraqs_biai`).
3. *Add User To Database*: give that user **ALL PRIVILEGES** on the database.
4. Your connection string (keep it private):
   `postgresql://boraqs_biai:<password>@localhost:5432/boraqs_biai`

PostgreSQL 12 or newer works. Tables are created automatically when the app starts.

## 3. Node.js app

cPanel → **Setup Node.js App** → *Create Application*:

| Field | Value |
|---|---|
| Node.js version | the newest offered (22 or later) |
| Application mode | Production |
| Application root | `biai/crm` |
| Application URL | `biai-crm.boraqs.com` (path empty) |
| Application startup file | `app.cjs` |

Then add these **Environment variables** in the same screen:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_OPTIONS` | `--disable-wasm-trap-handler` (shared hosts cap memory; without it Node's `fetch` can crash) |
| `DATABASE_URL` | the connection string from step 2 |
| `JWT_SECRET` | 64 random characters (password manager, or `openssl rand -hex 32`) |
| `CHANNEL_KEY` | another random string (`openssl rand -hex 24`); the same value goes into GitHub in step 4 |
| `CHANNEL_ALLOWED_ORIGINS` | `https://biai-simulator.boraqs.com` |
| `CRM_PUBLIC_URL` | `https://biai-crm.boraqs.com` |
| `SIMULATOR_PUBLIC_URL` | `https://biai-simulator.boraqs.com` |
| `GEMINI_API_KEY` + `GEMINI_MODEL` | optional: live AI (or `MODEL_API_KEY` + `META_MODEL`, or `OPENAI_API_KEY` + `OPENAI_MODEL`) |

**Or put them in one file instead:** create `/home/<cpanel-user>/biai.env` in File Manager (your
home folder, outside any website folder, so it can't be downloaded) with one `NAME=value` per line,
then Restart the app. Values set in the screen above take precedence over the file.

Click **Save**. Don't run *NPM install*: the deploy uploads the server already bundled into one file
(`server.mjs`), so it needs no `node_modules`.

## 4. Deploys from GitHub

Repository **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `CPANEL_HOST` | your server's hostname (cPanel sidebar, e.g. `server123.host.com`) |
| `CPANEL_USER` | your cPanel username |
| `CPANEL_FTP_PASSWORD` | your cPanel/FTP password (FTPS is used) |
| `CHANNEL_KEY` | exactly the same value as `CHANNEL_KEY` in step 3 |
| `CPANEL_SSH_KEY` | optional: if set, rsync over SSH is used instead of FTP |
| `CPANEL_SSH_PORT` | optional: only if SSH isn't on port 22 |

Optional **variables** (same page, *Variables* tab): `CPANEL_APP_DIR` (default `biai/crm`),
`CPANEL_SIMULATOR_DIR` (default `biai/simulator`), and `CPANEL_FTP_VERIFY_TLS=no` only if your host's
FTP certificate doesn't match its hostname.

Then run it: **Actions → Deploy to cPanel → Run workflow** (afterwards every push to `main` that
touches `client/`, `server/` or `simulator/` deploys by itself). The job:

1. builds the CRM web app, bundles the API into `deploy/crm` and builds the simulator with the CRM's
   URL and the channel key;
2. uploads `deploy/crm` → `~/biai/crm` and `deploy/simulator` → `~/biai/simulator`, deleting old
   files but never `.htaccess`, `.env`, `stderr.log` or `.well-known`;
3. restarts the app by updating `~/biai/crm/tmp/restart.txt`;
4. checks `https://biai-crm.boraqs.com/api/health`, both web apps, and that the simulator may call
   the CRM (CORS and channel key).

If no cPanel secrets are set yet, the job skips itself instead of failing. `CI`
(`.github/workflows/ci.yml`) runs the type checks, builds and the full test suite on PostgreSQL 12
and 16 for every push and pull request.

## 5. Check it

- `https://biai-crm.boraqs.com/api/health` → `{"status":"ok"}`
- `https://biai-crm.boraqs.com` → sign-in page; pick a demo account (password `Admin123!`)
- `https://biai-simulator.boraqs.com` → send a WhatsApp message, then click **View in CRM**

## Before sharing the links

- The demo accounts and their password are shown on the sign-in page, so anyone with the link can
  sign in and change data. That suits a demo; use **account menu → Restore sample data**
  to reset it. For real use, add your own accounts on the Team page and change the demo passwords.
- The channel key is built into the simulator's JavaScript, so anyone who opens the simulator can
  send test enquiries (rate-limited to 30 a minute). Rotate `CHANNEL_KEY` in both places to revoke it.
- With an AI key configured, model costs are paid by the key's owner (AI routes are rate-limited).

## Troubleshooting

- **503 or "Incomplete response":** open `~/biai/crm/stderr.log`. "Cannot connect to PostgreSQL"
  means `DATABASE_URL` is wrong; "JWT_SECRET must be set" means it is missing.
- **Database connection refused:** use `localhost` (the app turns it into `127.0.0.1`) and port 5432.
- **Simulator says it can't reach the CRM:** `CHANNEL_ALLOWED_ORIGINS` must be exactly
  `https://biai-simulator.boraqs.com`, and both `CHANNEL_KEY` values must match. Re-run the deploy
  after changing the GitHub secret, because the key is built into the simulator.
- **Simulator shows a cPanel default page:** the subdomain's document root isn't `biai/simulator`.
- **Changes don't appear:** Setup Node.js App → *Restart*, or re-run the deploy workflow.
