# WTS Master Context
## WorldTradeStandard — Complete Platform Reference

Use this document to understand the full scope of WTS before
building any feature, writing any copy, or designing any UI.

---

## What WTS Is

WorldTradeStandard is an intent-first trading operating system.

It is not a charting platform.
It is not a social network.
It is not a robot marketplace.

It is all three — unified by a single AI companion
that knows the trader, acts on their behalf,
and turns their intentions into executed reality.

**Brand identity:** The Architect. The Sovereign. Build. Verify. Scale.

---

## Current Stack

| Layer | Technology |
|-------|-----------|
| Frontend | GitHub Pages — index.html, js/app.js, css/main.css |
| Backend | Node.js / Express on Render |
| Database | Firebase Firestore (europe-west1) |
| Auth | Firebase Auth |
| AI | Claude (via Anthropic API) |
| Email | Resend (hello@worldtradestandard.com) |
| Payments | Bachs Payment (primary) |
| VPS | Hetzner Cloud (CX22 — auto-provisioned) |
| Agent | WTS Nexus Agent (Node.js Windows service) |
| EA | WTS Nexus EA (MQL5 — runs on MT5) |
| Notifications | Telegram (@WorldtradestandardBot) |

---

## Subscription Tiers

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | 3 EA generations lifetime |
| Developer | $25/mo | Unlimited generation, VPS, auto-import, journal |
| Executive | $79/mo | Everything + institutional metrics, prop toolkit, copy trading, marketplace |

---

## Admin Details

- Admin UID: `sQpMGQApvVQcuRpWeb7j3EMDawG2`
- Firebase project: `worldtradestandard`
- Firebase region: `europe-west1`
- GitHub: `theartistccc-bit`
- Repos: `worldtradestandard` (public), `wts-nexus-agent` (private)
- Render backend: `api.worldtradestandard.com`
- Frontend: `worldtradestandard.com`

---

## Core Features (Built)

- EA/Indicator/Script builder (MQL5, MQL4, PineScript)
- Trade Journal (auto-import via WTS Nexus EA)
- Chart Markup AI
- Auto-Debugger
- Social Feed + Leaderboard + Signals
- Markets tab (MT5, MT4, TradingView, Calendar)
- VPS Control Center (agent commands, broker accounts)
- Prop Firm Rules Engine
- Kill Switch (prop-firm-safe, min hold time aware)
- WTS Nexus Agent (autonomous VPS controller)
- Hetzner auto-provisioning
- Bachs Payment webhook
- Telegram notifications
- Resend email system
- 72-hour VPS countdown

---

## Core Features (Planned)

- AI Trading Companion (persistent, proactive)
- Mission Engine (monitor, execute, guard, study)
- Robot Arena (verified performance profiles)
- WTS IQ reputation system
- AI Debates (Bull vs Bear live rooms)
- Battle Room (weekly prediction competitions)
- Anonymous Hedge Fund Mode
- Missions Marketplace
- WTS Compute (on-demand optimization)
- Paystack recurring subscriptions
- Flutter mobile app (iOS + Android)

---

## Key Files

```
~/Downloads/WT/
├── index.html          — main app shell + all views
├── js/app.js           — all frontend logic
├── server.js           — Express backend
├── css/main.css        — styling
└── CLAUDE.md           — coding standards

~/Downloads/wts-agent/
├── index.js            — agent entry point
├── auth.js             — Firebase + Power Key
├── listener.js         — Firestore command poller
├── executor.js         — command router
├── reporter.js         — status + advisories
├── setup.js            — one-time admin setup
├── service-install.js  — Windows service installer
├── handlers/
│   ├── mt5-login.js
│   ├── deploy-ea.js
│   ├── get-status.js
│   └── kill-switch.js
└── CLAUDE.md           — agent coding standards
```

---

## Firestore Schema (Key Collections)

```
users/{uid}
  tier, credits, email, subscription_start
  vps.ip, vps.server_id, vps.status
  risk_lock, risk_lock_until
  telegram_chat_id, referral_code

users/{uid}/eas/{ea_id}
  title, code, platform, created_at, deployed

users/{uid}/trades/{trade_id}
  pair, direction, entry, exit, pnl, duration

users/{uid}/propfirm_rules/{rule_id}
  min_trade_duration_seconds, max_daily_loss_pct...

agents/{uid}
  online, last_seen, hostname, vps_ip

agents/{uid}/commands/{cmd_id}
  type, payload, status, result, error

agents/{uid}/terminals/{terminal_id}
  balance, equity, status (from wts_status.json)

posts/{post_id}
  uid, content, type, likes, created_at

signals/{signal_id}
  provider_uid, pair, direction, entry, sl, tp

leaderboard/{period}_{uid}
  wts_score, win_rate, rank_position
```

---

## Coding Standards (Both Repos)

- Node.js 20 LTS, CommonJS only
- Strict mode (`'use strict'`) in every file
- Maximum 200 lines per file
- No TypeScript, no ES modules
- Every async function has try/catch
- No passwords or secrets in logs
- Rate limiting on all side-effect endpoints
- `req.uid` not `req.user.uid` (this codebase pattern)
- Admin check: `req.uid !== process.env.ADMIN_UID`

---

## Color Palette

```
Background deep:   #07080D
Background card:   #0D0F18
Background card 2: #12151F
Border:            #1E2130
Blue (primary):    #378ADD
Green (success):   #2ECC71
Gold (executive):  #C9A84C
Red (danger):      #E74C3C
Purple (MT4/alt):  #9B59B6
Muted text:        #6B7280
White text:        #E8EAF0
```

---

## Brand Voice

- Direct. Confident. No fluff.
- Speaks to serious traders, not beginners.
- Technical but never condescending.
- "The Architect" persona — builds systems, not hopes.

**Examples:**
- ✓ "Build. Verify. Scale."
- ✓ "Your EA runs 24/7 even when you sleep."
- ✗ "Our amazing AI-powered solution helps you achieve your trading goals!"
