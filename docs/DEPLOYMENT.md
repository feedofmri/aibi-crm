# Running and sharing the demo

`http://localhost:5173` (development) or `http://localhost:4000` (production build) work only on the computer running the app. They are not reviewer links. The brief asks for a demo link only "if you have one"; the source, the Loom and the note are what matter.

## Reviewer setup (local)

Reviewers need Node.js 22+ and Docker:

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:up
```

```bash
npm run dev
```

No API key is needed. Without one the app uses labelled reviewed samples and a rule-based fallback.

## Hosting

The production server is a single Node process that serves the API and the built React app from one origin, so the session cookie and same-origin checks work without CORS.

1. Provision PostgreSQL 16 (managed, e.g. Neon, Supabase, Render or Railway Postgres) and note its connection string.
2. Deploy the repository with the included `Dockerfile`, or as a Node service:
   - build: `npm ci && npm run build`
   - start: `npm start`
3. Set environment variables on the host (never in the repository):
   - `NODE_ENV=production`
   - `HOST=0.0.0.0` and the platform's `PORT`
   - `DATABASE_URL=postgresql://…` (append `?sslmode=require` if the provider needs SSL)
   - `JWT_SECRET` – a long random value (`openssl rand -hex 32`). The server refuses to start in production without it.
   - optionally one AI provider key.
4. On start the server applies migrations, creates the demo team and imports the 20 samples if the database is empty.
5. Open the URL from another device and sign in to verify before sharing it.

Run a single instance (or several with sticky sessions; state is in PostgreSQL, so either works). Put HTTPS in front; production cookies are `Secure`.

### Before sharing a public link

- **Change the demo passwords** or add new accounts from the Team page. The demo password is printed on the sign-in screen by design, so a public link with demo accounts is open to anyone who visits.
- Model costs are paid by whoever owns the configured key. AI routes are rate-limited (30 requests/minute per client); consider removing the key for a public demo.
- Use only fictional sample data.

## Channel simulator (separate website)

The simulator in `simulator/` is a static site. Build and host it anywhere static files are served (Netlify, Vercel, Cloudflare Pages, S3, nginx):

- build command: `npm ci && npm run build -w simulator`; publish directory: `simulator/dist`
- build-time variables:
  - `VITE_API_URL` – the CRM's public URL, e.g. `https://crm.example.com`
  - `VITE_CHANNEL_KEY` – the same value as the server's `CHANNEL_KEY`

On the CRM server also set:

- `CHANNEL_KEY` – a random secret (`openssl rand -hex 24`). Without it in production, the inbound API returns 503.
- `CHANNEL_ALLOWED_ORIGINS` – the simulator's origin, e.g. `https://simulator.example.com`
- `CRM_PUBLIC_URL` and `SIMULATOR_PUBLIC_URL` – so each site links to the other.

The channel key is compiled into the simulator's JavaScript, so anyone who can open the simulator can send test enquiries. Treat it as a demo credential: inbound is rate-limited (30 messages a minute per client), and you can rotate the key or unset it to switch inbound off.

## Docker only

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose --profile app up --build
```

This starts PostgreSQL and the CRM on http://localhost:4000. Run the simulator separately (`npm run dev -w simulator`, or deploy it as above).
