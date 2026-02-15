# Capsule Wardrobe App

A full-stack prototype for building a capsule wardrobe. The backend is Node.js + Express, and the frontend is React + MUI. The app supports passwordless email login, profile onboarding, and localization (EN/RU).

## Features

- Passwordless email sign-in with verification codes
- Onboarding flow with style and wardrobe needs selection
- Profile edit/delete
- Localization (English/Russian) with a UI switcher
- Single-port dev setup (API + UI) with Vite middleware
- PWA-ready configuration (optional in dev)

## Requirements

- Node.js 18+ (recommended)
- npm

## Setup

```bash
npm install
cp server/.env.example server/.env
```

Then set in `server/.env`:
- `DATABASE_URL`
- `AUTH_CODE_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Development

Start the API + UI on the same port:

```bash
npm --workspace server run dev
```

Open:

```
http://localhost:3000
```

Disable PWA during development:

```bash
npm run dev:no-pwa
```

Run server in auth test mode (login code printed to terminal instead of email):

```bash
npm run dev:server:test-auth
```

## Production build

```bash
npm --workspace client run build
npm --workspace server run start
```

## Project structure

```
client/    # React app (Vite + MUI)
server/    # Node.js API (Express)
```

## Environment variables

- `PORT` (server) – default: 3000
- `CLIENT_ORIGIN` (server) – default: http://localhost:5173
- `DATABASE_URL` (server) – Postgres connection string
- `AUTH_CODE_SECRET` (server) – secret used for HMAC hashing of login codes
- `RESEND_API_KEY` (server) – API key for Resend mail delivery
- `RESEND_FROM_EMAIL` (server) – verified sender for Resend, e.g. `Capsule Wardrobe <auth@yourdomain.com>`
- `SESSION_PRUNE_MIN_INTERVAL_MS` (server) – minimum interval between session cleanup runs (default: `0`)
- `AUTH_TEST_MODE` (server) – when `true` (and not production), auth code is printed to server terminal and not sent via email
- `DISABLE_PWA` (client build) – set to `true` to disable PWA
- `BFF_UPSTREAM_ORIGIN` (Netlify client) – backend origin for Netlify BFF proxy, e.g. `https://your-api.onrender.com`

## Health check

After starting the app, verify API + DB connectivity:

```bash
curl http://localhost:3000/health
```

## Notes

- Login codes are sent via Resend (or printed to server logs when `AUTH_TEST_MODE=true` in non-production).
- Sessions and profiles are persisted in Postgres (including styles, occasions, and locale).
- For Netlify deployments, API requests are proxied through `/api/*` via `client/netlify/functions/bff.js` to keep auth cookies first-party.

## License

MIT
