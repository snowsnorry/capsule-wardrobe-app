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
- `SESSION_PRUNE_MIN_INTERVAL_MS` (server) – minimum interval between session cleanup runs (default: `0`)
- `DISABLE_PWA` (client build) – set to `true` to disable PWA

## Health check

After starting the app, verify API + DB connectivity:

```bash
curl http://localhost:3000/health
```

## Notes

- Login code delivery is currently stubbed and logs codes to the server console.
- Sessions and profiles are persisted in Postgres (including styles, occasions, and locale).

## License

MIT
