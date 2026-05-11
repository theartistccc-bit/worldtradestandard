# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (auto-restart on file change)
npm run dev

# Production
npm start
```

No build step — the frontend is plain HTML/CSS/JS served statically. No transpilation, bundler, or test suite.

**Environment setup**: copy `.env.example` to `.env`. Without `FIREBASE_SERVICE_ACCOUNT`, the server runs in dev mode (no Firestore persistence; every authenticated request is granted `exec` tier automatically).

## Architecture

**WorldTradeStandard** is an AI trading assistant: a single-page frontend talking to a Node/Express backend that proxies Claude and Firestore.

### Backend (`server.js`)
Single Express file. All logic lives here:
- `verifyAuth` middleware — verifies Firebase ID tokens; in dev mode (no `FIREBASE_SERVICE_ACCOUNT`) grants `exec` access to any bearer token
- `logTokens()` — writes to `tokenLogs` Firestore collection after every Claude call
- `db = null` pattern — all Firestore writes are guarded with `if (db)` so the server degrades gracefully in dev mode

**AI endpoints** (all require `verifyAuth`):
- `POST /api/generate` — MQL code generation; free-tier users consume credits tracked in `users/{uid}.credits`
- `POST /api/markup` — Chart analysis (dev/exec only)
- `POST /api/debug` — MetaEditor error log analysis (dev/exec only)
- `POST /api/journal/analyse` — Trade AI analysis (dev/exec only)

**Data endpoints**: `/api/journal` (CRUD), `/api/eas` (list), `/api/user` (profile)

**Payments**: NowPayments crypto invoices. Webhook at `/api/nowpayments/webhook` verifies HMAC-SHA512 signature, then upgrades `users/{uid}.tier` on `finished`/`confirmed` status. Order ID format: `WTS-{plan}-{uid}-{timestamp}`.

**Model**: `claude-haiku-4-5-20251001` for all features.

### Frontend (`index.html` + `js/app.js`)
No framework. All UI is a state machine in `app.js` around a global `state` object.

- Auth: Firebase compat SDK v9 (`firebase.auth().onAuthStateChanged`)
- All API calls go through `callAPI()` / `callAPIGet()` which attach a Firebase ID token as `Authorization: Bearer`
- Tier system: `free` → `dev` → `exec`. `activateTier()` applies UI changes; `requireTier()` guards feature access
- `TRADING_KEYWORDS` array gates the Chart Markup chat — off-topic messages get `OFF_TOPIC_REPLY` without hitting the API

### Firestore collections
- `users/{uid}` — profile, `tier`, `credits`
- `eas/{id}` — generated MQL code
- `trades/{id}` — journal entries
- `payments/{id}` — NowPayments invoice records
- `tokenLogs/{id}` — per-request Claude token usage and cost

### Tier gating
- **free**: 3 lifetime credits for `/api/generate` only
- **dev** (`$15/mo`): unlimited generate + markup, debug, journal AI
- **exec** (`$79/mo`): same as dev; hides "Upgrade" button in nav
