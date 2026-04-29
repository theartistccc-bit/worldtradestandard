/* ═══════════════════════════════════════════════════════════
   WORLDTRADESTANDARD — app.js
   Backend: https://worldtradestandard.onrender.com
   All AI requests route through the Render backend proxy.
   No API keys live in this file — ever.
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── PRIMARY API CONFIG ─────────────────────────────────────
   All AI calls hit the Render backend. Do NOT change this.
────────────────────────────────────────────────────────── */
const API_URL = 'https://worldtradestandard.onrender.com/api/chat';

/* ── COLD START TIMEOUT ─────────────────────────────────────
   Render free tier sleeps after inactivity.
   We allow 30s before showing the wake-up message.
────────────────────────────────────────────────────────── */
const COLD_START_TIMEOUT_MS = 30000;

/* ── TRADING SCOPE GUARD ────────────────────────────────────*/
const TRADING_KEYWORDS = [
  'mql','mt4','mt5','metatrader','indicator','robot','ea','expert advisor',
  'strategy','trade','trading','chart','forex','signal','stop loss','take profit',
  'lot','pip','rsi','macd','moving average','bollinger','stochastic','breakout',
  'entry','exit','timeframe','backtest','pine','pinescript','currency','gold',
  'xauusd','eurusd','gbpusd','nasdaq','dow','prop firm','drawdown','leverage',
  'margin','candlestick','support','resistance','trend','scalping','swing',
  'position','order','buy','sell','long','short','market','price','level',
  'fibonacci','ema','sma','atr','confluence','structure','liquidity','imbalance',
  'order block','fair value gap','fvg','bos','choch','snr','news','fundamental',
  'retest','rejection','wicks','spread','commission','swap',
  'account','balance','equity','pnl','profit','loss','risk','reward'
];

const OFF_TOPIC_REPLY = "I'm your trading-only assistant. WorldTradeStandard handles MQL coding, chart analysis, trade journaling, and strategy logic — nothing else.";

/* ── BUILDER STRATEGY PARAMETERS ───────────────────────────*/
const BUILDER_PARAMS = {
  'MA Crossover':            [{k:'Fast MA Period',v:'9'},{k:'Slow MA Period',v:'21'},{k:'MA Method',v:'EMA'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'500'},{k:'Take Profit pts',v:'1000'}],
  'RSI Reversal':            [{k:'RSI Period',v:'14'},{k:'Oversold Level',v:'30'},{k:'Overbought Level',v:'70'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'400'},{k:'Take Profit pts',v:'800'}],
  'Bollinger Bands Breakout':[{k:'BB Period',v:'20'},{k:'Deviation',v:'2.0'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'600'},{k:'Take Profit pts',v:'1200'}],
  'MACD Signal Cross':       [{k:'Fast EMA',v:'12'},{k:'Slow EMA',v:'26'},{k:'Signal Period',v:'9'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'500'}],
  'S&R Breakout':            [{k:'Lookback Bars',v:'20'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'500'},{k:'Take Profit pts',v:'1000'}],
  'Grid Trading':            [{k:'Grid Step pts',v:'50'},{k:'Max Orders',v:'8'},{k:'Lot Size',v:'0.05'},{k:'Take Profit pts',v:'50'}],
  'Scalping EMA':            [{k:'Fast EMA',v:'5'},{k:'Slow EMA',v:'13'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'150'},{k:'Take Profit pts',v:'300'}],
  'Stochastic Divergence':   [{k:'K Period',v:'5'},{k:'D Period',v:'3'},{k:'Slowing',v:'3'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'400'}],
  'ATR Trailing Stop EA':    [{k:'ATR Period',v:'14'},{k:'ATR Multiplier',v:'2.5'},{k:'Lot Size',v:'0.10'},{k:'Stop Loss pts',v:'500'}],
};

/* ── APP STATE ──────────────────────────────────────────────*/
let state = {
  currentView: 'builder',
  currentTier: 'free',   // 'free' | 'dev' | 'exec'
  credits: 3,
  builderMode: 'ea',     // 'ea' | 'indicator' | 'script'
  currentCode: '',
  currentExplain: '',
  currentFileName: '',
  trades: [],
  markupHistory: [],
};

/* ═══════════════════════════════════════════════════════════
   CORE API CALL
═══════════════════════════════════════════════════════════ */
async function callRender(systemPrompt, userMessage, showColdStartUI = false) {
  const fullMessage = systemPrompt
    ? `[SYSTEM INSTRUCTIONS]\n${systemPrompt}\n\n[USER MESSAGE]\n${userMessage}`
    : userMessage;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    if (showColdStartUI) showColdStartMessage();
  }, COLD_START_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: fullMessage }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    hideColdStartMessage();

    if (!response.ok) throw new Error(`Server error ${response.status}`);

    const data = await response.json();
    // Handle both response shapes from the Render backend
    return data.content?.[0]?.text || data.reply || data.response || data.text || 'No response received.';

  } catch (err) {
    clearTimeout(timeoutId);
    hideColdStartMessage();
    throw err;
  }
}

/* ── TOPIC GUARD ────────────────────────────────────────────*/
function isTradingRelated(msg) {
  const lower = msg.toLowerCase();
  return TRADING_KEYWORDS.some(kw => lower.includes(kw));
}

/* ── COLD START UI ──────────────────────────────────────────*/
function showColdStartMessage() {
  const loadText = document.querySelector('.load-text');
  if (loadText) { loadText.textContent = 'System waking up — please wait up to 30s...'; loadText.style.color = 'var(--gold)'; }
  toast('⏳ Server waking up — this can take up to 30 seconds on first load...');
}
function hideColdStartMessage() {
  const loadText = document.querySelector('.load-text');
  if (loadText) { loadText.textContent = 'Generating MQL code...'; loadText.style.color = ''; }
}

/* ── TOAST ──────────────────────────────────────────────────*/
function toast(msg) {
  const el = document.getElementById('toastEl');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); }, 3800);
}

/* ═══════════════════════════════════════════════════════════
   APP SHELL NAVIGATION
═══════════════════════════════════════════════════════════ */
function launchApp(tier) {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  activateTier(tier);
  updateBuilderParams();
}

function exitApp() {
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
}

function switchView(viewName, tabEl) {
  // Deactivate all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.antab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sb-section').forEach(s => s.classList.add('hidden'));

  // Activate selected
  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');
  if (tabEl) tabEl.classList.add('active');

  const sb = document.getElementById('sb-' + viewName);
  if (sb) sb.classList.remove('hidden');

  state.currentView = viewName;
}

/* ── TIER MANAGEMENT ────────────────────────────────────────*/
function activateTier(tier) {
  state.currentTier = tier;
  const label = document.getElementById('tierLabel');
  const dot = document.querySelector('.tier-dot');
  const chip = document.getElementById('creditsChip');
  const upgradeBtn = document.querySelector('.app-nav-right .btn-gold');

  if (tier === 'free') {
    if (label) label.textContent = 'FREE TIER';
    if (dot) { dot.className = 'tier-dot free-dot'; }
    if (chip) { chip.textContent = `⚡ ${state.credits} left`; chip.style.display = ''; }
    if (upgradeBtn) upgradeBtn.style.display = '';
    unlockDebugger(false);
  } else if (tier === 'dev') {
    if (label) label.textContent = 'DEVELOPER';
    if (dot) { dot.className = 'tier-dot dev-dot'; }
    if (chip) chip.style.display = 'none';
    if (upgradeBtn) upgradeBtn.style.display = '';
    unlockDebugger(true);
  } else if (tier === 'exec') {
    if (label) label.textContent = 'EXECUTIVE';
    if (dot) { dot.className = 'tier-dot exec-dot'; }
    if (chip) chip.style.display = 'none';
    if (upgradeBtn) upgradeBtn.style.display = 'none';
    unlockDebugger(true);
  }
}

function unlockDebugger(unlocked) {
  const lock = document.getElementById('debugLock');
  if (lock) lock.style.display = unlocked ? 'none' : '';
}

function requireTier(minTier, featureName) {
  const tiers = { free: 0, dev: 1, exec: 2 };
  if (tiers[state.currentTier] >= tiers[minTier]) return true;
  toast(`🔒 ${featureName} requires ${minTier === 'dev' ? 'Developer ($19/mo)' : 'Executive ($79/mo)'} plan`);
  setTimeout(() => switchView('pricing', document.querySelector('[data-view=pricing]')), 1200);
  return false;
}

/* ── BUILDER MODE ───────────────────────────────────────────*/
function setBuilderMode(mode, el) {
  state.builderMode = mode;
  document.querySelectorAll('#sb-builder .sb-i').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  const titles = { ea: 'EXPERT ADVISOR', indicator: 'CUSTOM INDICATOR', script: 'SCRIPT / UTILITY' };
  const descs  = {
    ea:        'Configure your strategy and generate production-ready MQL5/MQL4 Expert Advisors.',
    indicator: 'Build custom indicators with signal arrows, alerts, and buffers.',
    script:    'Create one-click utility scripts for order management, batch operations, and more.',
  };
  const t = document.getElementById('builderModeTitle');
  const d = document.getElementById('builderModeDesc');
  if (t) t.textContent = titles[mode] || 'EXPERT ADVISOR';
  if (d) d.textContent = descs[mode] || '';
}

function updateBuilderParams() {
  const strategy = document.getElementById('b-strategy')?.value || 'MA Crossover';
  const params = BUILDER_PARAMS[strategy] || BUILDER_PARAMS['MA Crossover'];
  const container = document.getElementById('builderParams');
  if (!container) return;
  container.innerHTML = params.map(p => `
    <div class="param-row">
      <span class="param-key">${p.k}</span>
      <input class="param-val" value="${p.v}" data-key="${p.k}">
    </div>
  `).join('');
}

function getParams() {
  const rows = document.querySelectorAll('#builderParams .param-row');
  return Array.from(rows).map(r => ({
    k: r.querySelector('.param-key').textContent,
    v: r.querySelector('.param-val').value,
  }));
}

function setQuick(description) {
  const extra = document.getElementById('b-extra');
  if (extra) extra.value = description;
  generateCode();
}

/* ═══════════════════════════════════════════════════════════
   MQL CODE GENERATION
═══════════════════════════════════════════════════════════ */
async function generateCode() {
  // Credit check for free tier
  if (state.currentTier === 'free') {
    if (state.credits <= 0) {
      toast('⚡ No credits left — upgrade to Developer for unlimited generations');
      switchView('pricing', document.querySelector('[data-view=pricing]'));
      return;
    }
  }

  const strategy = document.getElementById('b-strategy')?.value || 'MA Crossover';
  const platform = document.getElementById('b-platform')?.value || 'MT5';
  const symbol   = document.getElementById('b-symbol')?.value   || 'XAUUSD';
  const tf       = document.getElementById('b-tf')?.value       || 'H1';
  const extra    = document.getElementById('b-extra')?.value    || '';
  const mode     = state.builderMode;
  const ext      = platform === 'MT5' ? 'mq5' : 'mq4';
  const params   = getParams();

  const paramStr = params.map(p => `${p.k}: ${p.v}`).join(', ');
  const typeLabel = mode === 'indicator' ? 'Custom Indicator' : mode === 'script' ? 'Script' : 'Expert Advisor';

  const systemPrompt = `You are WorldTradeStandard's MQL code engine. Your only job is to generate complete, production-ready ${ext} code.
Rules:
- Return ONLY raw ${ext} code. No markdown, no backticks, no explanations before or after the code.
- The code must compile without errors in MetaEditor.
- Include all necessary #include statements for ${platform}.
- Add a clear header comment block with strategy name, symbol, timeframe, and parameters.
- All input parameters must be declared with the 'input' keyword.
- Include OnInit(), OnDeinit(), and OnTick() functions.
- Implement proper risk management with stop loss and take profit.
- Add error checking on all trade operations.`;

  const userMessage = `Generate a complete ${platform} ${typeLabel} with the following specification:
Strategy: ${strategy}
Symbol: ${symbol}
Timeframe: ${tf}
Parameters: ${paramStr}
${extra ? `Additional requirements: ${extra}` : ''}`;

  // UI: show loading
  document.getElementById('emptyState')?.classList.add('hidden');
  document.getElementById('codePanel')?.classList.add('hidden');
  document.getElementById('loadState')?.classList.remove('hidden');
  document.getElementById('genBtn')?.setAttribute('disabled', 'true');

  // Animate load steps
  const steps = ['ls0','ls1','ls2','ls3','ls4'];
  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '0.3'; setTimeout(() => { el.style.opacity = '1'; }, i * 600); }
  });

  try {
    let code = await callRender(systemPrompt, userMessage, true);
    // Strip any accidental markdown fences
    code = code.replace(/```(?:mql[45]?|mq[45])?\n?/gi, '').replace(/```\n?/g, '').trim();

    state.currentCode = code;
    state.currentFileName = `WTS_${strategy.replace(/\s+/g,'_')}_${symbol}.${ext}`;

    // Generate explanation asynchronously (fire and forget)
    generateExplanation(strategy, platform, params);

    if (state.currentTier === 'free') {
      state.credits--;
      const chip = document.getElementById('creditsChip');
      if (chip) chip.textContent = `⚡ ${state.credits} left`;
    }

    showCodePanel(code);
    toast('✓ Code generated successfully');
  } catch (err) {
    document.getElementById('loadState')?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
    toast('❌ Error: ' + err.message);
  } finally {
    document.getElementById('genBtn')?.removeAttribute('disabled');
  }
}

async function generateExplanation(strategy, platform, params) {
  const systemPrompt = `You are a trading education expert. Explain MQL code in simple, clear English for traders who may not be programmers. Be concise — use bullet points.`;
  const userMessage  = `Explain how this ${strategy} ${platform} Expert Advisor works:
Parameters used: ${params.map(p => `${p.k}=${p.v}`).join(', ')}
Cover: (1) what the strategy does, (2) entry logic, (3) exit logic, (4) risk management, (5) best use case.`;
  try {
    state.currentExplain = await callRender(systemPrompt, userMessage);
  } catch { state.currentExplain = 'Explanation unavailable.'; }
}

function showCodePanel(code) {
  document.getElementById('loadState')?.classList.add('hidden');
  document.getElementById('emptyState')?.classList.add('hidden');

  const panel = document.getElementById('codePanel');
  const fname = document.getElementById('cpFname');
  const display = document.getElementById('codeDisplay');

  if (fname) fname.textContent = state.currentFileName;
  if (display) display.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`;
  if (panel) panel.classList.remove('hidden');

  // Reset tabs
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  document.querySelector('.ctab')?.classList.add('active');
}

function showMQL(tabEl) {
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  const d = document.getElementById('codeDisplay');
  if (d) d.innerHTML = `<pre><code>${escapeHtml(state.currentCode)}</code></pre>`;
}

function showExplain(tabEl) {
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  const d = document.getElementById('codeDisplay');
  if (d) d.innerHTML = `<div class="explain-text">${state.currentExplain || 'Generating explanation...'}</div>`;
}

function copyCode() {
  navigator.clipboard.writeText(state.currentCode).then(() => toast('✓ Code copied to clipboard'));
}

function downloadCode() {
  if (!state.currentCode) return;
  const blob = new Blob([state.currentCode], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = state.currentFileName || 'WTS_EA.mq5';
  a.click();
  URL.revokeObjectURL(a.href);
}

function regenCode() { generateCode(); }

/* ═══════════════════════════════════════════════════════════
   CHART MARKUP AI
═══════════════════════════════════════════════════════════ */
async function sendMarkup() {
  const input = document.getElementById('markupInput');
  const msg = input?.value?.trim();
  if (!msg) return;

  if (!isTradingRelated(msg)) {
    appendChatMsg('ai', OFF_TOPIC_REPLY);
    input.value = '';
    return;
  }

  appendChatMsg('user', msg);
  input.value = '';

  // Build style profile from active tags
  const activeTags = Array.from(document.querySelectorAll('#styleTags .st.active')).map(t => t.textContent);
  const styleProfile = activeTags.length ? activeTags.join(', ') : 'Breakout, XAUUSD, 1.5 RR';

  const systemPrompt = `You are WorldTradeStandard's Chart Markup AI. The trader's style profile is: ${styleProfile}.
Analyse charts and setups ONLY through this trader's specific lens. Identify:
- Key levels (support, resistance, order blocks, FVGs)
- Whether the setup matches the trader's style
- Suggested entry price, stop loss, take profit
- Risk-reward ratio
- Confidence level (High / Medium / Low)
Keep responses concise, structured, and actionable. Refuse all non-trading questions.`;

  const thinkingEl = appendChatMsg('ai', '<em style="color:var(--muted)">Analysing setup...</em>', true);

  try {
    const reply = await callRender(systemPrompt, msg);
    thinkingEl.querySelector('.chat-bubble').innerHTML = reply.replace(/\n/g, '<br>');
  } catch (err) {
    thinkingEl.querySelector('.chat-bubble').textContent = 'Error: ' + err.message;
  }
}

function handleChartUpload(input) {
  if (!input.files?.[0]) return;
  toast(`📎 Chart attached: ${input.files[0].name} — describe the setup in the chat`);
  appendChatMsg('ai', `Chart image received. Describe what you're seeing or ask me to analyse the structure, and I'll respond based on your style profile.`);
}

function appendChatMsg(role, html, returnEl = false) {
  const thread = document.getElementById('markupThread');
  if (!thread) return;
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.innerHTML = `
    <div class="chat-avatar ${role}">${role === 'ai' ? 'WTS' : 'YOU'}</div>
    <div class="chat-bubble">${html}</div>
  `;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return returnEl ? el : undefined;
}

/* ═══════════════════════════════════════════════════════════
   AUTO-DEBUGGER
═══════════════════════════════════════════════════════════ */
async function runDebugger() {
  if (!requireTier('dev', 'Auto-Debugger')) return;

  const errorLog = document.getElementById('errorLog')?.value?.trim();
  if (!errorLog) { toast('Paste your MetaEditor error log first'); return; }

  const output   = document.getElementById('debugOutput');
  const statusEl = document.getElementById('debugStatus');
  if (statusEl) statusEl.textContent = 'ANALYSING';

  output.innerHTML = `
    <div class="debug-step thinking">🔍 Reading error log...</div>
    <div class="debug-step thinking">⚙️ Identifying root causes...</div>
    <div class="debug-step thinking">🛠️ Generating fixed code lines...</div>
  `;

  const systemPrompt = `You are WorldTradeStandard's MQL Auto-Debugger. You are an expert in MetaTrader 4 and MetaTrader 5 MQL programming.
When given a MetaEditor error log:
1. List each error/warning with its line number
2. Explain the root cause in plain English
3. Provide the corrected code line(s)
Format each error as:
ERROR [line X]: <error text>
CAUSE: <plain English explanation>
FIX: <corrected code>
---
Be thorough and precise. Cover all errors and warnings in the log.`;

  try {
    const result = await callRender(systemPrompt, `Fix these MetaEditor errors:\n\n${errorLog}`);
    output.innerHTML = `
      <div class="debug-step done">✓ Analysis complete — ${(result.match(/ERROR/g)||[]).length || 'All'} issues identified</div>
      <div class="debug-result">${escapeHtml(result)}</div>
    `;
    if (statusEl) statusEl.textContent = 'COMPLETE';
    toast('✓ Debug analysis complete');
  } catch (err) {
    output.innerHTML = `<div class="debug-step" style="color:var(--red)">❌ Error: ${err.message}</div>`;
    if (statusEl) statusEl.textContent = 'ERROR';
  }
}

/* ═══════════════════════════════════════════════════════════
   TRADE JOURNAL
═══════════════════════════════════════════════════════════ */
function openLogModal() {
  document.getElementById('logModal')?.classList.remove('hidden');
}
function closeLogModal() {
  document.getElementById('logModal')?.classList.add('hidden');
}

async function saveTrade() {
  const pair  = document.getElementById('m-pair')?.value;
  const dir   = document.getElementById('m-dir')?.value;
  const entry = document.getElementById('m-entry')?.value;
  const lot   = document.getElementById('m-lot')?.value;
  const sl    = document.getElementById('m-sl')?.value;
  const tp    = document.getElementById('m-tp')?.value;
  const setup = document.getElementById('m-setup')?.value;
  const tf    = document.getElementById('m-tf')?.value;
  const notes = document.getElementById('m-notes')?.value;
  const emos  = Array.from(document.querySelectorAll('#emoTags .et.active')).map(e => e.textContent);

  if (!entry || !sl || !tp) { toast('Fill in Entry, Stop Loss, and Take Profit'); return; }

  const rr = Math.abs((parseFloat(tp) - parseFloat(entry)) / (parseFloat(entry) - parseFloat(sl))).toFixed(2);

  const trade = {
    id: Date.now(),
    pair, dir, entry, lot, sl, tp, setup, tf, notes,
    emotions: emos,
    rr,
    date: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    status: 'open',
    pnl: null,
    aiAnalysis: null,
  };

  state.trades.unshift(trade);
  closeLogModal();
  renderTradeList();
  toast('Trade logged — generating AI analysis...');

  // AI analysis
  try {
    const systemPrompt = `You are WorldTradeStandard's Trade Journal AI. Analyse this trade setup and provide:
1. Setup quality score (1-10)
2. Whether the setup matches good trading principles
3. Potential risks
4. What to watch for during the trade
5. One key lesson from this setup
Be direct, concise, and educational. Max 150 words.`;

    const userMessage = `Analyse this trade:
Pair: ${pair} | Direction: ${dir} | Entry: ${entry} | SL: ${sl} | TP: ${tp}
Setup: ${setup} | Timeframe: ${tf} | R:R: ${rr}
Pre-trade notes: ${notes || 'None'}
Emotional state: ${emos.join(', ') || 'Not specified'}`;

    trade.aiAnalysis = await callRender(systemPrompt, userMessage);
    renderTradeList();
    toast('✓ AI analysis ready');
  } catch { trade.aiAnalysis = 'Analysis unavailable.'; }
}

function filterTrades(filter, el) {
  document.querySelectorAll('#sb-journal .sb-i').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  const list = document.getElementById('tradeList');
  if (!list) return;

  let filtered = state.trades;
  if (filter === 'win')  filtered = state.trades.filter(t => t.pnl > 0);
  if (filter === 'loss') filtered = state.trades.filter(t => t.pnl < 0);
  if (filter === 'open') filtered = state.trades.filter(t => t.status === 'open');
  if (['XAUUSD','EURUSD','US30'].includes(filter)) filtered = state.trades.filter(t => t.pair === filter);

  renderTradeList(filtered);
}

function renderTradeList(trades) {
  const list = trades || state.trades;
  const container = document.getElementById('tradeList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem"><h3>NO TRADES YET</h3><p>Log your first trade to begin tracking your performance.</p></div>`;
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="trade-row" onclick="viewTrade(${t.id})">
      <div class="tr-left">
        <div class="tr-pair">${t.pair}</div>
        <div class="tr-meta">${t.dir} · ${t.setup} · ${t.tf}</div>
      </div>
      <div class="tr-right">
        <div class="tr-rr" style="color:var(--gold)">${t.rr}R</div>
        <div class="tr-date">${t.date}</div>
        <div class="tr-status ${t.status}">${t.status.toUpperCase()}</div>
      </div>
    </div>
  `).join('');
}

function viewTrade(id) {
  const trade = state.trades.find(t => t.id === id);
  if (!trade) return;
  const detail = document.getElementById('tradeDetail');
  if (!detail) return;
  detail.innerHTML = `
    <div class="td-content">
      <div class="td-head">
        <h2>${trade.pair} ${trade.dir}</h2>
        <div class="td-meta">${trade.setup} · ${trade.tf} · ${trade.date}</div>
      </div>
      <div class="td-grid">
        <div class="td-kpi"><div class="td-lbl">Entry</div><div class="td-val">${trade.entry}</div></div>
        <div class="td-kpi"><div class="td-lbl">Stop Loss</div><div class="td-val" style="color:var(--red)">${trade.sl}</div></div>
        <div class="td-kpi"><div class="td-lbl">Take Profit</div><div class="td-val" style="color:var(--green)">${trade.tp}</div></div>
        <div class="td-kpi"><div class="td-lbl">R:R Ratio</div><div class="td-val" style="color:var(--gold)">${trade.rr}</div></div>
        <div class="td-kpi"><div class="td-lbl">Lot Size</div><div class="td-val">${trade.lot}</div></div>
        <div class="td-kpi"><div class="td-lbl">Status</div><div class="td-val">${trade.status.toUpperCase()}</div></div>
      </div>
      ${trade.notes ? `<div class="td-section"><div class="td-section-title">PRE-TRADE NOTES</div><div class="td-text">${trade.notes}</div></div>` : ''}
      ${trade.emotions.length ? `<div class="td-section"><div class="td-section-title">EMOTIONAL STATE</div><div class="emo-tags">${trade.emotions.map(e=>`<span class="et active">${e}</span>`).join('')}</div></div>` : ''}
      <div class="td-section">
        <div class="td-section-title">AI ANALYSIS</div>
        <div class="td-ai-box">${trade.aiAnalysis || '<em style="color:var(--muted)">Generating analysis...</em>'}</div>
      </div>
    </div>
  `;
}

/* ── UTILITY ────────────────────────────────────────────────*/
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  updateBuilderParams();
  renderTradeList();
  console.log('%cWORLDTRADESTANDARD', 'color:#C9A84C;font-family:monospace;font-size:16px;font-weight:bold');
  console.log('%cBackend: ' + API_URL, 'color:#5A6480;font-family:monospace;font-size:11px');
});
