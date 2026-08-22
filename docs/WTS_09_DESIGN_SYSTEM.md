---
name: WTS Design System and Visual Experience
description: Complete design language for WorldTradeStandard. Covers the cinematic world philosophy, color system, typography with glitch effects, spacing, component patterns, page narrative rules, and the Perplexity-inspired structural discipline adapted for WTS dark aesthetic.
---

# WTS Design System & Visual Experience
## "A clean, intelligent operating system for traders living inside a cinematic world."

---

## The Core Philosophy

WTS does not look like:
- A trading dashboard
- A banking app
- A fintech landing page
- An information-heavy SaaS product

WTS looks and feels like:
**A serious tool that does not intimidate you.**

The interface sits over, within, or alongside a cinematic world.
The background image tells the emotional story.
The UI tells the user what to do.

---

## The Non-Negotiable Rule: Simplicity

Every page has:
- One clear purpose
- One primary message
- One primary action
- Minimal supporting information

**The 7-year-old test:** Can a 7-year-old understand what to do on this page?
**The trader test:** Can an experienced trader look at this page and feel the world they are becoming part of?

If both answers are yes — the design is working.

Never create:
- Cards fighting for attention
- Multiple competing CTAs
- Information dense dashboards
- Widgets stacked on widgets
- Explanations the user did not ask for

---

## Structure: Perplexity Discipline Applied to WTS

WTS borrows Perplexity's structural discipline while keeping its own dark cinematic atmosphere.

**From Perplexity — keep these principles:**
- Single accent color carries all navigational emphasis
- Content density over visual chrome
- Hairline borders (1px) not heavy borders (2px+)
- Compact spacing system (4px base unit)
- Typography hierarchy through size and color, not weight
- Ghost buttons for secondary actions
- Pill chips for mode selectors
- One barely-visible shadow across the whole system

**WTS diverges from Perplexity in:**
- Dark deep backgrounds (not warm parchment)
- Cinematic photography as background environments
- Glitch typography for major cinematic moments
- Multiple accent colors (blue + green + gold) for tier and status
- Higher contrast — white text on dark surfaces
- More dramatic spatial composition

---

## Color System

### Background Layers
```
Deep void:      #050508   Full-viewport background — the deepest layer
Card surface:   #0D0F18   Cards, panels, modals
Elevated card:  #12151F   Active/hovered card — one step above
Overlay:        rgba(5, 5, 8, 0.85)  Cinematic image overlay
```

### Accent Colors
```
Blue (primary):   #378ADD   Navigation active, primary actions, data highlights
Green (success):  #2ECC71   Profit, confirmation, live status, generate button
Gold (executive): #C9A84C   Executive tier, premium features, WTS IQ
Red (danger):     #E74C3C   Loss, kill switch, alerts, risk warnings
Purple (MT4/alt): #9B59B6   MT4 platform, secondary platform indicator
```

### Text Colors
```
White primary:    #E8EAF0   Primary text — all body content
Muted:            #6B7280   Secondary labels, inactive states, helpers
Subtle:           #4A5568   Section labels, timestamps, captions
```

### Border Colors
```
Default border:   #1E2130   Standard hairline border (1px always)
Accent border:    rgba(55, 138, 221, 0.2)   Blue glow border
Gold border:      rgba(201, 168, 76, 0.3)   Executive glow border
Green border:     rgba(46, 204, 113, 0.25)  Success state border
```

### Single Accent Rule (Perplexity-borrowed)
Within any single component, one accent color carries the active state.
Do not use blue AND green AND gold simultaneously in one component.
Each color has a domain:
- Blue = navigation, actions, information
- Green = success, profit, live, generate
- Gold = premium, executive, achievement
- Red = danger, loss, risk

---

## Typography

### Font Stack
```
Display:    'Bebas Neue', sans-serif        — Hero titles, cinematic moments
Body:       'Outfit', sans-serif            — All UI text
Mono:       'IBM Plex Mono', monospace      — Code, numbers, data
```

### Type Scale
```
Hero:       48-72px  Bebas Neue  — Cinematic page titles with glitch
Title:      24-32px  Outfit 600  — Section headings
Subtitle:   18-20px  Outfit 500  — Card headings
Body-lg:    16px     Outfit 400  — Primary body text
Body:       14px     Outfit 400  — UI labels, descriptions
Body-sm:    12px     Outfit 500  — Badges, chips, micro labels
Caption:    11px     Outfit 500  — Timestamps, helper text
Mono:       13-14px  IBM Plex Mono — Numbers, code, stats
```

### Glitch Typography Rules

Use glitch on: major page titles, cinematic sections, powerful statements
Never use glitch on: body text, labels, buttons, form fields

Glitch implementation:
```css
.glitch-text {
  position: relative;
  color: #E8EAF0;
}
.glitch-text::before {
  content: attr(data-text);
  position: absolute;
  left: -2px;
  color: #00FFFF;
  opacity: 0.7;
  clip-path: polygon(0 0, 100% 0, 100% 33%, 0 33%);
}
.glitch-text::after {
  content: attr(data-text);
  position: absolute;
  left: 2px;
  color: #FF00FF;
  opacity: 0.7;
  clip-path: polygon(0 66%, 100% 66%, 100% 100%, 0 100%);
}
```

---

## Spacing System

Base unit: 4px (Perplexity-borrowed discipline)

```
4px   — tight element gap
8px   — standard element gap
12px  — compact card padding
16px  — standard card padding
24px  — section internal spacing
32px  — section gap
48px  — major section gap
64px  — cinematic vertical breathing room
```

---

## Border Radius

```
Buttons (ghost):   6px     — low emphasis actions
Inputs:            10px    — form fields
Cards:             12px    — standard cards
Large cards:       16px    — feature cards, modals
Chips/pills:       9999px  — mode selectors, tags, badges
```

---

## Elevation & Shadows

One shadow rule — only one shadow exists in the system:
```css
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.4);
```

Everything else uses background color contrast and hairline borders.
No floating panels. No stacked drop shadows.
Components sit on the dark canvas like instruments on a console — not floating.

---

## Component Patterns

### Nav Item (Active State)
```
Background:   rgba(55, 138, 221, 0.12)
Border-left:  2px solid #378ADD
Text:         #E8EAF0
Icon:         #378ADD
Radius:       8px
```

### Nav Item (Inactive State)
```
Background:   transparent
Text:         #6B7280
Icon:         #6B7280
Hover text:   #E8EAF0
```

### Primary Button (Generate / Connect)
```
Background:   linear-gradient(135deg, #378ADD, #2ECC71)
Text:         #ffffff
Radius:       8px
Padding:      12px 24px
Weight:       700
```

### Ghost Button
```
Background:   transparent
Border:       1px solid #1E2130
Text:         #6B7280
Radius:       6px
Hover border: rgba(55, 138, 221, 0.3)
Hover text:   #378ADD
```

### Card (Standard)
```
Background:   #0D0F18
Border:       1px solid #1E2130
Radius:       12px
Padding:      16px
Shadow:       0 2px 8px rgba(0,0,0,0.4)
```

### Card (Accent — Blue)
```
Background:   #0D0F18
Border-left:  3px solid #378ADD
Border:       1px solid rgba(55,138,221,0.15)
Radius:       12px
```

### Card (Accent — Gold / Executive)
```
Background:   linear-gradient(135deg, rgba(201,168,76,0.08), rgba(13,15,24,0.9))
Border:       1px solid rgba(201,168,76,0.3)
Radius:       12px
```

### Input Field
```
Background:   #12151F
Border:       1px solid #1E2130
Radius:       10px
Padding:      12px 14px
Text:         #E8EAF0
Placeholder:  #6B7280
Focus border: #378ADD
Font:         Outfit 14px
```

### Pill Chip (Mode selector)
```
Default:      background transparent, border 1px solid #1E2130, text #6B7280
Active:       background rgba(55,138,221,0.15), border rgba(55,138,221,0.4), text #378ADD
Radius:       9999px
Padding:      5px 14px
Font:         12px weight 600
```

### Badge
```
Executive:    background rgba(201,168,76,0.15), border rgba(201,168,76,0.4), text #C9A84C
Live:         background rgba(46,204,113,0.15), border rgba(46,204,113,0.3), text #2ECC71
Admin:        background rgba(255,193,7,0.15), border rgba(255,193,7,0.4), text #FFC107
Radius:       9999px
Font:         11px weight 700 letter-spacing 1.5px
```

---

## Cinematic World System

### The Visual Worlds of WTS

Each page has a cinematic environment. The image is not decoration.
It tells the emotional story. The UI tells the user what to do.

**Golf** — Use for: precision, execution, discipline, decision quality
Message: "Quality over quantity. Know when to take the shot."

**Tennis** — Use for: market positioning, execution timing, reading movement
Message: "Timing, positioning, anticipation."

**Art Museums / Sophisticated Spaces** — Use for: strategy, analysis, observation
Message: "The ability to see value before others do."

**Ocean / Ships** — Use for: risk, navigation, market scale, preparation
Message: "The market is an ocean. Learn to navigate it."

**Bulls / Market Entry** — Use for: broker connection, market entry
Message: "You are entering the market."

**Trading Communities / Real People** — Use for: social, coaching, community
Message: "WTS is alive. You are not alone."

**High-Rise / Financial Districts** — Use for: scale, technology, global markets
Message: "You are entering a serious financial ecosystem."

### Cinematic Page Formula

```
Full-screen background image (cinematic environment)
        +
Dark gradient overlay (rgba(5,5,8,0.75) — preserves image, enables text readability)
        +
Centered or left-aligned content block (max-width 480px for forms)
        +
One glitch headline (Bebas Neue, 48-64px)
        +
One supporting line (Outfit 18px, #E8EAF0, weight 400)
        +
One primary action
```

### The "Enter The Market" Pattern (Reference Implementation)

This is the gold standard page. Study it:
- Full-screen cinematic bull herd in purple/violet atmosphere
- Glitch headline: "ENTER THE MARKET" — large, dominant, chromatic offset
- Subtitle: "Connect your broker to begin" — clean, readable, no glitch
- Three simple inputs: broker, account number, password
- One CTA: "CONNECT →" — full width, purple gradient
- One secondary link: "+ CONNECT ANOTHER ACCOUNT" — muted, below
- Nothing else on the page

This is the WTS standard. Replicate this formula for every major action page.

---

## Page Narrative Rules

Before designing any page answer all four:

1. **What does the user see?** (the image/environment)
2. **What does it make them feel?** (the emotion)
3. **What does that feeling represent?** (the narrative)
4. **What is the user's next action?** (the one primary action)

### Narrative Examples

**Broker Connection page:**
- Image: Bull herd charging through purple mist
- Feeling: Entering something powerful and alive
- Narrative: "You are no longer outside the market"
- Action: CONNECT

**Risk / Drawdown Warning page:**
- Image: Ship on stormy ocean
- Feeling: The environment is powerful. Preparation matters.
- Narrative: "The market is an ocean. Navigate with discipline."
- Action: REVIEW MY RISK SETTINGS

**Community / Social page:**
- Image: Traders working together around screens
- Feeling: Alive, collaborative, serious
- Narrative: "Trading was never meant to be done alone"
- Action: EXPLORE THE COMMUNITY

**Strategy Builder page:**
- Image: Golf course at dawn, single player on the green
- Feeling: Calm, precise, one clear shot
- Narrative: "Build with precision. Execute with patience."
- Action: DESCRIBE YOUR STRATEGY

---

## What WTS Never Does

- Never exposes internal complexity (no "VPS provisioning", "server deployment", "infrastructure")
- Never fills a page with cards, charts, metrics, and widgets simultaneously
- Never uses more than one primary CTA per page
- Never uses photography as decoration — every image has a narrative purpose
- Never glitches body text or UI labels
- Never creates a page that could belong to any generic fintech app
- Never makes the user feel like they are looking at a broker interface
- Never prioritizes looking impressive over being clear

---

## The Final Test (Apply to Every Page)

1. Can the user understand this page within 5 seconds?
2. Is the primary action obvious?
3. Can anything be removed?
4. Is there more than one competing action?
5. Does the environment communicate something meaningful?
6. Is the photograph telling a story?
7. Does the page feel alive?
8. Does it feel premium without being flashy?
9. Does it feel like WTS — not a generic fintech app?

If every answer is satisfactory — ship it.
If one answer fails — redesign before building.
