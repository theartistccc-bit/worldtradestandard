# WTS Mission Engine Architecture
## Intelligence That Acts While You Sleep

---

## What A Mission Is

A Mission is a named, automated market monitoring and execution task.

It is not an EA. It is not an alert. It is an intent made permanent.

**User says:** "Watch Gold and buy when it breaks yesterday's high"
**Mission created:** London Breakout — XAUUSD — BUY trigger at $2,347.50

The mission runs 24/7 on the user's VPS until:
- It triggers and executes
- The user pauses or cancels it
- The market condition expires

---

## Mission Types

**Monitor Mission**
Watch a condition. Notify when triggered. No automatic execution.
Example: "Alert me when DXY breaks below 102.00"

**Execute Mission**
Watch a condition. Execute automatically when triggered.
Example: "Buy XAUUSD when RSI crosses 30 on H1"

**Guard Mission**
Watch account health. Protect automatically.
Example: "Close all trades if daily loss exceeds 3%"

**Study Mission**
Watch a pattern. Record every occurrence for analysis.
Example: "Record every time XAUUSD forms a BOS on H4"

---

## Mission Anatomy

```javascript
mission: {
  id:          "mission_xau_london_001",
  name:        "Gold London Breakout",
  user_uid:    "...",
  type:        "execute",
  pair:        "XAUUSD",
  timeframe:   "H1",
  
  trigger: {
    condition:   "price_break",
    level:       "yesterday_high",
    direction:   "bullish",
    confirmation: "candle_close"
  },
  
  execution: {
    action:      "BUY",
    lot_size:    "1_percent_risk",
    stop_loss:   "30_pips",
    take_profit: "60_pips",
    max_slippage: 3
  },
  
  filters: {
    news_blackout:     true,   // pause 30 mins around news
    trading_hours:     "07:00-12:00",  // London session only
    max_spread:        2.5,
    prop_firm_rules:   true    // respect active prop firm rules
  },
  
  status:      "active",
  created_at:  "...",
  triggered_at: null,
  result:      null
}
```

---

## Mission Cost Structure

| Mission Type | Cost model |
|-------------|------------|
| Monitor (notify only) | Free — included in subscription |
| Execute (single trigger) | 5 credits |
| Execute (recurring) | 20 credits/month |
| Guard (always on) | Included with paid VPS |
| Study (data collection) | Free |

---

## Mission Feed Post (Auto-generated)

When a mission completes, it auto-posts to the Nexus:

```
MISSION COMPLETED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gold London Breakout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trigger:    BOS confirmed — XAUUSD H1 at 08:02 WAT
Entry:      BUY 0.10 @ 2,347.50
Exit:       2,365.80 (TP hit — 4h 23m hold)
Result:     +18.3 pips | +4.7% | +2.3R
Prop firm:  All rules respected ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verified by WTS Oracle ✓
```

The user never writes this. It generates automatically.

---

## Missions Marketplace

Users sell complete missions, not just robots.

**Mission listing:**
```
NFP Gold Hunter
━━━━━━━━━━━━━━━━━━━━━━━━
Creator:      @AlphaNode | WTS IQ: 8,742
Live history: 34 NFP events | Win rate: 71%
Avg result:   +3.4R per event
Strategy:     Waits for initial spike reversal
Pairs:        XAUUSD
Trigger:      Auto-detected from economic calendar
Price:        50 Credits (one-time install)

Reviews: ★★★★★ (127 reviews)
━━━━━━━━━━━━━━━━━━━━━━━━
[Install Mission] [View All 34 Results] [Preview Logic]
```

One click installs the mission to the buyer's account.
Revenue split: 80% creator, 20% WTS.

---

## Mission Engine Technical Stack

```
Economic Calendar API
        ↓
Mission Condition Checker (runs every 30s on backend)
        ↓
Condition met? → No → Continue monitoring
                Yes → Execute via VPS Agent
                       ↓
                  WTS Nexus EA on MT5
                       ↓
                  Trade executed
                       ↓
                  Result posted to Firestore
                       ↓
                  Auto-post to Nexus feed
                       ↓
                  Companion notifies user
```

---

## Mission Builder (Conversation Interface)

User talks to companion. Companion builds the mission.

**User:** "Watch Gold this week and buy every time it bounces off the 50 EMA on H1"

**Companion:**
> "I'll set that up. A few quick questions:
> - How much risk per trade? (your usual is 1%)
> - Stop loss: below the bounce candle or fixed pips?
> - Should I pause this around CPI on Wednesday?
> - Any time restrictions — London only or 24 hours?"

**User:** "1% risk, below the candle, yes pause for CPI, London only"

**Companion:** "Done. Mission is live — 'Gold 50 EMA London.' 
I'll notify you when it triggers."

This is the standard. No forms. No dropdowns. Just conversation.
