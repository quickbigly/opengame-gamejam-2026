# Snowbound Signal: Design Doc

**Status:** draft v1, written 2026-11-18.

**Jam:** OpenGame Game Jam 2026. The deadline is **Dec 18**, and we target Dec 17. The rules are in [jam-rules.md](jam-rules.md).

**Related docs:** [fault-library.md](fault-library.md) has the puzzle content.

---

## 1. Pitch

It's the night before Pinecrest Hollow's winter festival broadcast, and a blizzard has snowed in the town. You're the only person who knows how to fix TVs and gadgets.

Over three snowy nights, neighbors call with problems like "the TV says No Signal," "the sound bar won't work" or "the internet dies at 9." You plan your route through half-plowed streets, pack your van, and untangle each living room's hookups before the clock hits midnight.

**Fix things in the right order and the tips get bigger. Fix the town hall's screen on Night 3 and the festival goes live.**

## 2. Pillars

1. **Cozy, never stressful.** The clock creates planning pressure, but failure only costs tips. Players are never blocked. Warm lights, snow and kind neighbors.
2. **Anyone can read the problem.** There's no jargon. The colored lines in the Hookup View show what's wrong (see the "No Jargon" rule in the fault library).
3. **Order matters, and it pays.** Every fix, route and toolbox load has a best order. The game shows its math so optimizers can plan in spreadsheets, while casual players can ignore it.
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
│ 2. Pack the Van: pick parts (limited slots)                    │
│ 3. Town Map: choose the next house. Travel costs time, and     │
│    snow matters.                                               │
│ 4. House: solve the fault in the Hookup View → payout          │
│    (repeat steps 3 and 4; new calls can arrive mid-night)      │
│ 5. MIDNIGHT: Night Report (earnings, Par comparison, stars)    │
└─ BETWEEN NIGHTS: Shop (restock parts, buy upgrades) ──────────┘
```

**Session length:** about 15 minutes per night and **about 45 to 60 minutes per run.** That's long enough to feel complete and short enough for judges to finish.

## 5. Screens

| Screen | What it does |
| --- | --- |
| **Title** | New game, continue, settings, credits. Snowfall over the town at night. |
| **Dispatch Board** | A cork board of call cards. Each card shows the neighbor's portrait, a quote, a deadline, the base pay and a ★ difficulty. Click a card to hear the voiced call. |
| **Van** | Grid slots and part icons with their weight, plus the tools you've unlocked. Drag parts in and out. |
| **Town Map** | Top-down cozy town. Roads have snow levels, the snowplow's route and times are visible, and a clock is shown. Click a house to drive there. |
| **House: Hookup View** | The puzzle screen. See §6. |
| **Night Report** | The payout breakdown per job, total vs. **Par**, stars and Tip Cards earned. |
| **Shop** | Restock parts and buy permanent upgrades. |
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
| Install a part from the van | 3 min | Drag from the toolbox tray |
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
- **Par** is the best possible night score. We compute it offline with a solver script, which also serves as a balance test, and show it in the Night Report.
- **Run score:** the total coins, plus a festival bonus if the finale is fixed before midnight on Night 3. It's saved locally as a personal best.

## 8. Town, Route and Callbacks

- **Size:** about 12 houses plus the town hall, connected by roads in a small graph of about 16 edges.
- **Calls per night:** Night 1 has 6 calls, Night 2 has 7 and Night 3 has 6 plus the finale. **About 4 calls are known at 6 PM,** and the rest arrive at set times. The schedule is the same every run, so routes can be planned.
- **Callbacks:** some fixes have a preventive bonus, such as the Dish Cover (#5) or the Surge Protector (#15). Skipping it means that neighbor calls back on Night 3 and takes time away from the finale. **Investing early pays off later.**
- **Shared fixes:** the Wi-Fi Box faults (#7 and #14) and the sound socket faults (#6, #9 and #12) teach the same Tip Card. Doing the easier one first makes the harder one faster, because a Tip Card can be unlocked into a one-click "Tech Instinct" action.

## 9. Van, Parts and Upgrades

**The van has 8 slot units.**

### Parts

Parts are used up when installed.

| Part | Slots | Cost | Used in |
| --- | --- | --- | --- |
| Remote Booster | 1 | 10 | #2 |
| Dish Cover | 2 | 15 | #5 bonus |
| Hum Stopper | 1 | 12 | #8 |
| Setup Mic | 1 | 15 | #13 |
| Extension Cable | 1 | 8 | #14 |
| Surge Protector | 2 | 15 | #15 bonus |
| Fast Cable | 1 | 20 | #18, limited to 2 per night in the shop |
| Soft Broom | 2 | — (tool) | #5, kept forever |

### Upgrades

Upgrades are permanent and bought between nights.

| Upgrade | Cost | Effect |
| --- | --- | --- |
| Snow Tires | 60 | Snow factor −0.5 (deep snow becomes ×2.0) |
| Signal Lens | 50 | Line details visible without inspecting |
| Thermos | 40 | +30 minutes per night |
| Roof Rack | 70 | +3 van slots |
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
| `1` to `8` | Van slots |
| `M` | Map |
| `Esc` | Pause and settings |

**Settings:** volume sliders, text speed, subtitles always on, colorblind-safe line patterns (dashes and icons, not just color), and reduced motion.

## 13. Genre Choice

The candidates are **Simulation & Management** (route, time and van planning) or **Puzzle & Casual** (the Hookup View).

My current lean is Simulation & Management, because it's probably less crowded and the planning layer is our depth. We'll confirm it against the official track list from `opengame jams global-ai-game-jam-2026 --json` before we deploy.

## 14. Milestones

Today is Nov 18. The target submission date is Dec 17, which leaves 1 day of buffer.

| Dates | Milestone | Done when |
| --- | --- | --- |
| Nov 18 to 23 | **M1: vertical slice** | One house, playable start to finish in the Hookup View, with faults #1 and #6, placeholder art and payout math. |
| Nov 24 to 30 | **M2: core loop** | Dispatch, van, map with snow and plow, clock, Night Report. Night 1 is fully playable with faults #1 to #11. Deployed privately once (with approval) to prove the pipeline. |
| Dec 1 to 7 | **M3: full content** | All 20 faults, Nights 2 and 3, callbacks, shop, upgrades, finale, Par solver. |
| Dec 8 to 13 | **M4: art and audio** | fal art, ElevenLabs voices, music, sound effects, title, ending, tutorial polish. |
| Dec 14 to 16 | **M5: playtest and polish** | Outside playtests, balance with the solver, bug fixes, `opengame check --build`. |
| Dec 17 | **Submit** | Deploy (with approval), then confirm the track and details. |

### Cut List

If we fall behind, we cut in this order:

1. Meshy assets.
2. The Friendly Face and Roof Rack upgrades.
3. Mid-night new calls (all calls known at 6 PM instead).
4. Callbacks.
5. Faults #13 and #19.
6. Two nights instead of three.

**We never cut:** voiced calls, the ending, and the Par score in the Night Report.

## 15. Open Questions

- Do OpenGame's official rules restrict generated assets or audio licensing? We'll check when the official rules are posted.
- Does OpenGame's platform give the game a fixed canvas size or aspect ratio? Check `opengame check` and AGENTS.md. We'll design for 16:9 with a minimum size of 1280×720.
- Should there be an online leaderboard? Not unless the platform provides one. A local best is enough.
