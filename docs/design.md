# Boxed In: Design Doc

**Status:** draft v1 (2026-11-19). "Boxed In" is a working title.

**Jam:** OpenGame Game Jam 2026. Entries close **Dec 18, 11:59 pm PT**; our target is Dec 17. Rules: [jam-rules.md](jam-rules.md). Build plan: [plan.md](plan.md).

---

## 1. Pitch

Balls bounce around a field. You split the field with walls that grow out from where you click. Close off empty space to capture it, and keep shrinking the space until **every ball is boxed into a pen no bigger than the level's limit**. There's no clock: the only pressure is the balls themselves, because a ball that touches a wall while it's still growing breaks it and costs a life.

Every point you score is also experience. Level up and you pick one of three upgrades, so each run builds a different toolkit, roguelite style.

## 2. Pillars

1. **Calm hands, tense moments.** No timer, ever. You can wait as long as you like for the right gap. All the tension comes from committing to a wall.
2. **The squeeze is the goal.** Capturing space is the means. Boxing every ball into a small enough pen is the win. Tighter pens score more.
3. **Every run is different.** Upgrades change how walls, balls and scoring behave, not just numbers, and they stack into builds.
4. **Readable at a glance.** You can always see what is safe, how big each pen is, and how far it is from the limit.

## 3. Originality

The genre and its core verb (grow walls to trap bouncing balls) are classic arcade mechanics. Our name, art, sound, levels and UI are our own, and we don't copy the look of any earlier game. What's new: the per-ball pen limit as the win condition, no timer, and a roguelite upgrade layer driven by score-as-XP.

## 4. Core Rules

### Field

- The field is a grid of **48 × 32 cells**. Each cell is either **open** or **filled**. The border is filled.
- Balls move diagonally at constant speed and bounce off filled cells and the border. Balls pass through each other.
- All movement runs on a fixed 120 Hz step with swept collision, so fast balls never tunnel through a one-cell wall.

### Building walls

- **Left-click** an open cell to start a wall there. **Right-click** or **Space** switches between horizontal and vertical. The cursor always previews the wall's direction.
- A wall grows from the click point in **both directions at once**, as two halves.
- Each half grows until it reaches a filled cell, then turns solid.
- **If a ball touches a half while it's still growing, that half breaks and you lose a life.** The other half keeps growing.
- One wall can be building at a time (upgrades can change this).

### Capturing

- When a half turns solid, the open cells are split into regions by flood fill.
- **Any region with no ball in it is captured**: its cells fill and score points.

### The squeeze (the twist)

- Each level has a **pen limit**, shown as a number of cells and as a percent of the field.
- A region that holds *k* balls is a **pen** when its area is **≤ k × the pen limit**. A shared pen is allowed, but it gets no extra room per ball.
- A pen **locks**: it glows, its balls dim, and nothing more needs to happen there.
- **The level clears when every ball is in a locked pen.** Captured percentage doesn't matter on its own.
- Each region holding balls shows a meter of its area against its limit, so you always know how much more to cut.

### Lives

- The run starts with **3 lives**. Clearing a level gives **+1 life**.
- Losing your last life ends the run.
- There's no timer, so a level can't be failed except by running out of lives.

## 5. Scoring and XP

| Source | Points |
| --- | --- |
| Captured cell | 10 per cell |
| Combo | One wall that captures 2+ regions multiplies that wall's capture points by the number of regions |
| Squeeze bonus (at clear) | For each pen: 25 × (its limit − its area), so tighter pens score more |
| Clean clear | +25% of the level's score if no life was lost this level |

- A **stage multiplier** of (1 + 0.15 × stage) applies to all points, so later stages are worth more.
- **XP equals points.** Level *n* needs 5000 × 1.25^(n−1) XP. (The first guess, 800 × 1.3^(n−1), gave about five level-ups on stage 1 alone; this gives roughly one per stage. Tuned in M3.)
- Level-ups during play are queued and shown with a small pip on the HUD. They're resolved on the level-clear screen, so play is never interrupted mid-wall.
- Each level-up offers **3 upgrades; pick 1**. Several level-ups mean several picks in a row. Each pick comes with 1 reroll (more with the Reroll upgrade).

## 6. Run Structure

- A run is **12 stages**. Stage 12 is the finale. Clearing it wins the run, and then you can keep going in **Endless**, where the pen limit keeps shrinking and score is all that matters.
- Each new stage adds balls, tightens the pen limit and, from stage 4 on, mixes in special balls.

| Stage | Balls | Pen limit (per ball, % of field) | New ball types |
| --- | --- | --- | --- |
| 1 | 1 | 20% | — |
| 2 | 2 | 16% | — |
| 3 | 2 | 12% | — |
| 4 | 3 | 11% | Swift |
| 5 | 3 | 10% | — |
| 6 | 4 | 9% | Big |
| 7 | 4 | 8% | — |
| 8 | 5 | 7% | Splitter |
| 9 | 5 | 6.5% | — |
| 10 | 6 | 6% | Drifter |
| 11 | 6 | 5.5% | — |
| 12 | 7 | 5% | Finale: one of each |

These numbers are a starting point for balancing (see plan, M3).

### Ball types

| Ball | Behaviour |
| --- | --- |
| Basic | Constant speed, standard size |
| Swift | 1.5× speed |
| Big | 2× radius, so it touches walls sooner and needs a bigger pen (counts as 1.5 balls toward a pen's limit) |
| Splitter | Splits into two Basics the first time its region shrinks below half the field |
| Drifter | Its path curves slowly, so straight-line reads lie |

## 7. Upgrades

Upgrades come in three rarities: common, rare and epic. Most of them stack. Each offer shows three distinct upgrades, weighted by rarity. Starting list (about 20, trimmed or extended during balancing):

**Walls**
- **Quick Build** (C, stacks): walls grow 20% faster.
- **Hardened Tip** (R): each half survives its first ball hit.
- **Twin Crews** (E): two walls can build at once.
- **Crossbeam** (E): hold Shift to build a + wall (four halves).
- **Last Stretch** (R): a half within 3 cells of finishing completes instantly.

**Balls**
- **Thick Air** (C, stacks): balls move 8% slower.
- **Shrink** (C, stacks): balls are 10% smaller.
- **Stun** (R): balls freeze for 0.75 s whenever a wall completes.

**Squeeze**
- **Loose Fit** (C, stacks): pen limit +8%.
- **Snug Reward** (R, stacks): squeeze bonus ×1.5.
- **Auto-Lock** (E): a region within 10% of its limit locks anyway.

**Score and XP**
- **Greed** (C, stacks): +15% points.
- **Study** (C, stacks): +20% XP.
- **Chain** (R): combo multiplier +1.
- **Reroll** (C, stacks): +1 reroll per upgrade screen.

**Survival**
- **Spare** (C): +1 life now.
- **Second Wind** (R): +1 more life per level clear.
- **Close Call** (R): the first life you'd lose each level is spared.

**Actives** (one active slot. Picking a second swaps it. Press **Q** to use. Charges refill as walls complete.)
- **Freeze** (R): stop all balls for 3 s. 6 walls to recharge.
- **Repel** (R): push balls away from the cursor. 4 walls to recharge.

## 8. Screens and Flow

Title → Run start → Stage intro (balls, pen limit) → Play → Stage clear (score breakdown, then queued upgrade picks) → next stage. Then either Game over (run summary, best score) or Victory after stage 12 (summary, then the Endless offer).

- **Pause** with Esc or P: resume, restart run, settings, quit to title.
- **Settings:** volume (master, music, effects), reduced motion, colour-blind-safe palette, show cursor grid.
- **Tutorial:** stage 1 teaches walls, stage 2 teaches pens and the limit. Short, skippable overlays; no separate tutorial mode.
- **Saving:** best score, best stage and settings are saved locally. Runs aren't saved mid-run (stretch goal).

## 9. Controls

| Action | Input |
| --- | --- |
| Build wall | Left-click |
| Switch direction | Right-click or Space |
| Use active | Q |
| Pause | Esc or P |
| Menus | Mouse, or arrows/Enter |

## 10. Look and Sound

- **Look:** clean, flat, high-contrast shapes on a dark field with a soft glow. Each wall half has its own colour. Pens fill with a pulse when they lock. State never relies on colour alone: growing walls are striped and locked pens get an outline and an icon.
- **Feel:** a crisp snap when a half completes, a satisfying sweep fill on capture, screen shake and a hit-stop when a wall breaks (all reduced by the reduced-motion setting).
- **Sound:** short synthesized effects (build tick, snap, capture sweep, break, lock chime, level-up) and one or two simple music loops. All are made by us. The sponsor tools (ElevenLabs, fal, Meshy) are out of scope unless we decide otherwise.

## 11. Tech

- **Engine:** Godot 4.7.2 (portable copy in `.tools`, fetched by `dev.ps1`), GDScript, **Compatibility renderer** (WebGL 2).
- **Web export:** single-threaded (no SharedArrayBuffer, so no special server headers needed). Output goes to `build/web/`.
- **Structure:**
  - `scripts/core/`: pure logic with no nodes, so it's testable headless. Grid and flood fill, pens, scoring, XP curve, stage table, upgrade data and effects, seeded RNG.
  - `scenes/game/`: the field (drawn with `_draw`), balls, walls and HUD.
  - `scenes/ui/`: title, stage intro, stage clear, upgrade pick, pause, settings, game over and victory.
  - Autoloads: `Run` (run state), `Audio`, `Settings`.
  - `tests/`: a headless test runner (`dev -Test`) for the core logic.
- **Determinism:** each run has a seed, so a run can be replayed for balancing and capture.
- **Balance bot:** a headless simulated player that places walls with tunable skill. It's used to check that the stage table is clearable and the upgrades are not degenerate (plan, M3).

## 12. Jam Checklist

- [ ] Runs in a desktop browser with mouse and keyboard, nothing to install.
- [ ] Made during the jam, with a clean git history.
- [ ] Complete: title, tutorial, a 12-stage run with an ending, plus Endless.
- [ ] Genre: Puzzle & Casual (confirm with `opengame jams --json` before submitting).
- [ ] Passes `opengame check --build`.
- [ ] All assets are our own.
