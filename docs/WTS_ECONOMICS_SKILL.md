# WTS Platform Economics & Cost Architecture
## Version 1.0 — Engineering Reference

This document governs every feature decision at WorldTradeStandard.
Before building anything, engineers must answer the questions in Chapter 18.

---

## Core Philosophy

**Maximize: Value Delivered ÷ Cost Incurred**

Not every request should hit an expensive LLM.
Not every question needs a new AI response.
Not every feature needs to be free.

---

## AI Cost Classes

Every request gets classified before execution:

| Class | Type | Examples | Model |
|-------|------|----------|-------|
| A | No AI | Dashboard, view robot, portfolio | Database only — ~$0 |
| B | Light AI | Intent classification, routing | Gemini Flash |
| C | Conversational | Assistant questions, explain concepts | Mid-tier model |
| D | Deep Reasoning | Strategy review, risk evaluation | Premium reasoning |
| E | Heavy Generation | Generate MQL5, Monte Carlo, optimization | Premium coding model |

---

## AI Routing Rule

```
User Request
      ↓
Intent Classifier (Class A-B)
      ↓
Can another service answer?
  YES → Mission Engine / Forge / Oracle / Database
  NO  → Cheapest suitable model for the task
```

**Never send a request directly to the most expensive model.**
**Never use a premium model for a task a cheaper one can handle.**

---

## Model Selection by Task

| Task | Model to use |
|------|-------------|
| Intent classification | Lightweight classifier or Gemini Flash |
| General assistant conversation | Cost-effective conversational model |
| MQL5 code generation | Strong coding model (Claude Sonnet) |
| Quantitative reasoning | High-capability reasoning model |
| Explanation / education | Gemini Flash |
| Debugging | Strong coding model |

---

## Credit Economy

Credits are the universal in-app resource.

**Pricing example:** 100 Credits = $1

**Credit-consuming actions:**
- Robot generation
- Backtest execution
- Mission monitoring (per active mission)
- Quant Coach session
- Voice conversation
- Portfolio review
- Monte Carlo optimization

**Credit-earning actions:**
- Daily login reward
- Learning completion
- Community contributions
- Referral bonuses
- Creator revenue share

---

## Caching Rules

**Never pay twice for the same work.**

Cache aggressively:
- Common explanations (what is RSI, what is drawdown)
- News summaries (same news, 1000 users = 1 API call)
- Research embeddings
- Robot templates
- Backtest results where parameters match exactly

---

## Feature Cost Recovery Formula

```
Revenue > Infrastructure + AI + Compute + Support + Margin
```

If a feature cannot pass this test, either:
1. Reprice it
2. Route to a cheaper model
3. Cache more aggressively
4. Move it behind credits

---

## Compute Budgets (Maximum Execution Time)

| Operation | Budget |
|-----------|--------|
| Intent classification | < 100ms |
| Assistant response | < 2 seconds |
| Robot generation | < 30 seconds |
| Backtest | < 2 minutes |
| Optimization | Variable — credit-based |

---

## Engineering Checklist (Before Building Any Feature)

Answer all six questions before writing code:

1. **Can this be done without AI?** If yes, do it without AI.
2. **Can a cheaper model do it?** Use the cheapest suitable model.
3. **Can we reuse a cached result?** Check cache before any API call.
4. **Can we delay processing to a background job?** Don't block the user.
5. **Does this feature create enough value to justify its cost?** Quantify it.
6. **Should this be free, subscription-based, or credit-based?** Decide before building.

---

## Revenue Streams (Priority Order)

1. Subscriptions ($25/mo Developer, $79/mo Executive)
2. Credit purchases (à la carte)
3. Marketplace commissions (80/20 split)
4. Optimization Compute credits (WTS Compute)
5. Premium AI Coaches
6. Enterprise (future)

No single stream should dominate. Diversification protects the business.

---

## Internal Metrics to Track

- AI cost per request
- Compute cost per request
- Revenue per user per month
- Credits spent vs credits earned
- Gross margin per feature
- Cache hit rate
- Average response time

---

## Cost Alerts — Trigger When:

- AI spend exceeds monthly budget
- Cache hit rate drops below 40%
- Compute queue grows beyond 30 seconds
- Credit abuse pattern detected
- Failed requests exceed 1% of total

---

## WTS Infrastructure Cost Reference (Early Stage, 500-2000 users)

| Service | Monthly Cost |
|---------|-------------|
| Render (backend) | $25-100 |
| Firebase | $50-200 |
| AI inference (all models) | $50-300 |
| Hetzner VPS fleet | ~$4/user/month |
| Email (Resend) | $0-50 |
| Domain | ~$2 |
| Total (excl. VPS) | ~$150-650 |

**VPS cost is passed to users** — $25/month charge covers ~$4/month Hetzner cost.
**AI inference is the largest variable cost** — routing strategy directly controls this.

---

## Hidden Costs to Budget For

- Apple Developer Program: $99/year
- Google Play Console: $25 one-time
- Payment processor fees: ~2-3% per transaction
- Legal (privacy policy, ToS, NDPR compliance): $500-2000 one-time
- Accounting and taxes as revenue grows

---

## The Rule

**Build cheap. Cache aggressively. Route intelligently. Charge fairly.**

