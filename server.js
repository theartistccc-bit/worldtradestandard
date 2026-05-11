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
      const d       = snap.data();
      req.userTier    = d.tier    || 'free';
      req.userCredits = d.credits ?? 3;
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
