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
```

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
- `DISABLE_PWA` (client build) – set to `true` to disable PWA

## Notes

- Auth/session data and profiles are stored in memory (not persistent).
- Email delivery is stubbed and logs codes to the server console.

## License

MIT
