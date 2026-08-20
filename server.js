'use strict';

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const admin     = require('firebase-admin');
const axios     = require('axios');
const crypto    = require('crypto');

// ═══════════════════════════════════════════════════════════
//  FIREBASE ADMIN
// ═══════════════════════════════════════════════════════════
let db = null;
try {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (sa.project_id) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    db = admin.firestore();
    console.log('[WTS] Firebase connected — project:', sa.project_id);
  } else {
    console.warn('[WTS] FIREBASE_SERVICE_ACCOUNT not set — dev mode (no persistence)');
  }
} catch (e) {
  console.warn('[WTS] Firebase init failed:', e.message);
}

// ═══════════════════════════════════════════════════════════
//  ANTHROPIC
// ═══════════════════════════════════════════════════════════
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

// claude-haiku-4-5 pricing
const COST_IN  = 0.00000025; // $0.25 / 1M input tokens
const COST_OUT = 0.00000125; // $1.25 / 1M output tokens

// ═══════════════════════════════════════════════════════════
//  NOWPAYMENTS
// ═══════════════════════════════════════════════════════════
const NP_API = 'https://api.nowpayments.io/v1';
const NP_KEY = process.env.NOWPAYMENTS_API_KEY;
const NP_IPN = process.env.NOWPAYMENTS_IPN_SECRET;

const PLAN_PRICES = { dev: 15, exec: 79 }; // USD

// ═══════════════════════════════════════════════════════════
//  EMAIL — Resend
// ═══════════════════════════════════════════════════════════
const RESEND_KEY  = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const FROM_EMAIL  = 'WorldTradeStandard <noreply@worldtradestandard.com>';

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY || !to) return;
  try {
    await axios.post('https://api.resend.com/emails',
      { from: FROM_EMAIL, to, subject, html },
      { headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' } }
    );
    console.log(`[email] ✓ "${subject}" → ${to}`);
  } catch (e) {
    console.warn('[email] Failed:', e.response?.data?.message || e.message);
  }
}

function _esc(s) {
  return String(s || 'Trader').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function emailWelcome(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07080D;font-family:Arial,sans-serif;color:#E8EAF0">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:20px;font-weight:900;letter-spacing:6px;color:#378ADD">WORLDTRADESTANDARD</div>
    <div style="font-size:10px;letter-spacing:3px;color:#4A5568;margin-top:4px">ARTIFICIAL TRADING ASSISTANT</div>
  </div>
  <div style="background:#0D0F18;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:32px">
    <div style="font-size:20px;font-weight:700;color:#E8EAF0;margin-bottom:8px">Welcome, ${_esc(name)}.</div>
    <div style="font-size:13px;color:#6B7280;line-height:1.8;margin-bottom:24px">You now have access to the AI trading assistant used by MetaTrader traders across 30+ countries. Here is what to do first.</div>
    <div style="border-left:3px solid #378ADD;padding:10px 14px;margin-bottom:10px;background:#12151F;border-radius:0 6px 6px 0">
      <div style="font-size:13px;font-weight:600;color:#E8EAF0">&#9889; Generate your first Expert Advisor</div>
      <div style="font-size:12px;color:#6B7280;margin-top:3px">Describe any strategy in plain English and get production-ready MQL5 code instantly.</div>
    </div>
    <div style="border-left:3px solid #1D9E75;padding:10px 14px;margin-bottom:10px;background:#12151F;border-radius:0 6px 6px 0">
      <div style="font-size:13px;font-weight:600;color:#E8EAF0">&#128211; Track your trades with AI analysis</div>
      <div style="font-size:12px;color:#6B7280;margin-top:3px">Log every trade. Get AI feedback on your entry, exit, and emotional state.</div>
    </div>
    <div style="border-left:3px solid #378ADD;padding:10px 14px;margin-bottom:24px;background:#12151F;border-radius:0 6px 6px 0">
      <div style="font-size:13px;font-weight:600;color:#E8EAF0">&#129518; Free risk calculators — no tokens needed</div>
      <div style="font-size:12px;color:#6B7280;margin-top:3px">Position size, risk of ruin (Monte Carlo 10,000 sims), and compound growth projector.</div>
    </div>
    <div style="text-align:center;margin-bottom:20px">
      <a href="https://app.worldtradestandard.com" style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;padding:13px 32px;border-radius:7px;font-size:14px;font-weight:700;letter-spacing:.5px">Launch the Platform &rarr;</a>
    </div>
    <div style="padding:12px 16px;background:#12151F;border-radius:7px;font-size:12px;color:#6B7280;text-align:center">
      Your free account includes <strong style="color:#E8EAF0">3 EA generations</strong>. Upgrade to Developer ($15/mo) for unlimited access.
    </div>
  </div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#4A5568">
    WorldTradeStandard &middot; <a href="https://app.worldtradestandard.com" style="color:#378ADD;text-decoration:none">app.worldtradestandard.com</a>
  </div>
</div>
</body></html>`;
}

function emailCreditNudge(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07080D;font-family:Arial,sans-serif;color:#E8EAF0">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:20px;font-weight:900;letter-spacing:6px;color:#378ADD">WORLDTRADESTANDARD</div>
    <div style="font-size:10px;letter-spacing:3px;color:#4A5568;margin-top:4px">ARTIFICIAL TRADING ASSISTANT</div>
  </div>
  <div style="background:#0D0F18;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:32px">
    <div style="font-size:20px;font-weight:700;color:#E8EAF0;margin-bottom:8px">You have used all 3 free generations.</div>
    <div style="font-size:13px;color:#6B7280;line-height:1.8;margin-bottom:24px">You have built your proof of concept. Now go further — unlimited builds, full source code, and the complete AI suite.</div>
    <div style="background:#12151F;border:1px solid rgba(55,138,221,.18);border-radius:8px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:#378ADD;margin-bottom:12px;letter-spacing:1px">ACTIVE DEVELOPER &mdash; $15/mo</div>
      <div style="font-size:12px;color:#6B7280;line-height:2">
        &#10003; Unlimited EA and Indicator generations<br>
        &#10003; Full MQL4 + MQL5 source code<br>
        &#10003; YouTube to Robot converter<br>
        &#10003; PineScript to MQL translator<br>
        &#10003; Chart Markup AI analysis<br>
        &#10003; Trade Journal with AI feedback<br>
        &#10003; Auto-Debugger
      </div>
    </div>
    <div style="text-align:center;margin-bottom:20px">
      <a href="https://app.worldtradestandard.com#pricing" style="display:inline-block;background:#378ADD;color:#fff;text-decoration:none;padding:13px 32px;border-radius:7px;font-size:14px;font-weight:700;letter-spacing:.5px">Upgrade with Crypto &mdash; $15/mo &rarr;</a>
    </div>
    <div style="padding:12px 16px;background:#12151F;border-radius:7px;font-size:12px;color:#6B7280;text-align:center">
      Pay with USDT, BTC, ETH, or 50+ cryptocurrencies via NowPayments.
    </div>
  </div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#4A5568">
    WorldTradeStandard &middot; <a href="https://app.worldtradestandard.com" style="color:#378ADD;text-decoration:none">app.worldtradestandard.com</a>
  </div>
</div>
</body></html>`;
}

function emailWeeklySummary(name, tradeCount, winRate, netPnl, wins, losses) {
  const pnlColor = netPnl >= 0 ? '#1D9E75' : '#E74C3C';
  const pnlStr   = (netPnl >= 0 ? '+' : '') + '$' + Math.abs(netPnl).toFixed(0);
  const wrColor  = parseFloat(winRate) >= 50 ? '#1D9E75' : '#E74C3C';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07080D;font-family:Arial,sans-serif;color:#E8EAF0">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:20px;font-weight:900;letter-spacing:6px;color:#378ADD">WORLDTRADESTANDARD</div>
    <div style="font-size:10px;letter-spacing:3px;color:#4A5568;margin-top:4px">WEEKLY PERFORMANCE REPORT</div>
  </div>
  <div style="background:#0D0F18;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:32px">
    <div style="font-size:18px;font-weight:700;color:#E8EAF0;margin-bottom:4px">Good morning, ${_esc(name)}.</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:24px">Here is how your trading system has performed in total.</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr>
        <td width="33%" style="padding:0 5px 0 0">
          <div style="background:#12151F;border-radius:8px;padding:14px;text-align:center;border:1px solid rgba(255,255,255,.05)">
            <div style="font-size:9px;letter-spacing:2px;color:#4A5568;margin-bottom:6px">WIN RATE</div>
            <div style="font-size:22px;font-weight:700;color:${wrColor};font-family:monospace">${winRate}%</div>
            <div style="font-size:11px;color:#4A5568;margin-top:4px">${wins}W / ${losses}L</div>
          </div>
        </td>
        <td width="33%" style="padding:0 5px">
          <div style="background:#12151F;border-radius:8px;padding:14px;text-align:center;border:1px solid rgba(255,255,255,.05)">
            <div style="font-size:9px;letter-spacing:2px;color:#4A5568;margin-bottom:6px">NET P&amp;L</div>
            <div style="font-size:22px;font-weight:700;color:${pnlColor};font-family:monospace">${pnlStr}</div>
            <div style="font-size:11px;color:#4A5568;margin-top:4px">Closed trades</div>
          </div>
        </td>
        <td width="33%" style="padding:0 0 0 5px">
          <div style="background:#12151F;border-radius:8px;padding:14px;text-align:center;border:1px solid rgba(255,255,255,.05)">
            <div style="font-size:9px;letter-spacing:2px;color:#4A5568;margin-bottom:6px">TOTAL TRADES</div>
            <div style="font-size:22px;font-weight:700;color:#378ADD;font-family:monospace">${tradeCount}</div>
            <div style="font-size:11px;color:#4A5568;margin-top:4px">All logged</div>
          </div>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-bottom:20px">
      <a href="https://app.worldtradestandard.com#stats" style="display:inline-block;background:#1D9E75;color:#fff;text-decoration:none;padding:12px 28px;border-radius:7px;font-size:13px;font-weight:700;letter-spacing:.5px">View Full Performance Dashboard &rarr;</a>
    </div>
    <div style="padding:12px 16px;background:#12151F;border-radius:7px;font-size:12px;color:#6B7280;text-align:center">
      Keep logging your trades. Every closed trade sharpens your pattern analysis.
    </div>
  </div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#4A5568">
    WorldTradeStandard &middot; <a href="https://app.worldtradestandard.com" style="color:#378ADD;text-decoration:none">app.worldtradestandard.com</a>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════
//  EXPRESS
// ═══════════════════════════════════════════════════════════
const app = express();

// Raw body for NowPayments IPN (before express.json)
app.use('/api/nowpayments/webhook', express.raw({ type: '*/*' }));
app.use(express.json({ limit: '10mb' }));

const ALLOWED_ORIGINS = [
  'https://worldtradestandard.com',
  'https://www.worldtradestandard.com',
  'https://worldtradestandard.com',
  /\.github\.io$/,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    const ok = ALLOWED_ORIGINS.some(o => typeof o === 'string' ? o === origin : o.test(origin));
    cb(ok ? null : new Error('CORS blocked'), ok);
  },
}));

// Rate limiter — 30 req / 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please wait before retrying.' },
});

// ═══════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token' });
  }

  if (!db) {
    // Dev mode — skip Firebase, grant exec access for local testing
    req.uid         = 'dev-local';
    req.userTier    = 'exec';
    req.userCredits = 999;
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    req.uid = decoded.uid;

    const snap = await db.collection('users').doc(decoded.uid).get();
    if (snap.exists) {
      const d         = snap.data();
      req.userTier    = d.tier    || 'free';
      req.userCredits = d.credits ?? 3;
      req.userEmail   = d.email   || decoded.email || '';
      req.userName    = d.name    || decoded.name  || '';
    } else {
      // First sign-in — create user document
      const newUser = {
        uid:    decoded.uid,
        email:  decoded.email  || '',
        name:   decoded.name   || '',
        photo:  decoded.picture || '',
        tier:   'free',
        credits: 3,
        handle: '',
        country: '',
        score:  0,
        rank:   'Apprentice',
        badges: [],
        joined: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('users').doc(decoded.uid).set(newUser);
      req.userTier    = 'free';
      req.userCredits = 3;
      req.userEmail   = decoded.email || '';
      req.userName    = decoded.name  || '';
      // Welcome email — fire and forget
      if (decoded.email) {
        sendEmail(decoded.email, 'Welcome to WorldTradeStandard', emailWelcome(decoded.name || 'Trader'))
          .catch(() => {});
      }
    }
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ═══════════════════════════════════════════════════════════
//  TOKEN LOGGER
// ═══════════════════════════════════════════════════════════
async function logTokens(uid, feature, inTok, outTok, tier) {
  if (!db) return;
  const cost = inTok * COST_IN + outTok * COST_OUT;
  await db.collection('tokenLogs').add({
    uid, feature,
    inputTokens: inTok,
    outputTokens: outTok,
    cost_usd: cost,
    tier,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  }).catch(e => console.warn('[logTokens]', e.message));
}

// ═══════════════════════════════════════════════════════════
//  KEEP-ALIVE
// ═══════════════════════════════════════════════════════════
app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now(), model: MODEL });
});

// ═══════════════════════════════════════════════════════════
//  EA / CODE GENERATION
// ═══════════════════════════════════════════════════════════
app.post('/api/generate', limiter, verifyAuth, async (req, res) => {
  const { systemPrompt, userMessage, strategy, platform, symbol, builderMode } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage is required' });

  // Free tier credit check
  if (req.userTier === 'free') {
    if (req.userCredits <= 0) {
      return res.status(403).json({
        error: 'credits_exhausted',
        message: 'No credits remaining. Upgrade to Developer ($15/mo) for unlimited generations.',
      });
    }
    if (db) {
      await db.collection('users').doc(req.uid)
        .update({ credits: admin.firestore.FieldValue.increment(-1) });
    }
    // Last credit used — send upgrade nudge
    if (req.userCredits === 1 && req.userEmail) {
      sendEmail(
        req.userEmail,
        "You've used all 3 free generations — here's what's next",
        emailCreditNudge(req.userName)
      ).catch(() => {});
    }
  }

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt || 'You are a professional MQL5/MQL4 code generator. Return only raw, compilable code with no markdown fences.',
      messages: [{ role: 'user', content: userMessage }],
    });

    const code = msg.content[0].text
      .replace(/```(?:mql[45]?|mq[45])?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    const { input_tokens: inTok, output_tokens: outTok } = msg.usage;

    let eaId = null;
    if (db) {
      const ref = await db.collection('eas').add({
        uid: req.uid,
        code,
        platform: platform || 'MT5',
        strategy_type: strategy || builderMode || 'ea',
        symbol: symbol || 'Any',
        created: admin.firestore.FieldValue.serverTimestamp(),
        tokens_used: inTok + outTok,
        public: false,
      });
      eaId = ref.id;
      await logTokens(req.uid, 'generate', inTok, outTok, req.userTier);
    }

    res.json({
      code,
      eaId,
      creditsLeft: req.userTier === 'free' ? Math.max(0, req.userCredits - 1) : null,
    });
  } catch (err) {
    console.error('[/api/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  CHART MARKUP AI
// ═══════════════════════════════════════════════════════════
app.post('/api/markup', limiter, verifyAuth, async (req, res) => {
  if (req.userTier === 'free') {
    return res.status(403).json({
      error: 'tier_required',
      message: 'Chart Markup AI requires Developer ($15/mo) or Executive ($79/mo) plan.',
    });
  }
  const { systemPrompt, userMessage } = req.body;
  if (!userMessage) return res.status(400).json({ error: 'userMessage is required' });

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt || 'You are a professional trading chart analyst. Analyse trading setups only.',
      messages: [{ role: 'user', content: userMessage }],
    });
    await logTokens(req.uid, 'markup', msg.usage.input_tokens, msg.usage.output_tokens, req.userTier);
    res.json({ reply: msg.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTO-DEBUGGER
// ═══════════════════════════════════════════════════════════
app.post('/api/debug', limiter, verifyAuth, async (req, res) => {
  if (req.userTier === 'free') {
    return res.status(403).json({
      error: 'tier_required',
      message: 'Auto-Debugger requires Developer ($15/mo) or Executive ($79/mo) plan.',
    });
  }
  const { errorLog } = req.body;
  if (!errorLog) return res.status(400).json({ error: 'errorLog is required' });

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `You are WorldTradeStandard's MQL Auto-Debugger. Expert in MetaTrader 4 and MetaTrader 5 MQL.
For each error or warning in the log:
1. State the error with its exact line number
2. Explain the root cause in plain English
3. Provide the corrected code line(s)
Format each issue as:
ERROR [line X]: <error text>
CAUSE: <plain English explanation>
FIX: <corrected code>
---
Cover every error and warning in the log.`,
      messages: [{ role: 'user', content: `Fix these MetaEditor errors:\n\n${errorLog}` }],
    });
    await logTokens(req.uid, 'debug', msg.usage.input_tokens, msg.usage.output_tokens, req.userTier);
    res.json({ reply: msg.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  JOURNAL — AI ANALYSIS
// ═══════════════════════════════════════════════════════════
app.post('/api/journal/analyse', limiter, verifyAuth, async (req, res) => {
  if (req.userTier === 'free') {
    return res.status(403).json({
      error: 'tier_required',
      message: 'Journal AI analysis requires Developer or Executive plan.',
    });
  }
  const { tradeData, tradeId } = req.body;
  if (!tradeData) return res.status(400).json({ error: 'tradeData is required' });

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: `You are WorldTradeStandard's Trade Journal AI. Analyse trade setups concisely.
Return: (1) Setup quality score 1-10, (2) Whether it matches good trading principles, (3) Potential risks, (4) What to watch during the trade, (5) One key lesson.
Max 150 words. Be direct and educational.`,
      messages: [{ role: 'user', content: tradeData }],
    });

    const analysis = msg.content[0].text;

    if (tradeId && db) {
      await db.collection('trades').doc(tradeId)
        .update({ ai_analysis: analysis }).catch(() => {});
    }

    await logTokens(req.uid, 'journal', msg.usage.input_tokens, msg.usage.output_tokens, req.userTier);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  JOURNAL — SAVE TRADE
// ═══════════════════════════════════════════════════════════
app.post('/api/journal/save', verifyAuth, async (req, res) => {
  const { trade } = req.body;
  if (!trade) return res.status(400).json({ error: 'trade is required' });
  if (!db) return res.json({ tradeId: 'local-' + Date.now() });

  try {
    const ref = await db.collection('trades').add({
      ...trade,
      uid: req.uid,
      created: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ tradeId: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  JOURNAL — UPDATE TRADE (close, edit)
// ═══════════════════════════════════════════════════════════
app.post('/api/journal/update', verifyAuth, async (req, res) => {
  const { tradeId, update } = req.body;
  if (!tradeId || !update) return res.status(400).json({ error: 'tradeId and update required' });
  if (!db) return res.json({ ok: true });
  try {
    const ref = db.collection('trades').doc(String(tradeId));
    const doc = await ref.get();
    if (!doc.exists || doc.data().uid !== req.uid) return res.status(404).json({ error: 'Trade not found' });
    await ref.update({ ...update, updated: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  JOURNAL — GET TRADES
// ═══════════════════════════════════════════════════════════
app.get('/api/journal', verifyAuth, async (req, res) => {
  if (!db) return res.json({ trades: [] });
  try {
    const snap = await db.collection('trades')
      .where('uid', '==', req.uid)
      .orderBy('created', 'desc')
      .limit(100)
      .get();
    const trades = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      created: d.data().created?.toDate?.()?.toISOString(),
    }));
    res.json({ trades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  EMAIL — WEEKLY SUMMARY (call every Sunday via cron-job.org)
//  POST /api/email/weekly  ·  Header: x-cron-secret: <CRON_SECRET>
// ═══════════════════════════════════════════════════════════
app.post('/api/email/weekly', async (req, res) => {
  if (!CRON_SECRET || req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!db) return res.json({ sent: 0, skipped: 0 });

  try {
    const usersSnap = await db.collection('users').get();
    let sent = 0, skipped = 0;

    for (const userDoc of usersSnap.docs) {
      const user = userDoc.data();
      if (!user.email) { skipped++; continue; }

      const tradesSnap = await db.collection('trades')
        .where('uid', '==', userDoc.id)
        .get();

      const allTrades    = tradesSnap.docs.map(d => d.data());
      const closedTrades = allTrades.filter(t => t.status !== 'open' && t.pnl !== null);

      if (!closedTrades.length) { skipped++; continue; }

      const wins    = closedTrades.filter(t => t.pnl > 0);
      const losses  = closedTrades.filter(t => t.pnl <= 0);
      const netPnl  = closedTrades.reduce((s, t) => s + t.pnl, 0);
      const winRate = (wins.length / closedTrades.length * 100).toFixed(1);
      const subject = `Your WTS Weekly — ${closedTrades.length} trades, ${winRate}% win rate`;

      await sendEmail(
        user.email,
        subject,
        emailWeeklySummary(user.name || 'Trader', allTrades.length, winRate, netPnl, wins.length, losses.length)
      );
      sent++;
    }

    res.json({ sent, skipped });
  } catch (err) {
    console.error('[weekly email]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  EAs — GET USER EAs
// ═══════════════════════════════════════════════════════════
app.get('/api/eas', verifyAuth, async (req, res) => {
  if (!db) return res.json({ eas: [] });
  try {
    const snap = await db.collection('eas')
      .where('uid', '==', req.uid)
      .orderBy('created', 'desc')
      .limit(50)
      .get();
    const eas = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      created: d.data().created?.toDate?.()?.toISOString(),
    }));
    res.json({ eas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  USER — GET PROFILE
// ═══════════════════════════════════════════════════════════
app.get('/api/user', verifyAuth, async (req, res) => {
  if (!db) return res.json({ uid: req.uid, tier: req.userTier, credits: req.userCredits });
  try {
    const doc = await db.collection('users').doc(req.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const data = doc.data();
    // Never send sensitive fields
    delete data.subscription_raw;
    res.json({ uid: doc.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  NOWPAYMENTS — CREATE INVOICE
// ═══════════════════════════════════════════════════════════
app.post('/api/nowpayments/create-invoice', verifyAuth, async (req, res) => {
  const { plan } = req.body;
  if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Invalid plan. Use dev or exec.' });
  if (!NP_KEY) return res.status(500).json({ error: 'NowPayments not configured on server.' });

  const price    = PLAN_PRICES[plan];
  const orderId  = `WTS-${plan}-${req.uid}-${Date.now()}`;
  const baseUrl  = 'https://worldtradestandard.com';

  try {
    const { data } = await axios.post(
      `${NP_API}/invoice`,
      {
        price_amount:    price,
        price_currency:  'usd',
        order_id:        orderId,
        order_description: `WorldTradeStandard ${plan === 'exec' ? 'Executive' : 'Developer'} Plan — $${price}/mo`,
        success_url:     `${baseUrl}/?payment=success&plan=${plan}`,
        cancel_url:      `${baseUrl}/?payment=cancel`,
        ipn_callback_url: 'https://api.worldtradestandard.com/api/nowpayments/webhook',
        is_fixed_rate:   true,
        is_fee_paid_by_user: false,
      },
      { headers: { 'x-api-key': NP_KEY, 'Content-Type': 'application/json' } }
    );

    // Log pending payment
    if (db) {
      await db.collection('payments').add({
        uid: req.uid,
        plan,
        order_id: orderId,
        invoice_id: data.id,
        amount_usd: price,
        status: 'pending',
        created: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ invoice_url: data.invoice_url, invoice_id: data.id, order_id: orderId });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('[nowpayments/create-invoice]', msg);
    res.status(500).json({ error: msg });
  }
});

// ═══════════════════════════════════════════════════════════
//  NOWPAYMENTS — IPN WEBHOOK
// ═══════════════════════════════════════════════════════════
app.post('/api/nowpayments/webhook', async (req, res) => {
  // Always respond 200 quickly
  res.sendStatus(200);

  if (!NP_IPN) {
    console.warn('[nowpayments webhook] IPN secret not set — skipping verification');
    return;
  }

  try {
    const body = req.body.toString();
    const payload = JSON.parse(body);

    // Verify signature: sort payload keys alphabetically, HMAC-SHA512
    function sortObjAlpha(obj) {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sortObjAlpha);
      return Object.keys(obj).sort().reduce((acc, k) => {
        acc[k] = sortObjAlpha(obj[k]);
        return acc;
      }, {});
    }
    const sorted = sortObjAlpha(payload);
    const hmac = crypto.createHmac('sha512', NP_IPN)
      .update(JSON.stringify(sorted))
      .digest('hex');

    if (hmac !== req.headers['x-nowpayments-sig']) {
      console.error('[nowpayments webhook] Invalid signature');
      return;
    }

    const { payment_status, order_id } = payload;
    console.log(`[nowpayments webhook] status=${payment_status} order=${order_id}`);

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      // order_id format: WTS-{plan}-{uid}-{timestamp}
      const parts = order_id.split('-');
      const plan  = parts[1]; // dev or exec
      const uid   = parts[2]; // Firebase UID

      if (uid && plan && db) {
        const tier = plan === 'exec' ? 'exec' : 'dev';
        await db.collection('users').doc(uid).update({
          tier,
          subscription_active: true,
          subscription_plan: plan,
          subscription_updated: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update payment record
        const paySnap = await db.collection('payments')
          .where('order_id', '==', order_id).limit(1).get();
        if (!paySnap.empty) {
          await paySnap.docs[0].ref.update({ status: 'paid', paid_at: admin.firestore.FieldValue.serverTimestamp() });
        }

        console.log(`[nowpayments webhook] User ${uid} upgraded to ${tier}`);
      }
    }

    if (payment_status === 'expired' || payment_status === 'failed') {
      const parts = order_id.split('-');
      const uid = parts[2];
      if (uid && db) {
        const paySnap = await db.collection('payments')
          .where('order_id', '==', order_id).limit(1).get();
        if (!paySnap.empty) {
          await paySnap.docs[0].ref.update({ status: payment_status });
        }
      }
    }
  } catch (err) {
    console.error('[nowpayments webhook]', err.message);
  }
});

// ═══════════════════════════════════════════════════════════
//  WTS NEXUS AGENT ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Send command to user's agent via Firestore
app.post('/api/agent/command', verifyAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Agent service unavailable' });
  const { type, payload = {} } = req.body;
  const uid     = req.uid;
  const allowed = ['login', 'deploy_ea', 'get_status', 'kill_switch'];
  if (!allowed.includes(type)) return res.status(400).json({ error: `Unknown command: ${type}` });
  try {
    const agentDoc = await db.collection('agents').doc(uid).get();
    if (!agentDoc.exists || !agentDoc.data().registered) {
      return res.status(404).json({ error: 'No VPS agent found. Contact support to set up your VPS.' });
    }
    const cmdRef = await db.collection('agents').doc(uid).collection('commands').add({
      type, payload, status: 'pending',
      created_at: new Date().toISOString(),
      completed_at: null, result: null, error: null
    });
    res.json({ success: true, cmd_id: cmdRef.id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Poll command result
app.get('/api/agent/command/:cmdId', verifyAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Agent service unavailable' });
  const uid = req.uid;
  try {
    const doc = await db.collection('agents').doc(uid)
      .collection('commands').doc(req.params.cmdId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Command not found' });
    res.json(doc.data());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get agent online status for the logged in user
app.get('/api/agent/status', verifyAuth, async (req, res) => {
  if (!db) return res.json({ online: false, registered: false });
  const uid = req.uid;
  try {
    const doc  = await db.collection('agents').doc(uid).get();
    if (!doc.exists) return res.json({ online: false, registered: false });
    const data  = doc.data();
    const stale = !data.last_seen || (Date.now() - new Date(data.last_seen).getTime()) > 90000;
    res.json({ ...data, online: !stale && !!data.online });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Get VPS provisioning status for the logged in user (drives the 72hr countdown)
app.get('/api/vps/status', verifyAuth, async (req, res) => {
  if (!db) return res.json({ status: 'active', activation_due: null });
  try {
    const doc  = await db.collection('users').doc(req.uid).get();
    const data = doc.exists ? doc.data() : {};
    res.json({
      status:         data.vps?.status || 'none',
      activation_due: data.activation_due || null
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: register agent for a user after manual VPS setup
app.post('/api/admin/agent/register', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(503).json({ error: 'Agent service unavailable' });
  const { uid, vps_ip, notes } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    await db.collection('agents').doc(uid).set({
      online: false, registered: true,
      vps_ip: vps_ip || '', notes: notes || '',
      registered_by: req.uid,
      registered_at: new Date().toISOString()
    }, { merge: true });
    res.json({ success: true, message: `Agent registered for ${uid}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: get all agents and their status
app.get('/api/admin/agents', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(503).json({ error: 'Agent service unavailable' });
  try {
    const snap   = await db.collection('agents').get();
    const agents = snap.docs.map(d => {
      const data  = d.data();
      const stale = !data.last_seen || (Date.now() - new Date(data.last_seen).getTime()) > 90000;
      return { uid: d.id, ...data, online: !stale && !!data.online };
    });
    res.json({ agents, total: agents.length, online: agents.filter(a => a.online).length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
//  PROP FIRM RULES ENGINE
// ═══════════════════════════════════════════════════════════

// Save prop firm rules for a user — replaces any currently active rule set
app.post('/api/propfirm/rules', verifyAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const {
      firm_name,
      min_trade_duration_seconds,  // minimum hold time e.g. 10
      max_daily_loss_pct,          // e.g. 5 (percent)
      max_total_loss_pct,          // e.g. 10 (percent)
      max_lot_size,                // e.g. 5.0
      allowed_pairs,               // [] means all allowed
      trading_days,                // ['monday','tuesday',...] or [] for all
      trading_hours_start,         // '08:00' or null
      trading_hours_end,           // '20:00' or null
      no_trade_during_news,        // true/false
      no_overnight_trades,         // true/false
      no_weekend_trades,           // true/false
      ea_allowed,                  // true/false — does firm allow EAs
      notes                        // free text user adds
    } = req.body;

    const rulesRef = db.collection('users').doc(req.uid).collection('propfirm_rules');

    // Deactivate any existing active rule set first so only one is ever active —
    // otherwise validate()/GET pick an arbitrary doc among several active ones.
    const prevActive = await rulesRef.where('active', '==', true).get();
    const batch = db.batch();
    prevActive.docs.forEach(d => batch.update(d.ref, { active: false }));

    const newRuleRef = rulesRef.doc();
    batch.set(newRuleRef, {
      firm_name:                   firm_name || 'Unknown Firm',
      min_trade_duration_seconds:  parseInt(min_trade_duration_seconds) || 0,
      max_daily_loss_pct:          parseFloat(max_daily_loss_pct) || 5,
      max_total_loss_pct:          parseFloat(max_total_loss_pct) || 10,
      max_lot_size:                parseFloat(max_lot_size) || 0,
      allowed_pairs:                allowed_pairs || [],
      trading_days:                trading_days || [],
      trading_hours_start:         trading_hours_start || null,
      trading_hours_end:           trading_hours_end || null,
      no_trade_during_news:        !!no_trade_during_news,
      no_overnight_trades:         !!no_overnight_trades,
      no_weekend_trades:           !!no_weekend_trades,
      ea_allowed:                  ea_allowed !== false,
      notes:                       notes || '',
      active:                      true,
      created_at:                  new Date().toISOString()
    });
    await batch.commit();

    res.json({ success: true, message: 'Prop firm rules saved' });
  } catch(e) {
    res.status(500).json({ error: 'Failed to save rules' });
  }
});

// Get active prop firm rules for logged in user
app.get('/api/propfirm/rules', verifyAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const snap = await db
      .collection('users').doc(req.uid)
      .collection('propfirm_rules')
      .where('active', '==', true)
      .get();
    const rules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ rules });
  } catch(e) {
    res.status(500).json({ error: 'Failed to load rules' });
  }
});

// Validate a proposed trade action against saved rules
// Called by app before user opens a trade
app.post('/api/propfirm/validate', verifyAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const { action, pair, lot_size, open_time } = req.body;
    // action: 'open' or 'close'
    // open_time: ISO string of when trade was opened (for close validation)

    const snap = await db
      .collection('users').doc(req.uid)
      .collection('propfirm_rules')
      .where('active', '==', true)
      .get();

    if (snap.empty) return res.json({ allowed: true, warnings: [], rules_active: false });

    const rules    = snap.docs[0].data();
    const warnings = [];
    const blocks   = [];
    const now      = new Date();

    // Check minimum hold time on close
    if (action === 'close' && open_time) {
      const openMs   = new Date(open_time).getTime();
      const heldSecs = Math.floor((now.getTime() - openMs) / 1000);
      const minSecs  = rules.min_trade_duration_seconds || 0;
      if (heldSecs < minSecs) {
        const waitSecs = minSecs - heldSecs;
        blocks.push({
          rule:    'min_trade_duration',
          message: `This trade must be held for at least ${minSecs} seconds. You have held it for ${heldSecs} seconds. Wait ${waitSecs} more seconds before closing.`,
          wait_seconds: waitSecs
        });
      }
    }

    // Check trading hours
    if (rules.trading_hours_start && rules.trading_hours_end) {
      const timeStr = now.toTimeString().slice(0, 5);
      if (timeStr < rules.trading_hours_start || timeStr > rules.trading_hours_end) {
        blocks.push({
          rule:    'trading_hours',
          message: `Your prop firm only allows trading between ${rules.trading_hours_start} and ${rules.trading_hours_end}. Current time is ${timeStr}.`
        });
      }
    }

    // Check weekend trading
    const dayOfWeek = now.getDay();
    if (rules.no_weekend_trades && (dayOfWeek === 0 || dayOfWeek === 6)) {
      blocks.push({
        rule:    'no_weekend_trades',
        message: 'Your prop firm does not allow weekend trading. Markets close Friday and reopen Monday.'
      });
    }

    // Check lot size
    if (rules.max_lot_size > 0 && lot_size > rules.max_lot_size) {
      blocks.push({
        rule:    'max_lot_size',
        message: `Lot size ${lot_size} exceeds your prop firm maximum of ${rules.max_lot_size}. Reduce your position size.`
      });
    }

    // Check allowed pairs
    if (rules.allowed_pairs.length > 0 && pair) {
      const pairUpper = pair.toUpperCase();
      const allowed   = rules.allowed_pairs.map(p => p.toUpperCase());
      if (!allowed.includes(pairUpper)) {
        blocks.push({
          rule:    'allowed_pairs',
          message: `Your prop firm only allows trading these pairs: ${rules.allowed_pairs.join(', ')}. ${pair} is not on the allowed list.`
        });
      }
    }

    // Check EA allowed
    if (action === 'open' && !rules.ea_allowed) {
      warnings.push({
        rule:    'ea_not_allowed',
        message: 'Warning: your prop firm does not allow automated trading. Make sure this trade was placed manually.'
      });
    }

    // Overnight trade warning
    if (rules.no_overnight_trades && action === 'open') {
      const hour = now.getUTCHours();
      if (hour >= 20 || hour < 6) {
        warnings.push({
          rule:    'overnight_risk',
          message: 'Warning: your prop firm discourages overnight positions. Consider closing before market close.'
        });
      }
    }

    res.json({
      allowed:       blocks.length === 0,
      blocked:       blocks.length > 0,
      blocks,
      warnings,
      rules_active:  true,
      firm_name:     rules.firm_name
    });
  } catch(e) {
    res.status(500).json({ error: 'Validation failed' });
  }
});

// ═══════════════════════════════════════════════════════════
//  HETZNER CLOUD — VPS AUTO-PROVISIONING
// ═══════════════════════════════════════════════════════════
const HETZNER_BASE = 'https://api.hetzner.cloud/v1';

async function hetzner(method, endpoint, body = null) {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) throw new Error('HETZNER_API_TOKEN not set');
  const res = await fetch(`${HETZNER_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Hetzner ${res.status}: ${data?.error?.message || 'unknown'}`);
  return data;
}

async function provisionVps(uid, userEmail) {
  const name   = `wts-${uid.substring(0, 8).toLowerCase()}`;
  const result = await hetzner('POST', '/servers', {
    name,
    server_type: process.env.HETZNER_SERVER_TYPE || 'cx22',
    image:       parseInt(process.env.HETZNER_SNAPSHOT_ID),
    location:    process.env.HETZNER_LOCATION || 'nbg1',
    labels:      { uid, purpose: 'wts-trading-vps' }
  });
  const server = result.server;
  const ip     = server.public_net?.ipv4?.ip;
  const id     = String(server.id);

  // Set VPS to provisioning state — frontend shows 72hr countdown
  await db.collection('users').doc(uid).update({
    'vps.ip':             ip,
    'vps.server_id':      id,
    'vps.provider':       'hetzner',
    'vps.status':         'provisioning',
    'vps.provisioned_at': new Date().toISOString()
  });

  // Register agent entry
  await db.collection('agents').doc(uid).set({
    online:         false,
    registered:     true,
    vps_ip:         ip,
    vps_id:         id,
    vps_provider:   'hetzner',
    provisioned_at: new Date().toISOString()
  }, { merge: true });

  console.log(`[hetzner] Created: ${name} — IP: ${ip} — UID: ${uid.substring(0,8)}`);
  return { ip, id, name };
}

async function activateVps(uid) {
  await db.collection('users').doc(uid).update({
    'vps.status':       'active',
    'vps.activated_at': new Date().toISOString()
  });
}

async function deleteVps(uid) {
  const doc      = await db.collection('users').doc(uid).get();
  const serverId = doc.data()?.vps?.server_id;
  if (!serverId) throw new Error('No server ID found for this user');
  await hetzner('DELETE', `/servers/${serverId}`);
  await db.collection('users').doc(uid).update({
    'vps.status':     'deleted',
    'vps.deleted_at': new Date().toISOString()
  });
  console.log(`[hetzner] Deleted server for UID: ${uid.substring(0,8)}`);
  return { success: true };
}

// Simple Telegram push, degrades to a no-op if TELEGRAM_BOT_TOKEN isn't set
// or the user has no telegram_chat_id on file — nothing currently collects
// one, so these calls are inert until a Telegram-linking flow exists.
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text, parse_mode: 'HTML'
    });
  } catch (e) {
    console.warn('[telegram] Failed:', e.response?.data?.description || e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  BACHS PAYMENT WEBHOOK
// ═══════════════════════════════════════════════════════════
// Bachs sends a POST when payment is confirmed. They transfer funds to your
// bank within 48 hours — we provision the VPS immediately on the Hetzner
// float, ahead of settlement.
//
// Field names below (status, amount, customer_email, metadata) are
// PLACEHOLDERS pending Bachs' real webhook payload docs — update in this one
// place once confirmed.
//
// metadata.uid: the frontend must attach the Firebase UID to the Bachs
// payment link (e.g. a `?uid={firebase_uid}` query param, or a metadata
// field Bachs echoes back in the webhook) so this handler can identify the
// payer without relying on email matching alone.
app.post('/api/payments/bachs/webhook', async (req, res) => {
  // Respond 200 immediately — Bachs requires fast acknowledgement
  res.sendStatus(200);

  if (!db) { console.warn('[bachs] Database unavailable — skipping'); return; }

  try {
    const payload = req.body;

    // Verify webhook secret if Bachs provides one
    const secret = process.env.BACHS_WEBHOOK_SECRET;
    if (secret && req.headers['x-bachs-secret'] !== secret) {
      console.error('[bachs] Invalid webhook secret');
      return;
    }

    const { status, amount, customer_email, metadata } = payload;

    // Only process confirmed/completed payments
    const confirmedStatuses = ['confirmed', 'completed', 'successful', 'paid'];
    if (!confirmedStatuses.includes(status?.toLowerCase())) {
      console.log(`[bachs] Skipping status: ${status}`);
      return;
    }

    // Determine tier from amount — 'dev'/'exec' matches the tier vocabulary
    // used everywhere else in this app (client requireTier, wts-agent auth).
    const amountNum = parseFloat(amount) || 0;
    let tier = null;
    if (amountNum >= 23 && amountNum <= 27) tier = 'dev';   // Developer plan
    if (amountNum >= 77 && amountNum <= 82) tier = 'exec';  // Executive plan

    if (!tier) {
      console.error(`[bachs] Unrecognised amount: ${amountNum}`);
      return;
    }

    // Find user by metadata uid or email
    let uid = metadata?.uid || null;

    if (!uid && customer_email) {
      const usersSnap = await db.collection('users')
        .where('email', '==', customer_email)
        .limit(1).get();
      if (!usersSnap.empty) uid = usersSnap.docs[0].id;
    }

    if (!uid) {
      console.error(`[bachs] Cannot find user for payment — email: ${customer_email}`);
      return;
    }

    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};

    // Upgrade tier and set activation countdown
    const activationDue = new Date(Date.now() + 72 * 3600000).toISOString();
    await db.collection('users').doc(uid).update({
      tier,
      credits:            999999,
      subscription_start: new Date().toISOString(),
      activation_due:     activationDue,
      'vps.status':       'pending'
    });

    console.log(`[bachs] Upgraded UID ${uid.substring(0,8)} to ${tier}`);

    const tierLabel = tier === 'exec' ? 'Executive' : 'Developer';

    // Send immediate Telegram notification
    if (userData.telegram_chat_id) {
      await sendTelegram(userData.telegram_chat_id,
        `✅ <b>Payment confirmed — Welcome to WTS ${tierLabel}!</b>\n\n` +
        `⚙️ Your trading server is being prepared.\n` +
        `📱 Open the WTS app to track progress.\n\n` +
        `worldtradestandard.com`
      );
    }

    // Send welcome email via the existing Resend helper
    if (userData.email) {
      await sendEmail(userData.email, `✅ Welcome to WTS ${tierLabel}`, `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <h2>Payment confirmed</h2>
          <p>Your ${tierLabel} plan is now active. Your dedicated trading server is being set up.</p>
          <p>You will receive another notification when your server is ready — usually within 2 minutes.</p>
          <p><a href="https://worldtradestandard.com">Open WTS App →</a></p>
        </div>
      `);
    }

    // Provision VPS if Hetzner is configured
    if (process.env.HETZNER_API_TOKEN && process.env.HETZNER_SNAPSHOT_ID) {
      const hasVps = userData?.vps?.server_id;
      if (!hasVps) {
        provisionVps(uid, userData.email || '')
          .then(async ({ ip }) => {
            // Wait 90 seconds for server to boot and agent to start
            await new Promise(r => setTimeout(r, 90000));
            await activateVps(uid);

            // Notify user server is ready
            if (userData.telegram_chat_id) {
              await sendTelegram(userData.telegram_chat_id,
                `🟢 <b>Your WTS Trading Server is Ready!</b>\n\n` +
                `Open the WTS app → My VPS\n` +
                `Connect your broker account and deploy your first robot.\n\n` +
                `worldtradestandard.com`
              );
            }
            console.log(`[hetzner] VPS ready for UID ${uid.substring(0,8)} at ${ip}`);
          })
          .catch(err => {
            console.error(`[hetzner] Provision failed for ${uid.substring(0,8)}:`, err.message);
            // VPS failed but tier upgrade succeeded — user still gets 72hr countdown
          });
      }
    } else {
      // Hetzner not configured — manual provisioning flow
      // User sees 72hr countdown, admin provisions manually via admin panel
      console.log(`[bachs] Hetzner not configured — manual VPS provision needed for ${uid.substring(0,8)}`);
    }

  } catch(err) {
    console.error('[bachs] Webhook processing error:', err.message);
  }
});

// ═══════════════════════════════════════════════════════════
//  ADMIN — MANUAL VPS CONTROL
// ═══════════════════════════════════════════════════════════

// Admin: manually trigger VPS provisioning for a user
app.post('/api/admin/vps/provision', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const result  = await provisionVps(uid, userDoc.data()?.email || '');
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: activate a user's VPS (mark as ready after manual setup)
app.post('/api/admin/vps/activate', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    await activateVps(uid);
    // Send ready notification
    const userDoc  = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    if (userData.telegram_chat_id) {
      await sendTelegram(userData.telegram_chat_id,
        `🟢 <b>Your WTS Trading Server is Ready!</b>\n\nOpen the WTS app → My VPS to get started.\n\nworldtradestandard.com`
      );
    }
    res.json({ success: true, message: `VPS activated for ${uid}` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: delete a user's VPS server
app.post('/api/admin/vps/delete', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    await deleteVps(uid);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: list all Hetzner servers tagged as WTS trading VPS
app.get('/api/admin/vps/list', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  try {
    const data = await hetzner('GET', '/servers?label_selector=purpose=wts-trading-vps');
    res.json({ servers: data.servers || [], total: data.servers?.length || 0 });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin: check Hetzner account balance
app.get('/api/admin/vps/balance', verifyAuth, async (req, res) => {
  if (req.uid !== process.env.ADMIN_UID) return res.status(403).json({ error: 'Admin only' });
  try {
    const data = await hetzner('GET', '/pricing');
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  WORLDTRADESTANDARD BACKEND v1.0`);
  console.log(`  worldtradestandard.com`);
  console.log(`═══════════════════════════════════════`);
  console.log(`  Port    : ${PORT}`);
  console.log(`  Firebase: ${db ? 'connected' : 'dev mode'}`);
  console.log(`  Payments: NowPayments ${NP_KEY ? 'configured' : 'NOT configured'}`);
  console.log(`  AI Model: ${MODEL}`);
  console.log(`═══════════════════════════════════════\n`);
});
