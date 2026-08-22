# WTS AI Trading Companion
## The Relationship Is The Product

---

## What The Companion Is

The AI Trading Companion is not a chatbot.
It is not a helpdesk.
It is not a search bar.

It is a living assistant that persists across the entire app.
It grows with the trader. It learns their patterns.
It speaks when something matters — not when prompted.

---

## What The Companion Remembers

The companion maintains a persistent user model:

```javascript
companion_memory: {
  goals:              ["Pass FTMO 100K", "Master Gold scalping"],
  favorite_markets:   ["XAUUSD", "US30", "EURUSD"],
  risk_tolerance:     "moderate",  // conservative / moderate / aggressive
  active_robots:      ["WTS_XAUUSD_Breakout_v2", "WTS_US30_Trend"],
  active_missions:    ["Gold London Watch", "DXY Correlation Monitor"],
  trade_history:      [...],       // last 90 days
  common_mistakes:    ["overtrading Fridays", "ignoring news windows"],
  watched_levels:     ["XAUUSD 2347.50 support", "US30 40200 resistance"],
  timezone:           "Africa/Lagos",
  session_preference: "London",
  performance_trend:  "improving",  // declining / stable / improving
  last_conversation:  "2025-08-20"
}
```

---

## How The Companion Speaks

The companion speaks proactively. It does not wait to be asked.

**Market monitoring:**
> "Markson, Gold just entered the order block you asked me to watch yesterday at 2,334. 
>  London session opens in 22 minutes. Do you want me to activate the mission?"

**Robot performance:**
> "Your EURUSD robot has underperformed for three consecutive weeks — 
>  win rate dropped from 67% to 41%. Would you like me to run a diagnosis?"

**Opportunity detection:**
> "I found three creators whose robots outperform yours on NASDAQ. 
>  Would you like to compare their strategies?"

**Risk protection:**
> "You have four open trades. Combined exposure is 8.4% of your account. 
>  Your usual maximum is 5%. Would you like to close the oldest position?"

**Learning moments:**
> "You closed this trade 4 pips early. If held to your original TP, 
>  this would have been +2.8R instead of +1.1R. 
>  This is the third time this week. Want to discuss it?"

**Pre-session briefing:**
> "Good morning. London opens in 45 minutes. 
>  Gold is trading near yesterday's high. 
>  You have two active missions. CPI data releases at 13:30 WAT. 
>  Your best days are Tuesdays — win rate 74%. Ready?"

---

## Companion Tone

The companion speaks like a trusted professional, not a bot.

**Not this:**
> "I have detected that your trade performance metrics indicate suboptimal execution patterns."

**This:**
> "You keep closing early. Let's talk about that."

**Not this:**
> "Would you like to receive a notification when XAUUSD reaches your specified price level?"

**This:**
> "Gold is close to that level you mentioned. Want me to watch it?"

---

## Companion Access Points

The companion is accessible everywhere in the app:

- **Persistent input bar** at the bottom of every screen
- **Morning Brief** — companion-generated daily summary
- **Proactive notifications** — companion-initiated, not user-prompted
- **Post-trade analysis** — automatic after every closed trade
- **Mission builder** — companion helps configure missions via conversation
- **EA generator** — companion remembers previous builds and preferences

---

## Companion Privacy Levels

Users control how much the companion knows:

| Level | What companion accesses |
|-------|------------------------|
| Basic | Only current session |
| Standard | 30-day history + goals |
| Full | Complete history + all data |
| Anonymous | No memory — fresh each session |

---

## Companion Intent Classification

When the user speaks to the companion:

```
"Watch Gold and tell me when it breaks yesterday's high"
        ↓
Intent: market_monitor
Action: create_mission
Parameters: {
  pair: XAUUSD,
  condition: "price > yesterday_high",
  notification: true
}
Cost: Class A (no AI needed after setup)
```

```
"Why is the dollar dropping?"
        ↓
Intent: market_education
Action: explain + current_context
Parameters: { topic: DXY_weakness, timeframe: current }
Cost: Class C (conversational AI)
```

```
"Build me a Gold scalper that avoids news"
        ↓
Intent: robot_generation
Action: launch_builder with context
Parameters: {
  pair: XAUUSD,
  style: scalper,
  filter: news_avoidance,
  user_history: [previous Gold robots]
}
Cost: Class E (code generation)
```

---

## The Defining Metric

The companion is successful when:

A trader opens WTS and says "let me check what my assistant found"
instead of "let me check the charts."

When the relationship between trader and companion
becomes more valuable than any individual feature —
WTS has won.
