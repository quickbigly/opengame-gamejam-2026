# Snowbound Signal: Design Doc

**Status:** draft v2.

**Changes since v1:**
- Parts and tools are free and always with you. There's no Van screen, no packing, no slot limit and no parts budget. You drive to a house and fix it.
- Coins are earned from tips and only buy permanent upgrades between nights. The Roof Rack upgrade is gone, since it only added van slots.

**Jam:** OpenGame Game Jam 2026. The deadline is **Dec 18**. The rules are in [jam-rules.md](jam-rules.md).

**Related docs:** [fault-library.md](fault-library.md) has the puzzle content.

---

## 1. Pitch

It's the night before Pinecrest Hollow's winter festival broadcast, and a blizzard has snowed in the town. You're the only person who knows how to fix TVs and gadgets.

Over three snowy nights, neighbors call with problems like "the TV says No Signal," "the sound bar won't work" or "the internet dies at 9." You plan your route through half-plowed streets and untangle each living room's hookups before the clock hits midnight.

**Fix things in the right order and the tips get bigger. Fix the town hall's screen on Night 3 and the festival goes live.**

## 2. Pillars

1. **Cozy, never stressful.** The clock creates planning pressure, but failure only costs tips. Players are never blocked. Warm lights, snow and kind neighbors.
2. **Anyone can read the problem.** There's no jargon. The colored lines in the Hookup View show what's wrong (see the "No Jargon" rule in the fault library).
3. **Order matters, and it pays.** Every fix and every route through town has a best order. The game shows its math so optimizers can plan in spreadsheets, while casual players can ignore it.
4. **Real problems, made friendly.** Every fault comes from a real-world problem. That authenticity is our edge over other entries.

## 3. Jam Constraints Checklist

- [ ] It plays in a desktop browser with mouse and keyboard, and nothing to install.
- [ ] It's a new project. All code and assets are made during the jam, and we keep a clean git history.
- [ ] It's a complete game with a beginning (tutorial), a middle (3 nights) and an end (the festival broadcast and credits).
- [ ] It's one primary genre. We pick it when we read `opengame jams --json`. See §13.
- [ ] It passes `opengame check --build`.
- [ ] Sponsor tools add to the game. ElevenLabs voices the callers, fal makes the art (and music if it supports it), Meshy is optional. See §10.

## 4. Core Loop

```
┌─ NIGHT START (6:00 PM) ───────────────────────────────────────┐
│ 1. Dispatch Board: read the calls (symptom, neighbor, deadline,│
│    pay)                                                        │
│ 2. Town Map: choose the next house. Travel costs time, and     │
│    snow matters.                                               │
│ 3. House: solve the fault in the Hookup View → payout. Your    │
│    full kit is always with you; nothing to prepare.            │
│    (repeat steps 2 and 3; new calls can arrive mid-night)      │
│ 4. MIDNIGHT: Night Report (earnings, Par comparison, stars)    │
└─ BETWEEN NIGHTS: Shop (buy permanent upgrades) ───────────────┘
```

**Session length:** about 15 minutes per night and **about 45 to 60 minutes per run.** That's long enough to feel complete and short enough for judges to finish.

## 5. Screens

| Screen | What it does |
| --- | --- |
| **Title** | New game, continue, settings, credits. Snowfall over the town at night. |
| **Dispatch Board** | A cork board of call cards. Each card shows the neighbor's portrait, a quote, a deadline, the base pay and a ★ difficulty. Click a card to hear the voiced call. |
| **Town Map** | Top-down cozy town. Roads have snow levels, the snowplow's route and times are visible, and a clock is shown. Click a house to drive there. |
| **House: Hookup View** | The puzzle screen. See §6. |
| **Night Report** | The payout breakdown per job, total vs. **Par**, stars and Tip Cards earned. |
| **Shop** | Buy permanent upgrades with the night's tips. |
| **Notebook** (overlay, `Tab`) | Tip Cards, neighbor notes and the formulas from §7, shown in-game. |
| **Ending** | The festival broadcast plays on the town hall screen, the neighbors gather, credits. |

## 6. The Hookup View (Puzzle Screen)

A cozy living room drawn behind a clean **diagram layer**.

### The Diagram

- **Devices** are cards: TV, Sound Bar, Cable Box, Wi-Fi Box and so on. Each has labeled **sockets** with icons, such as the sound socket with its speaker icon and the ✓ badge for handshake support.
- **Signal lines** connect the sockets. Their color shows what they carry, and their style shows their state:

| Style | Meaning |
| --- | --- |
| Solid | Working |
| Faded or dotted | Weak or wireless |
| Flickering | Unstable |
| Red ✗ | Failed |
| Wavy red loop | Hum |

### Player Actions

Every action costs **game minutes**:

| Action | Cost | How |
| --- | --- | --- |
| Inspect a device or line | 1 min | Hover for free; click to reveal hidden details |
| Move or unplug a cable | 2 min | Drag a cable end to a socket |
| Turn a device on or off | 1 min | Click its power button |
| Change a setting | 1 min | A small menu with 3 to 5 options |
| Install a part from your kit | 3 min | Drag from the toolbox tray |
| Wait | As the fault says | `Space` |
| Ask the neighbor | 2 min | Dialogue with 2 to 3 choices; can reveal clues |
| Undo the last action | Full cost again | Never free |

- **Done:** when the goal is met, the lines glow, the neighbor reacts and the payout pops up.
- **No dead ends:** if the player is stuck for 2 or more real minutes, the **"Call a Friend"** hint button appears. It costs 50% of the tip.

### Order Detection

Each fault is data (see §11). The engine tracks every action and classifies it:

| Class | Meaning | Effect |
| --- | --- | --- |
| **Optimal** | Part of the par solution | None |
| **Wasted** | Harmless but unneeded | Costs time and breaks a clean fix |
| **Harmful** | Triggers a side effect, such as the hot-water ice or turning off auto-control on the TV | Adds a new sub-fault, or reduces the result |

## 7. Economy and Scoring

These formulas are shown in the Notebook.

### Time

- Each night runs from **6:00 PM to 12:00 AM**, which is 360 game minutes. The clock only moves when the player acts or travels.
- **Travel time** = road segment base (5 to 15 min) × snow factor:

| Road state | Factor |
| --- | --- |
| Plowed | ×1.0 |
| Snowy | ×1.5 |
| Deep snow | ×2.5 |
| Blocked | Impassable |

- The snowplow follows a visible schedule (for example, Main St at 7:30 and Elm St at 9:00). Waiting for it can beat driving through deep snow.

### Payout per Job

```
Payout = Base × CleanMult × (1 + OnTimeBonus) × (1 + Streak) + BonusFix
```

| Term | Value |
| --- | --- |
| Base | Tier 1: 20 · Tier 2: 35 · Tier 3: 50 · Tier 4: 80 |
| CleanMult | 1.5 for a clean fix (no wasted or harmful actions) · 1.0 for 1 to 2 wasted actions · 0.8 otherwise · ×0.5 if a hint was used |
| OnTimeBonus | Up to +0.5: `0.5 × (minutes before the deadline ÷ deadline window)`, or 0 if late (late jobs still pay) |
| Streak | +0.1 per consecutive clean fix, up to +0.5; resets on a non-clean fix |
| BonusFix | A flat 10 to 25 for the optional "do the right thing" fix in the fault |

### Rating

- **Night stars:** ★ for finishing every job, ★ for at least 70% of Par, ★ for at least 95% of Par.
- **Par** is the best possible night score: every fix clean and on par, the best route, order and bonus choices, with the player's upgrades. The solver (`src/engine/solver.ts`) runs in the game for the Night Report, in the tests as a balance check, and in `npm run par` as a balance report.
- **Run score:** every tip earned over the run (spending in the shop doesn't lower it), plus a **festival bonus of 150** if the finale is fixed before midnight on Night 3. It's saved locally as a personal best.

## 8. Town, Route and Callbacks

- **Size:** about 12 houses plus the town hall, connected by roads in a small graph of about 16 edges.
- **Calls per night:** Night 1 has 6 calls, Night 2 has 7 and Night 3 has 6 plus the finale. **About 4 calls are known at 6 PM,** and the rest arrive at set times. The schedule is the same every run, so routes can be planned.
- **Callbacks:** some fixes have a preventive bonus, such as the Dish Cover (#5) or the Surge Protector (#15). Skipping it means that neighbor calls back on Night 3 and takes time away from the finale. **Spending the extra minutes early pays off later.**
  - #12 calls back too if you "fix" it by turning off the TV's Auto-control (the Sound Bar goes quiet). That callback is its own small fault, "The Sound Bar Went Quiet."
  - **Callbacks are free:** you fix your own leftovers and earn no tip, but they count toward "every call answered" and the clean streak. A callback never calls back again.
- **Schedule:**

| Night | Known at 6 PM | Later | Callbacks |
| --- | --- | --- | --- |
| 1 | #1, #2, #3, #6 | #4 (7:15), #5 (8:15) | |
| 2 | #7, #15, #12, #8 | #9 (7:00), #10 (8:00), #11 (9:05) | |
| 3 | #20 (finale), #13, #16, #14 | #17 (7:00), #18 (8:00), #19 (8:30) | #5 (6:30), #12 (7:00), #15 (7:30) |

- **Weather:** each night has its own plow and snowfall schedule. Night 2 starts with fresh snow on the north side; Night 3 is a blizzard where every road starts worse and the plows keep the way to Town Hall open.
- **Shared fixes:** the Wi-Fi Box faults (#7 and #14) and the sound socket faults (#6, #9 and #12) teach the same Tip Card. Doing the easier one first makes the harder one faster, because a Tip Card can be unlocked into a one-click "Tech Instinct" action.

## 9. Kit and Upgrades

### Parts

Your kit always has every part and tool, in any quantity. There's no packing, buying or restocking: you drive to a house and fix it with what you need. Some houses also lend you an item of their own (for example hot water or a kitchen broom at #5), which only works at that house.

The toolbox shows the whole kit at every house, so it never gives away which part a fault needs. Using the wrong part is a wasted action, like any other.

| Item | Used in |
| --- | --- |
| Remote Booster | #2 |
| Dish Cover | #5 bonus |
| Hum Stopper | #8 |
| Setup Mic | #13 |
| Extension Cable | #14 |
| Surge Protector | #15 bonus |
| Fast Cable | #18 |
| Soft Broom | #5 |

### Upgrades

Upgrades are permanent and bought between nights.

| Upgrade | Cost | Effect |
| --- | --- | --- |
| Snow Tires | 60 | Snow factor −0.5 (deep snow becomes ×2.0) |
| Signal Lens | 50 | Line details visible without inspecting |
| Thermos | 40 | +30 minutes per night |
| Friendly Face | 45 | Ask the neighbor costs 0 min |

## 10. Art, Audio and Tone

- **Art style:** warm 2D illustration, with deep blue nights, amber window light, soft snow, and flat, readable device icons. Everything is generated with **fal** from a fixed style prompt sheet, so it stays consistent. Prompts and seeds are saved in `assets/prompts/`.
- **Portraits:** 12 to 15 neighbors, each with 2 expressions (worried and happy).
- **Voices:** every call is voiced with **ElevenLabs**: one voice per neighbor, plus short reaction barks for thanks and laughs. This is our "best use" case, and the voices are the biggest charm multiplier.
- **Music:** one calm lo-fi winter loop for the map and a cozy indoor loop for houses. They're generated with fal or ElevenLabs if the license allows; otherwise we use a CC0 track.
- **Sound effects:** cable clicks, power-on chimes, the snowplow, the van door, the success jingle.
- **Meshy (optional):** a 3D-rendered van or town hall turned into 2D sprites. We only do this if there's time.
- **Writing:** short, warm and a bit funny. Each neighbor has one quirk, such as Grandma Rosa renaming inputs or the teen who blames the router.

## 11. Tech

### Stack

- **TypeScript + Vite + React**, with diagrams in **SVG**. The game is mostly UI, wiring diagrams and menus, and DOM plus SVG gives crisp, accessible, easy-to-polish visuals faster than a canvas engine.
- **Effects:** a canvas overlay for snow particles, and CSS for transitions.
- **Audio:** Howler.js.
- **State:** a single game store with plain reducers, so every action is replayable. The same code runs the Par solver and the tests.
- **Save:** localStorage, wrapped in try/catch. It's a convenience only, so the game works without it.
- **Output:** a static build to `dist/`. There's no backend.

### Fault Data Model

This is a sketch:

```ts
type Fault = {
  id: string; tier: 1|2|3|4; title: string; caller: NeighborId;
  call: { text: string; voice: string };
  setup: RoomState;                 // devices, sockets, cables, settings, power
  goal: (s: RoomState) => boolean;  // e.g. sound line reaches Sound Bar
  optimal: ActionPattern[];         // par sequence (for clean-fix + solver)
  harmful: { when: ActionPattern; effect: SideEffect }[];
  gates: { option: string; requires: (s: RoomState) => boolean }[]; // menu options that appear only after prerequisites
  bonus?: { action: ActionPattern; reward: number; preventsCallback?: string };
  tipCard: string;
};
```

### Repo Layout

```
src/
  engine/   # room state, actions, rules, scoring (pure TS, unit-tested)
  content/  # faults/*.ts, neighbors.ts, town.ts, nights.ts
  ui/       # React screens + SVG hookup view
  audio/
assets/     # generated art/audio + prompts/
tools/      # par-solver.ts, asset scripts
docs/
```

### Tests

- Every fault's optimal sequence must solve its own fault.
- Each harmful action must trigger its side effect.
- The Par solver runs in CI as a balance check.

## 12. Controls

The game can be played entirely with the mouse. The keyboard adds shortcuts:

| Key | Action |
| --- | --- |
| `Space` | Wait |
| `Tab` | Notebook |
| `Z` | Undo |
| `1` to `8` | Toolbox items |
| `M` | Map |
| `Esc` | Pause and settings |

**Settings:** volume sliders, text speed, subtitles always on, colorblind-safe line patterns (dashes and icons, not just color), and reduced motion.

## 13. Genre Choice

The candidates are **Simulation & Management** (route and time planning) or **Puzzle & Casual** (the Hookup View).

My current lean is Simulation & Management, because it's probably less crowded and the planning layer is our depth. We'll confirm it against the official track list from `opengame jams global-ai-game-jam-2026 --json` before we deploy.

## 14. Milestones

The only fixed date is the jam deadline, **Dec 18**. Milestones run in order.

| Milestone | Done when | Status |
| --- | --- | --- |
| **M1: vertical slice** | One house, playable start to finish in the Hookup View, with faults #1 and #6, placeholder art and payout math. | Done |
| **M2: core loop** | Dispatch, map with snow and plow, clock, Night Report. Night 1 is fully playable with faults #1 to #11. Deployed privately once (with approval) to prove the pipeline. | Done |
| **M3: full content** | All 20 faults, Nights 2 and 3, callbacks, shop, upgrades, finale, Par solver. | Done |
| **M4: art and audio** | fal art, ElevenLabs voices, music, sound effects, title, ending, tutorial polish. | Next |
| **M5: playtest and polish** | Outside playtests, balance with the solver, bug fixes, `opengame check --build`. | |
| **Submit** | Deploy (with approval), then confirm the track and details, before Dec 18. | |

### Cut List

If we fall behind, we cut in this order:

1. Meshy assets.
2. The Friendly Face upgrade.
3. Mid-night new calls (all calls known at 6 PM instead).
4. Callbacks.
5. Faults #13 and #19.
6. Two nights instead of three.

**We never cut:** voiced calls, the ending, and the Par score in the Night Report.

## 15. Open Questions

- Do OpenGame's official rules restrict generated assets or audio licensing? We'll check when the official rules are posted.
- Does OpenGame's platform give the game a fixed canvas size or aspect ratio? Check `opengame check` and AGENTS.md. We'll design for 16:9 with a minimum size of 1280×720.
- Should there be an online leaderboard? Not unless the platform provides one. A local best is enough.
