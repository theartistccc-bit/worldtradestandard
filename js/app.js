/* ═══════════════════════════════════════════════════════════
   WORLDTRADESTANDARD — app.js
   Domain  : worldtradestandard.com
   Backend : https://api.worldtradestandard.com
   Auth    : Firebase (Email + Google)
   Payments: NowPayments (crypto)
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── API CONFIG ─────────────────────────────────────────────*/
const API_BASE = 'https://api.worldtradestandard.com';

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
  currentView:    'journal',
  currentTier:    'free',
  credits:        3,
  builderMode:    'ea',
  currentCode:    '',
  currentExplain: '',
  currentFileName:'',
  trades:         [],
  savedEAs:       [],
  markupHistory:  [],
  user:           null,   // Firebase user object
};

/* ═══════════════════════════════════════════════════════════
   FIREBASE AUTH STATE
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  updateBuilderParams();
  renderTradeList();
  checkPaymentReturn();

  // Firebase auth guard
  if (typeof firebase === 'undefined') {
    // Firebase not loaded (e.g. no config set) — dev mode, skip auth
    console.warn('[WTS] Firebase not loaded — running without auth');
    document.getElementById('authModal')?.classList.add('hidden');
    document.getElementById('landing')?.classList.remove('hidden');
    activateTier('free');
    return;
  }

  firebase.auth().onAuthStateChanged(async (user) => {
    document.documentElement.style.visibility = 'visible';
    const modal = document.getElementById('authModal');
    if (user) {
      state.user = user;
      modal?.classList.add('hidden');

      // Hash routing: links from builder.html/results.html use index.html#viewname
      const APP_VIEWS = ['journal','markup','debugger','stats','pricing'];
      const hash = location.hash.slice(1);
      if (APP_VIEWS.includes(hash)) {
        window.history.replaceState({}, '', window.location.pathname);
        document.getElementById('landing')?.classList.add('hidden');
        document.getElementById('appShell')?.classList.remove('hidden');
        switchView(hash, document.querySelector(`[data-view="${hash}"]`));
      } else {
        document.getElementById('landing')?.classList.remove('hidden');
      }

      // Load profile from backend
      try {
        const profile = await callAPIGet('/api/user');
        state.currentTier = profile.tier    || 'free';
        state.credits     = profile.credits ?? 3;
        activateTier(state.currentTier);
        loadUserData(); // async — load trades + EAs
      } catch (e) {
        console.warn('[WTS] Failed to load profile:', e.message);
        activateTier('free');
      }
      checkOnboarding();
    } else {
      state.user = null;
      modal?.classList.remove('hidden');
      document.getElementById('landing')?.classList.add('hidden');
      document.getElementById('appShell')?.classList.add('hidden');
    }
  });

  console.log('%cWORLDTRADESTANDARD', 'color:#378ADD;font-family:monospace;font-size:16px;font-weight:bold');
  console.log('%capi.worldtradestandard.com', 'color:#5A6480;font-family:monospace;font-size:11px');
});

/* ── Check if user returned from NowPayments ────────────────*/
function checkPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    document.getElementById('paymentBanner')?.classList.remove('hidden');
    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname);
    // Re-load profile after a moment (webhook may have updated tier)
    setTimeout(async () => {
      try {
        const profile = await callAPIGet('/api/user');
        state.currentTier = profile.tier || 'free';
        state.credits     = profile.credits ?? 3;
        activateTier(state.currentTier);
      } catch (e) { /* silent */ }
    }, 3000);
  }
}

/* ═══════════════════════════════════════════════════════════
   AUTH FUNCTIONS
═══════════════════════════════════════════════════════════ */
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginForm')  ?.classList.toggle('hidden', !isLogin);
  document.getElementById('signupForm') ?.classList.toggle('hidden',  isLogin);
  document.getElementById('loginTab')   ?.classList.toggle('active',   isLogin);
  document.getElementById('signupTab')  ?.classList.toggle('active',  !isLogin);
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function clearAuthError() {
  document.getElementById('authError')?.classList.add('hidden');
}

function setAuthLoading(loading) {
  ['loginBtn','signupBtn','googleLoginBtn','googleSignupBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = loading; el.style.opacity = loading ? '0.5' : ''; }
  });
}

function getFriendlyAuthError(code) {
  const map = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password.',
    'auth/invalid-credential':    'Invalid email or password.',
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/invalid-email':         'Invalid email address.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/too-many-requests':     'Too many attempts — please try again later.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/popup-closed-by-user':  'Sign-in popup was closed.',
  };
  return map[code] || 'Authentication failed. Please try again.';
}

async function signInEmail() {
  const email    = document.getElementById('loginEmail')?.value?.trim();
  const password = document.getElementById('loginPassword')?.value;
  if (!email || !password) { showAuthError('Enter your email and password.'); return; }
  try {
    setAuthLoading(true);
    clearAuthError();
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (e) {
    showAuthError(getFriendlyAuthError(e.code));
  } finally {
    setAuthLoading(false);
  }
}

async function signUpEmail() {
  const email    = document.getElementById('signupEmail')?.value?.trim();
  const password = document.getElementById('signupPassword')?.value;
  if (!email || !password) { showAuthError('Enter your email and password.'); return; }
  if (password.length < 6)  { showAuthError('Password must be at least 6 characters.'); return; }
  try {
    setAuthLoading(true);
    clearAuthError();
    await firebase.auth().createUserWithEmailAndPassword(email, password);
  } catch (e) {
    showAuthError(getFriendlyAuthError(e.code));
  } finally {
    setAuthLoading(false);
  }
}

async function signInGoogle() {
  try {
    setAuthLoading(true);
    clearAuthError();
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showAuthError(getFriendlyAuthError(e.code));
    }
  } finally {
    setAuthLoading(false);
  }
}

function signOut() {
  if (typeof firebase !== 'undefined') firebase.auth().signOut();
}

/* ═══════════════════════════════════════════════════════════
   API HELPERS (authenticated)
═══════════════════════════════════════════════════════════ */
async function getToken() {
  if (typeof firebase === 'undefined') return 'dev-token';
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function callAPI(endpoint, body = {}) {
  const token    = await getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    if (err.error === 'credits_exhausted') {
      toast('⚡ No credits left — upgrade for unlimited generations');
      setTimeout(() => switchView('pricing', document.querySelector('[data-view=pricing]')), 1000);
    }
    if (err.error === 'tier_required') {
      toast('🔒 ' + (err.message || 'Upgrade required'));
      setTimeout(() => switchView('pricing', document.querySelector('[data-view=pricing]')), 1000);
    }
    throw new Error(err.message || err.error || `Server error ${response.status}`);
  }
  return response.json();
}

async function callAPIGet(endpoint) {
  const token    = await getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Server error ${response.status}`);
  return response.json();
}

/* ── Load user's saved data on login ────────────────────────*/
async function loadUserData() {
  try {
    const [jData, eData] = await Promise.all([
      callAPIGet('/api/journal'),
      callAPIGet('/api/eas'),
    ]);
    if (jData.trades?.length) {
      state.trades = jData.trades;
      renderTradeList();
      if (state.currentView === 'stats') renderStats();
    }
    if (eData.eas?.length) {
      state.savedEAs = eData.eas;
    }
  } catch (e) {
    console.warn('[WTS] loadUserData:', e.message);
  }
}

/* ═══════════════════════════════════════════════════════════
   NOWPAYMENTS — UPGRADE PLAN
═══════════════════════════════════════════════════════════ */
async function upgradePlan(plan) {
  if (typeof firebase !== 'undefined' && !firebase.auth().currentUser) {
    toast('Please sign in first to upgrade.');
    document.getElementById('authModal')?.classList.remove('hidden');
    return;
  }
  try {
    toast('⏳ Creating payment invoice...');
    const result = await callAPI('/api/nowpayments/create-invoice', { plan });
    if (result.invoice_url) {
      window.location.href = result.invoice_url;
    } else {
      toast('❌ Could not create invoice. Please try again.');
    }
  } catch (err) {
    toast('❌ ' + err.message);
  }
}

/* ═══════════════════════════════════════════════════════════
   APP SHELL NAVIGATION
═══════════════════════════════════════════════════════════ */
function launchApp(tier, view) {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  const targetView = view || 'journal';
  switchView(targetView, document.querySelector(`[data-view="${targetView}"]`));
  if (tier && tier !== state.currentTier) activateTier(tier);
}

function exitApp() {
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
}

function switchView(viewName, tabEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.antab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sb-section').forEach(s => s.classList.add('hidden'));

  const view = document.getElementById('view-' + viewName);
  if (view) view.classList.add('active');
  if (tabEl) tabEl.classList.add('active');
  const sb = document.getElementById('sb-' + viewName);
  if (sb) sb.classList.remove('hidden');

  state.currentView = viewName;
  if (viewName === 'stats') renderStats();
}

/* ── Tier Management ────────────────────────────────────────*/
function activateTier(tier) {
  state.currentTier = tier;
  const label      = document.getElementById('tierLabel');
  const dot        = document.querySelector('.tier-dot');
  const chip       = document.getElementById('creditsChip');
  const upgradeBtn = document.querySelector('.app-nav-right .btn-gold');

  if (tier === 'free') {
    if (label)      label.textContent = 'FREE TIER';
    if (dot)        dot.className = 'tier-dot free-dot';
    if (chip)       { chip.textContent = `⚡ ${state.credits} left`; chip.style.display = ''; }
    if (upgradeBtn) upgradeBtn.style.display = '';
    unlockDebugger(false);
  } else if (tier === 'dev') {
    if (label)      label.textContent = 'DEVELOPER';
    if (dot)        dot.className = 'tier-dot dev-dot';
    if (chip)       chip.style.display = 'none';
    if (upgradeBtn) upgradeBtn.style.display = '';
    unlockDebugger(true);
  } else if (tier === 'exec') {
    if (label)      label.textContent = 'EXECUTIVE';
    if (dot)        dot.className = 'tier-dot exec-dot';
    if (chip)       chip.style.display = 'none';
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
  toast(`🔒 ${featureName} requires ${minTier === 'dev' ? 'Developer ($15/mo)' : 'Executive ($79/mo)'} plan`);
  setTimeout(() => switchView('pricing', document.querySelector('[data-view=pricing]')), 1200);
  return false;
}

/* ── Builder Mode ───────────────────────────────────────────*/
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
  if (d) d.textContent = descs[mode]  || '';
}

function updateBuilderParams() {
  const strategy = document.getElementById('b-strategy')?.value || 'MA Crossover';
  const params   = BUILDER_PARAMS[strategy] || BUILDER_PARAMS['MA Crossover'];
  const container= document.getElementById('builderParams');
  if (!container) return;
  container.innerHTML = params.map(p => `
    <div class="param-row">
      <span class="param-key">${p.k}</span>
      <input class="param-val" value="${p.v}" data-key="${p.k}">
    </div>
  `).join('');
}

function getParams() {
  return Array.from(document.querySelectorAll('#builderParams .param-row')).map(r => ({
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
  if (state.currentTier === 'free' && state.credits <= 0) {
    toast('⚡ No credits left — upgrade to Developer for unlimited generations');
    switchView('pricing', document.querySelector('[data-view=pricing]'));
    return;
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
  const typeLabel= mode === 'indicator' ? 'Custom Indicator' : mode === 'script' ? 'Script' : 'Expert Advisor';

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

  const userMessage = `Generate a complete ${platform} ${typeLabel}:
Strategy: ${strategy}
Symbol: ${symbol}
Timeframe: ${tf}
Parameters: ${paramStr}
${extra ? `Additional requirements: ${extra}` : ''}`;

  // Show loading
  document.getElementById('emptyState') ?.classList.add('hidden');
  document.getElementById('codePanel')  ?.classList.add('hidden');
  document.getElementById('loadState')  ?.classList.remove('hidden');
  document.getElementById('genBtn')     ?.setAttribute('disabled', 'true');

  ['ls0','ls1','ls2','ls3','ls4'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) { el.style.opacity = '0.3'; setTimeout(() => { el.style.opacity = '1'; }, i * 600); }
  });

  try {
    const result = await callAPI('/api/generate', {
      systemPrompt, userMessage, strategy, platform, symbol, builderMode: mode,
    });

    let code = result.code;
    code = code.replace(/```(?:mql[45]?|mq[45])?\n?/gi, '').replace(/```\n?/g, '').trim();

    state.currentCode     = code;
    state.currentFileName = `WTS_${strategy.replace(/\s+/g,'_')}_${symbol}.${ext}`;

    // Update credits if free tier
    if (result.creditsLeft !== null && result.creditsLeft !== undefined) {
      state.credits = result.creditsLeft;
      const chip = document.getElementById('creditsChip');
      if (chip) chip.textContent = `⚡ ${state.credits} left`;
    }

    // Fire-and-forget explanation
    generateExplanation(strategy, platform, params);

    showCodePanel(code);
    toast('✓ Code generated — saved to your account');
  } catch (err) {
    document.getElementById('loadState') ?.classList.add('hidden');
    document.getElementById('emptyState')?.classList.remove('hidden');
    toast('❌ ' + err.message);
  } finally {
    document.getElementById('genBtn')?.removeAttribute('disabled');
  }
}

async function generateExplanation(strategy, platform, params) {
  const systemPrompt = `You are a trading education expert. Explain MQL code in simple, clear English for traders. Be concise — use bullet points.`;
  const userMessage  = `Explain how this ${strategy} ${platform} Expert Advisor works. Parameters: ${params.map(p=>`${p.k}=${p.v}`).join(', ')}.
Cover: (1) what the strategy does, (2) entry logic, (3) exit logic, (4) risk management, (5) best use case.`;
  try {
    const result = await callAPI('/api/generate', { systemPrompt, userMessage });
    state.currentExplain = result.code || result.reply || '';
  } catch {
    state.currentExplain = 'Explanation unavailable.';
  }
}

function showCodePanel(code) {
  document.getElementById('loadState') ?.classList.add('hidden');
  document.getElementById('emptyState')?.classList.add('hidden');
  const panel   = document.getElementById('codePanel');
  const fname   = document.getElementById('cpFname');
  const display = document.getElementById('codeDisplay');
  if (fname)   fname.textContent = state.currentFileName;
  if (display) display.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`;
  if (panel)   panel.classList.remove('hidden');
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
  if (d) d.innerHTML = `<div class="explain-text">${state.currentExplain || '<em style="color:var(--muted)">Generating explanation...</em>'}</div>`;
}

function copyCode() {
  navigator.clipboard.writeText(state.currentCode).then(() => toast('✓ Code copied to clipboard'));
}

function downloadCode() {
  if (!state.currentCode) return;
  const blob = new Blob([state.currentCode], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
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
  const msg   = input?.value?.trim();
  if (!msg) return;

  if (!isTradingRelated(msg)) {
    appendChatMsg('ai', OFF_TOPIC_REPLY);
    input.value = '';
    return;
  }

  if (!requireTier('dev', 'Chart Markup AI')) { input.value = ''; return; }

  appendChatMsg('user', msg);
  input.value = '';

  const activeTags   = Array.from(document.querySelectorAll('#styleTags .st.active')).map(t => t.textContent);
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
    const result = await callAPI('/api/markup', { systemPrompt, userMessage: msg });
    thinkingEl.querySelector('.chat-bubble').innerHTML = result.reply.replace(/\n/g, '<br>');
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

  if (output) output.innerHTML = `
    <div class="debug-step thinking">🔍 Reading error log...</div>
    <div class="debug-step thinking">⚙️ Identifying root causes...</div>
    <div class="debug-step thinking">🛠️ Generating fixed code lines...</div>
  `;

  try {
    const result = await callAPI('/api/debug', { errorLog });
    const reply  = result.reply;
    if (output) output.innerHTML = `
      <div class="debug-step done">✓ Analysis complete — ${(reply.match(/ERROR/g)||[]).length || 'All'} issues identified</div>
      <div class="debug-result">${escapeHtml(reply)}</div>
    `;
    if (statusEl) statusEl.textContent = 'COMPLETE';
    toast('✓ Debug analysis complete');
  } catch (err) {
    if (output) output.innerHTML = `<div class="debug-step" style="color:var(--red)">❌ Error: ${escapeHtml(err.message)}</div>`;
    if (statusEl) statusEl.textContent = 'ERROR';
  }
}

/* ═══════════════════════════════════════════════════════════
   TRADE JOURNAL
═══════════════════════════════════════════════════════════ */
function openLogModal()  { document.getElementById('logModal')?.classList.remove('hidden'); }
function closeLogModal() { document.getElementById('logModal')?.classList.add('hidden'); }

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
    pair, dir, entry, lot, sl, tp, setup, tf, notes,
    emotions: emos, rr,
    date: new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    status: 'open',
    pnl: null,
    aiAnalysis: null,
  };

  // Save to Firestore (or local if no auth)
  try {
    if (state.user) {
      const { tradeId } = await callAPI('/api/journal/save', { trade });
      trade.id = tradeId;
    } else {
      trade.id = Date.now();
    }
  } catch (e) {
    trade.id = Date.now();
    console.warn('[WTS] Cloud save failed:', e.message);
  }

  state.trades.unshift(trade);
  closeLogModal();
  renderTradeList();
  toast('Trade logged — generating AI analysis...');

  // AI analysis (dev/exec only)
  if (state.currentTier !== 'free') {
    try {
      const tradeData = `Pair: ${pair} | Direction: ${dir} | Entry: ${entry} | SL: ${sl} | TP: ${tp}
Setup: ${setup} | Timeframe: ${tf} | R:R: ${rr}
Pre-trade notes: ${notes || 'None'}
Emotional state: ${emos.join(', ') || 'Not specified'}`;

      const { analysis } = await callAPI('/api/journal/analyse', {
        tradeData,
        tradeId: trade.id,
      });
      trade.aiAnalysis = analysis;
      renderTradeList();
      toast('✓ AI analysis ready');
    } catch (e) {
      trade.aiAnalysis = 'Analysis unavailable.';
    }
  }
}

function filterTrades(filter, el) {
  document.querySelectorAll('#sb-journal .sb-i').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  let filtered = state.trades;
  if (filter === 'win')  filtered = state.trades.filter(t => t.pnl > 0);
  if (filter === 'loss') filtered = state.trades.filter(t => t.pnl < 0);
  if (filter === 'open') filtered = state.trades.filter(t => t.status === 'open');
  if (['XAUUSD','EURUSD','US30'].includes(filter)) filtered = state.trades.filter(t => t.pair === filter);
  renderTradeList(filtered);
}

function renderTradeList(trades) {
  const list      = trades || state.trades;
  const container = document.getElementById('tradeList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem"><h3>NO TRADES YET</h3><p>Log your first trade to begin tracking your performance.</p></div>`;
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="trade-row" onclick="viewTrade('${t.id}')">
      <div class="tr-left">
        <div class="tr-pair">${t.pair}</div>
        <div class="tr-meta">${t.dir} · ${t.setup} · ${t.tf}</div>
      </div>
      <div class="tr-right">
        <div class="tr-rr" style="color:var(--green)">${t.rr}R</div>
        <div class="tr-date">${t.date}</div>
        <div class="tr-status ${t.status}">${t.status.toUpperCase()}</div>
      </div>
    </div>
  `).join('');
}

function viewTrade(id) {
  const trade = state.trades.find(t => String(t.id) === String(id));
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
        <div class="td-kpi"><div class="td-lbl">R:R Ratio</div><div class="td-val" style="color:var(--green)">${trade.rr}</div></div>
        <div class="td-kpi"><div class="td-lbl">Lot Size</div><div class="td-val">${trade.lot}</div></div>
        <div class="td-kpi"><div class="td-lbl">Status</div><div class="td-val">${trade.status.toUpperCase()}</div></div>
      </div>
      ${trade.notes ? `<div class="td-section"><div class="td-section-title">PRE-TRADE NOTES</div><div class="td-text">${escapeHtml(trade.notes)}</div></div>` : ''}
      ${trade.emotions?.length ? `<div class="td-section"><div class="td-section-title">EMOTIONAL STATE</div><div class="emo-tags">${trade.emotions.map(e=>`<span class="et active">${e}</span>`).join('')}</div></div>` : ''}
      <div class="td-section">
        <div class="td-section-title">AI ANALYSIS</div>
        <div class="td-ai-box">${trade.aiAnalysis || (state.currentTier === 'free' ? '<em style="color:var(--muted)">Upgrade to Developer for AI trade analysis.</em>' : '<em style="color:var(--muted)">Generating analysis...</em>')}</div>
      </div>
      ${trade.status === 'open' ? `
      <div class="td-section">
        <div class="td-section-title">CLOSE TRADE</div>
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap">
          <select id="close-outcome-${trade.id}" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:.45rem .7rem;border-radius:6px;font-size:.8rem;font-family:'Outfit',sans-serif;outline:none">
            <option value="win">Win ✓</option>
            <option value="loss">Loss ✗</option>
          </select>
          <input id="close-pnl-${trade.id}" type="number" placeholder="P&L in $  e.g. 240" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:.45rem .7rem;border-radius:6px;font-size:.8rem;font-family:'Outfit',sans-serif;width:150px;outline:none">
          <button onclick="closeTrade('${trade.id}')" style="padding:.45rem 1rem;border-radius:6px;border:none;background:var(--green);color:#fff;font-family:'Outfit',sans-serif;font-size:.78rem;font-weight:600;cursor:pointer">Mark Closed</button>
        </div>
      </div>` : ''}
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════ */
function isTradingRelated(msg) {
  const lower = msg.toLowerCase();
  return TRADING_KEYWORDS.some(kw => lower.includes(kw));
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg) {
  const el = document.getElementById('toastEl');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); }, 3800);
}

/* ═══════════════════════════════════════════════════════════
   CLOSE TRADE
═══════════════════════════════════════════════════════════ */
async function closeTrade(id) {
  const trade = state.trades.find(t => String(t.id) === String(id));
  if (!trade) return;
  const outcome = document.getElementById(`close-outcome-${id}`)?.value || 'win';
  const pnlRaw  = parseFloat(document.getElementById(`close-pnl-${id}`)?.value);
  if (isNaN(pnlRaw) || pnlRaw === 0) { toast('Enter a P&L amount to close this trade'); return; }

  const pnl       = outcome === 'win' ? Math.abs(pnlRaw) : -Math.abs(pnlRaw);
  const closeDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });

  trade.status    = outcome;
  trade.pnl       = pnl;
  trade.closeDate = closeDate;

  try {
    if (state.user && !String(id).startsWith('local-')) {
      await callAPI('/api/journal/update', { tradeId: id, update: { status: outcome, pnl, closeDate } });
    }
  } catch (e) {
    console.warn('[WTS] Trade close failed:', e.message);
  }

  renderTradeList();
  viewTrade(id);
  toast(`Trade closed — ${outcome === 'win' ? '+' : ''}$${Math.abs(pnl).toFixed(0)} recorded`);
}

/* ═══════════════════════════════════════════════════════════
   PERFORMANCE METRICS
═══════════════════════════════════════════════════════════ */
function renderStats() {
  const kpisEl   = document.getElementById('stats-kpis');
  const instEl   = document.getElementById('stats-inst-kpis');
  const panelsEl = document.getElementById('stats-panels');
  if (!kpisEl || !panelsEl) return;
  if (instEl) instEl.innerHTML = '';

  const closed = state.trades.filter(t => t.status !== 'open' && t.pnl !== null);

  // ── Empty state ──────────────────────────────────────────
  if (!closed.length) {
    kpisEl.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:3px;color:var(--muted);margin-bottom:.5rem">NO CLOSED TRADES YET</div>
      <div style="font-size:.78rem;color:var(--muted)">Log a trade in your journal and close it to see performance metrics here.</div>
    </div>`;
    panelsEl.innerHTML = '';
    return;
  }

  // ── Core calculations ────────────────────────────────────
  const wins      = closed.filter(t => t.pnl > 0);
  const losses    = closed.filter(t => t.pnl <= 0);
  const wr        = wins.length / closed.length;
  const netPnl    = closed.reduce((s, t) => s + t.pnl, 0);
  const avgRR     = closed.reduce((s, t) => s + parseFloat(t.rr || 0), 0) / closed.length;
  const grossWin  = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const avgWin    = wins.length   ? grossWin   / wins.length   : 0;
  const avgLoss   = losses.length ? grossLoss  / losses.length : 0;
  const pf        = grossLoss === 0 ? '∞' : (grossWin / grossLoss).toFixed(2);
  const expectancy = (wr * avgWin) - ((1 - wr) * avgLoss);

  const pairMap = {}, setupMap = {};
  closed.forEach(t => {
    if (!pairMap[t.pair])   pairMap[t.pair]   = { wins: 0, total: 0 };
    if (!setupMap[t.setup]) setupMap[t.setup] = { wins: 0, total: 0 };
    pairMap[t.pair].total++;   if (t.pnl > 0) pairMap[t.pair].wins++;
    setupMap[t.setup].total++; if (t.pnl > 0) setupMap[t.setup].wins++;
  });
  const byWR       = ([,a],[,b]) => (b.wins/b.total) - (a.wins/a.total);
  const bestPair   = Object.entries(pairMap).filter(([,d])=>d.total>=2).sort(byWR)[0];
  const worstPair  = Object.entries(pairMap).filter(([,d])=>d.total>=2).sort(byWR).at?.(-1);
  const bestSetup  = Object.entries(setupMap).filter(([,d])=>d.total>=2).sort(byWR)[0];

  // ── Render helpers ───────────────────────────────────────
  const pnlFmt = v => (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(0);
  function kpi(label, val, color, sub) {
    return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-val ${color}">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  }
  function barColor(pct) { return pct >= 55 ? 'green' : pct >= 40 ? 'gold' : 'red'; }
  function renderBars(map, limit) {
    return Object.entries(map).sort(([,a],[,b])=>b.total-a.total).slice(0,limit||5).map(([lbl,d])=>{
      const pct = Math.round(d.wins/d.total*100);
      const c   = barColor(pct);
      return `<div class="bar-row"><span class="bar-lbl">${lbl||'—'}</span><div class="bar-track"><div class="bar-fill ${c}" style="width:${pct}%"></div></div><span class="bar-pct ${c}">${pct}%</span></div>`;
    }).join('');
  }
  function ins(dot, html) {
    return `<div class="insight"><div class="i-dot ${dot}"></div><div class="i-text">${html}</div></div>`;
  }

  // ── Free tier: teaser ─────────────────────────────────────
  if (state.currentTier === 'free') {
    kpisEl.innerHTML = `
      ${kpi('Win Rate', (wr*100).toFixed(1)+'%', wr>=.5?'green':'red', wins.length+' of '+closed.length+' trades')}
      ${kpi('Net P&L', pnlFmt(netPnl), netPnl>=0?'green':'red', 'Closed trades')}
      ${kpi('Avg R:R', avgRR.toFixed(2), 'gold', 'Target: 1.5 '+(avgRR>=1.5?'✓':'✗'))}
      <div class="kpi-card" style="grid-column:span 3;display:flex;align-items:center;justify-content:center;gap:1rem;background:var(--bg3)">
        <div style="font-family:'Bebas Neue',sans-serif;letter-spacing:2px;color:var(--primary);font-size:.82rem">+ MORE METRICS UNLOCKED AT DEVELOPER</div>
        <button class="btn-gold" onclick="switchView('pricing',document.querySelector('[data-view=pricing]'))" style="font-size:.72rem;padding:.38rem .9rem;white-space:nowrap">Upgrade — $15/mo →</button>
      </div>
    `;
    panelsEl.innerHTML = `<div class="stats-panel" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:160px">
      <div style="text-align:center">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:.95rem;letter-spacing:3px;color:var(--muted);margin-bottom:.5rem">ANALYTICS LOCKED</div>
        <div style="font-size:.76rem;color:var(--muted);margin-bottom:1rem">Win rate by pair, setup breakdown, AI insights, Sharpe, Sortino, Max Drawdown, Monte Carlo and more.</div>
        <button class="btn-gold" onclick="switchView('pricing',document.querySelector('[data-view=pricing]'))">Upgrade to Developer — $15/mo →</button>
      </div>
    </div>`;
    return;
  }

  // ── Dev + Exec: basic KPIs ────────────────────────────────
  const pfColor = (pf === '∞' || parseFloat(pf) >= 1.5) ? 'green' : parseFloat(pf) >= 1.0 ? 'gold' : 'red';
  kpisEl.innerHTML = `
    ${kpi('Win Rate', (wr*100).toFixed(1)+'%', wr>=.5?'green':'red', wins.length+' of '+closed.length+' trades')}
    ${kpi('Net P&L', pnlFmt(netPnl), netPnl>=0?'green':'red', 'Closed trades')}
    ${kpi('Avg R:R', avgRR.toFixed(2), 'gold', 'Target: 1.5 '+(avgRR>=1.5?'✓':'✗'))}
    ${kpi('Best Pair', bestPair?bestPair[0]:'—', 'gold', bestPair?Math.round(bestPair[1].wins/bestPair[1].total*100)+'% win rate':'Need 2+ trades/pair')}
    ${kpi('Profit Factor', pf, pfColor, 'Gross win / gross loss')}
    ${kpi('Expectancy', (expectancy>=0?'+':'')+'$'+Math.abs(expectancy).toFixed(2), expectancy>=0?'green':'red', 'Avg profit per trade')}
  `;

  // ── Auto insights ─────────────────────────────────────────
  const insights = [];
  if (bestPair) {
    const [p,d] = bestPair;
    insights.push(ins('green', `<strong>Your edge is ${p}.</strong> ${Math.round(d.wins/d.total*100)}% win rate over ${d.total} trades.`));
  }
  if (worstPair && worstPair[0] !== bestPair?.[0] && Math.round(worstPair[1].wins/worstPair[1].total*100) < 45) {
    const [p,d] = worstPair;
    insights.push(ins('red', `<strong>Caution on ${p}.</strong> Only ${Math.round(d.wins/d.total*100)}% win rate — review your edge here.`));
  }
  if (pf !== '∞' && parseFloat(pf) >= 1.5) {
    insights.push(ins('blue', `<strong>Positive system edge.</strong> Profit Factor ${pf} — earning $${pf} for every $1 in losses.`));
  } else if (pf !== '∞' && parseFloat(pf) < 1.0) {
    insights.push(ins('red', `<strong>System not yet profitable.</strong> Profit Factor ${pf} — improve entry quality or widen targets.`));
  }
  if (avgRR >= 2.0) {
    insights.push(ins('green', `<strong>Excellent R:R discipline.</strong> Avg ${avgRR.toFixed(2)} — you can be right 33% of the time and still profit.`));
  } else if (avgRR < 1.0) {
    insights.push(ins('gold', `<strong>Improve your R:R ratio.</strong> Current avg ${avgRR.toFixed(2)} — target minimum 1.5R per trade.`));
  }
  if (!insights.length) insights.push(ins('blue', `<strong>Keep logging.</strong> Add more closed trades for deeper pattern analysis.`));

  // ── Dev panels ────────────────────────────────────────────
  panelsEl.innerHTML = `
    <div class="stats-panel"><div class="sp-title">WIN RATE BY PAIR</div>${renderBars(pairMap)}</div>
    <div class="stats-panel"><div class="sp-title">WIN RATE BY SETUP</div>${renderBars(setupMap)}</div>
    <div class="stats-panel ai-panel"><div class="sp-title">TRADE INSIGHTS</div>${insights.join('')}</div>
  `;

  if (state.currentTier !== 'exec') return;

  // ── Exec: institutional metrics ───────────────────────────
  const pnls    = [...closed].reverse().map(t => t.pnl);
  const meanPnl = pnls.reduce((s,v)=>s+v,0) / pnls.length;
  const stdPnl  = Math.sqrt(pnls.map(v=>(v-meanPnl)**2).reduce((s,v)=>s+v,0) / pnls.length);
  const sharpe  = stdPnl === 0 ? '—' : (meanPnl/stdPnl).toFixed(2);

  const downside    = pnls.map(v => v < 0 ? v : 0);
  const downsideStd = Math.sqrt(downside.map(v=>v**2).reduce((s,v)=>s+v,0) / pnls.length);
  const sortino     = downsideStd === 0 ? '—' : (meanPnl/downsideStd).toFixed(2);

  let eq=0, pk=0, maxDD=0;
  const equityCurve = pnls.map(p => { eq+=p; if(eq>pk) pk=eq; const dd=pk>0?(pk-eq)/pk:0; if(dd>maxDD) maxDD=dd; return eq; });
  const maxDDPct = (maxDD*100).toFixed(1);

  const kelly = (avgLoss===0||avgWin===0) ? null : wr - (1-wr)/(avgWin/avgLoss);
  const kellyDisplay     = kelly===null ? '—' : (kelly*100).toFixed(1)+'%';
  const halfKellyDisplay = kelly===null ? '—' : (kelly*50).toFixed(1)+'%';

  // Monte Carlo (10,000 sims, 20% DD = ruin)
  const SIMS=10000, RUIN=0.20;
  let ruinCount=0;
  const finalEqs=[];
  for (let i=0;i<SIMS;i++) {
    let e=0, pk2=0, ruined=false;
    for (let j=0;j<pnls.length;j++) {
      e += pnls[Math.floor(Math.random()*pnls.length)];
      if(e>pk2) pk2=e;
      if(pk2>0 && (pk2-e)/pk2>RUIN){ ruined=true; break; }
    }
    if(ruined) ruinCount++;
    else finalEqs.push(e);
  }
  finalEqs.sort((a,b)=>a-b);
  const ruinPct = (ruinCount/SIMS*100).toFixed(1);
  const p10 = finalEqs[Math.floor(finalEqs.length*.10)] ?? 0;
  const p50 = finalEqs[Math.floor(finalEqs.length*.50)] ?? 0;
  const p90 = finalEqs[Math.floor(finalEqs.length*.90)] ?? 0;

  // Equity curve sparkline (last 20 trades)
  const curve20  = equityCurve.slice(-20);
  const absMax   = Math.max(...curve20.map(Math.abs), 0.01);
  const curveBars= curve20.map((v,i)=>{
    const isUp = i===0 ? v>=0 : v>=curve20[i-1];
    const hPct = Math.max(Math.abs(v)/absMax*100, 4);
    return `<div style="flex:1;display:flex;align-items:flex-end"><div style="width:100%;height:${hPct}%;min-height:4px;border-radius:2px 2px 0 0;background:${isUp?'var(--green)':'var(--red)'};opacity:.85"></div></div>`;
  }).join('');

  // R:R distribution
  const rrBuckets={'< 1R':0,'1–2R':0,'2–3R':0,'3R+':0};
  closed.forEach(t=>{ const r=parseFloat(t.rr||0); if(r<1) rrBuckets['< 1R']++; else if(r<2) rrBuckets['1–2R']++; else if(r<3) rrBuckets['2–3R']++; else rrBuckets['3R+']++; });
  const rrBars = Object.entries(rrBuckets).map(([lbl,count])=>{
    const pct = Math.round(count/closed.length*100);
    return `<div class="bar-row"><span class="bar-lbl">${lbl}</span><div class="bar-track"><div class="bar-fill gold" style="width:${Math.max(pct,2)}%"></div></div><span class="bar-pct gold">${count} trades</span></div>`;
  }).join('');

  const sColor = s => s!=='—' ? (parseFloat(s)>=1?'green':parseFloat(s)>=0?'gold':'red') : 'red';

  if (instEl) {
    instEl.innerHTML = `<div class="stats-kpis" style="margin-bottom:1.25rem">
      ${kpi('Sharpe Ratio', sharpe, sColor(sharpe), 'Per-trade Sharpe')}
      ${kpi('Sortino Ratio', sortino, sColor(sortino), 'Downside-adjusted')}
      ${kpi('Max Drawdown', maxDDPct+'%', parseFloat(maxDDPct)<=10?'green':parseFloat(maxDDPct)<=20?'gold':'red', 'Peak-to-trough')}
      ${kpi('Kelly %', kellyDisplay, kelly!==null&&kelly>0?'green':'red', '½ Kelly: '+halfKellyDisplay)}
      ${kpi('MC Ruin Prob', ruinPct+'%', parseFloat(ruinPct)<=5?'green':parseFloat(ruinPct)<=15?'gold':'red', '20% DD threshold')}
      ${kpi('Sample Size', closed.length, 'gold', wins.length+'W / '+losses.length+'L')}
    </div>`;
  }

  panelsEl.insertAdjacentHTML('beforeend', `
    <div class="stats-panel">
      <div class="sp-title">EQUITY CURVE — LAST ${curve20.length} TRADES</div>
      <div style="display:flex;align-items:flex-end;height:80px;gap:2px;margin-bottom:.65rem">${curveBars}</div>
      <div style="font-size:.7rem;color:var(--muted);display:flex;justify-content:space-between">
        <span>Oldest →</span>
        <span style="color:${netPnl>=0?'var(--green)':'var(--red)'}">Net ${pnlFmt(netPnl)}</span>
      </div>
    </div>
    <div class="stats-panel">
      <div class="sp-title">R:R DISTRIBUTION</div>
      ${rrBars}
      <div style="margin-top:.75rem;font-size:.7rem;color:var(--muted)">Avg R:R: <strong style="color:var(--primary)">${avgRR.toFixed(2)}</strong> across ${closed.length} trades</div>
    </div>
    <div class="stats-panel">
      <div class="sp-title">MONTE CARLO — NEXT ${pnls.length} TRADES</div>
      <div style="font-size:.7rem;color:var(--muted);margin-bottom:.75rem">10,000 simulations · 20% DD = ruin</div>
      <div class="bar-row"><span class="bar-lbl">Pessimistic P10</span><div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:.75rem;color:${p10>=0?'var(--green)':'var(--red)'}">${pnlFmt(p10)}</div></div>
      <div class="bar-row"><span class="bar-lbl">Median P50</span><div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:.75rem;color:${p50>=0?'var(--green)':'var(--red)'}">${pnlFmt(p50)}</div></div>
      <div class="bar-row"><span class="bar-lbl">Optimistic P90</span><div style="flex:1;font-family:'IBM Plex Mono',monospace;font-size:.75rem;color:${p90>=0?'var(--green)':'var(--red)'}">${pnlFmt(p90)}</div></div>
      <div style="margin-top:.75rem;padding:.55rem .7rem;background:var(--bg3);border-radius:5px;font-size:.75rem">
        Ruin probability: <strong style="color:${parseFloat(ruinPct)<=5?'var(--green)':parseFloat(ruinPct)<=15?'var(--primary)':'var(--red)'}">${ruinPct}%</strong>
        <span style="color:var(--muted)"> (${ruinCount.toLocaleString()} / 10,000 runs)</span>
      </div>
    </div>
  `);
}

/* ═══════════════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════════════ */
const OB_PROFILE = { exp: 'beginner', market: 'gold', platform: 'MT5' };

const OB_STRATEGIES = {
  beginner: [
    {
      name: 'MA Crossover',
      tag: 'Classic',
      desc: 'Buy when fast moving average crosses above slow MA. Simple, reliable — great to learn from.',
      fill: 'Build a simple MA crossover EA for XAUUSD on H1. Fast MA 9 EMA, Slow MA 21 EMA. Buy on bullish cross, sell on bearish cross. Stop Loss 500 points, Take Profit 1000 points, Lot size 0.10.',
    },
    {
      name: 'RSI Reversal',
      tag: 'Beginner Friendly',
      desc: 'Buy when RSI dips below 30 and recovers. Sell when RSI spikes above 70 and drops.',
      fill: 'Build an RSI reversal EA. Buy when RSI 14 crosses above 30 from below, sell when RSI 14 crosses below 70 from above. Stop Loss 400 points, Take Profit 800 points, Lot 0.10.',
    },
  ],
  learning: [
    {
      name: 'EMA Scalper',
      tag: 'Fast Entries',
      desc: 'Fast 5 EMA crosses 13 EMA during London/NY session. Tight SL, quick TP.',
      fill: 'Build an EMA scalper EA. Buy when 5 EMA crosses above 13 EMA, sell opposite. Only trade between 08:00 and 17:00. Max 3 trades per day. Stop Loss 150 points, Take Profit 300 points.',
    },
    {
      name: 'BB Breakout',
      tag: 'Momentum',
      desc: 'Trade price breaking outside Bollinger Bands with confirmation. Catches strong moves.',
      fill: 'Build a Bollinger Bands breakout EA. Buy when price closes above upper band, sell when price closes below lower band. BB period 20, deviation 2.0. Stop Loss 600 points, Take Profit 1200 points.',
    },
  ],
  experienced: [
    {
      name: 'Multi-TF Confluence',
      tag: 'Advanced',
      desc: 'H4 trend filter with M15 entry. RSI confirmation. Prop firm stealth mode.',
      fill: 'Build a multi-timeframe EA. H4 trend filter: price must be above 200 MA on H4. M15 entry: RSI crosses above 50 for buy, below 50 for sell. Add prop firm stealth mode — hide SL and TP from broker. Risk 1% of account per trade.',
    },
    {
      name: 'S&R News Shield',
      tag: 'Institutional',
      desc: 'Support/resistance breakout with automatic news pause. Clean institutional entries.',
      fill: 'Build a support/resistance breakout EA using previous high/low breakouts. Add news filter — pause trading 30 minutes before and after high impact news. Add trailing stop. Risk 1% per trade.',
    },
  ],
};

function checkOnboarding() {
  if (localStorage.getItem('wts_onboarded')) return;
  document.getElementById('onboarding')?.classList.remove('hidden');
}

function obSelect(group, el) {
  document.querySelectorAll(`#ob-${group} .ob-opt`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  OB_PROFILE[group] = el.dataset.val;
}

function obNext(step) {
  if (step === 2) {
    localStorage.setItem('wts_profile', JSON.stringify(OB_PROFILE));
    const level = OB_PROFILE.exp === 'experienced' ? 'experienced'
                : OB_PROFILE.exp === 'learning'    ? 'learning'
                : 'beginner';
    const strats = OB_STRATEGIES[level];
    const container = document.getElementById('ob-strategies');
    if (container) {
      container.innerHTML = strats.map(s => `
        <div class="ob-strat" onclick="obFinish(this.dataset.fill)" data-fill="${s.fill.replace(/"/g, '&quot;')}">
          <div class="ob-strat-left">
            <div class="ob-strat-name">${s.name}</div>
            <div class="ob-strat-desc">${s.desc}</div>
          </div>
          <span class="ob-strat-tag">${s.tag}</span>
          <span class="ob-strat-arrow">→</span>
        </div>
      `).join('');
    }
  }

  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('obp' + i);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < step) dot.classList.add('done');
    else if (i === step) dot.classList.add('active');
  }

  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-' + step)?.classList.add('active');
}

function obFinish(prefill) {
  if (prefill) {
    sessionStorage.setItem('wts_prefill', prefill);
    sessionStorage.setItem('wts_prefill_platform', OB_PROFILE.platform);
  }
  obNext(3);
}

function obLaunchBuilder() {
  localStorage.setItem('wts_onboarded', '1');
  document.getElementById('onboarding')?.classList.add('hidden');
  window.location.href = 'builder.html';
}
