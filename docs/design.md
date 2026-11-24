# Boxed In: Design Doc

**Status:** draft v2 (2026-11-19, numbers from the M3 balance pass). "Boxed In" is a working title.

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

- **Left-click** an open cell to start a wall there. **Right-click** or **Space** switches between horizontal and vertical.
- The direction shows in three places: the hover preview, a mark beside the cursor over filled space, and the HUD's "turn now" line.
- The preview shows the wall's whole path only when a click would build it.
- While every crew is busy, the preview is a grey outline marked "wall building". On a ball or a growing wall, it's just the cell in red.
- A refused click says why ("Wall still building", "A ball is in the way").
- A growing half gets a pulsing outline while a free ball is within 2 cells of it (steady under reduced motion). The HUD shows the Hardened Tip and Close Call charges left this stage.
- A wall grows from the click point in **both directions at once**, as two halves.
- Each half grows until it reaches a filled cell, then turns solid.
- **If a ball touches a half while it's still growing, that half breaks and you lose a life.** The other half keeps growing.
- One ball costs a wall at most one life (or one shield) per pass. Every half covers the wall's start cell, so a ball that runs through it, or breaks one half and carries on into the other within 0.5 s, breaks them all for a single life. (Found in the M5 bug bash: it used to cost a life per half.)
- One wall can be building at a time (upgrades can change this).

### Capturing

- When a half turns solid, the open cells are split into regions by flood fill.
- **Any region with no ball in it is captured**: its cells fill and score points.

### The squeeze (the twist)

- Each level has a **pen limit**, shown as a number of cells and as a percent of the field.
- A region that holds *k* balls is a **pen** when its area is **≤ k × the pen limit**. A shared pen is allowed, but it gets no extra room per ball.
- A pen **locks**: it glows, its balls dim, and nothing more needs to happen there.
- **The level clears when every ball is in a locked pen.** Captured percentage doesn't matter on its own.
- Each region holding balls shows a meter of its area against its limit, so you always know how much more to cut. It sits at the open spot nearest the region's centre that is clear of every growing wall's path.

### Lives

- The run starts with **3 lives**. Clearing a level gives **+1 life, up to 5**. (Without the cap, lives piled up and stages 6–12 cost nothing. Each Spare raises the cap by 1.)
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
- **XP equals points.** Level *n* needs 5000 × 1.35^(n−1) XP: about 5 upgrades in a novice's run, 8 in an average one and 10 in an expert's. (The first guess, 800 × 1.3^(n−1), gave about five level-ups on stage 1 alone.)
- Level-ups during play are queued and shown with a small pip on the HUD. They're resolved on the level-clear screen, so play is never interrupted mid-wall.
- Each level-up offers **3 upgrades; pick 1**. Several level-ups mean several picks in a row. Each pick comes with 1 reroll (more with the Reroll upgrade).

## 6. Run Structure

- A run is **12 stages**. Stage 12 is the finale. Clearing it wins the run, and then you can keep going in **Endless**: each stage past 12 tightens the limit by 6% (to a floor of 2.5%), speeds the balls up by 0.02× (to 1.6×), adds a ball every other stage (to 10) and another special ball every other stage. Score is all that matters there.
- Each new stage adds balls, speeds them up a little, tightens the pen limit and, from stage 4 on, mixes in special balls.

| Stage | Balls | Special balls among them | Speed | Pen limit (per ball, % of field) |
| --- | --- | --- | --- | --- |
| 1 | 1 | — | 0.85× | 20% |
| 2 | 2 | — | 0.9× | 16% |
| 3 | 2 | — | 1.0× | 12% |
| 4 | 3 | Swift (new) | 1.05× | 11% |
| 5 | 3 | Swift | 1.1× | 10% |
| 6 | 4 | Big (new) | 1.15× | 9% |
| 7 | 4 | Swift, Big | 1.2× | 8% |
| 8 | 5 | Splitter (new) | 1.25× | 7% |
| 9 | 6 | Swift, Splitter | 1.3× | 6.5% |
| 10 | 6 | Drifter (new) | 1.35× | 6% |
| 11 | 7 | Big, Drifter | 1.4× | 5.5% |
| 12 | 8 | One of each | 1.45× | 5% |

Tuned on the balance bot (plan, M3; report in [balance.md](balance.md)). Stages 1–2 are slower so a first-time player isn't knocked out on the one-ball stage. The extra balls on stages 9, 11 and 12 are what make the late game cost lives. These are provisional until real runs agree.

### Ball types

| Ball | Behaviour |
| --- | --- |
| Basic | Constant speed, standard size |
| Swift | 1.5× speed |
| Big | 2× radius, so it touches walls sooner and needs a bigger pen (counts as 1.5 balls toward a pen's limit) |
| Splitter | Splits into two Basics heading apart the first time its region shrinks below half the field |
| Drifter | Its heading turns 0.5 rad/s (a turning circle wider than the field, so it always meets a wall), so straight-line reads lie |

Each special ball has its own mark as well as its look (Swift: an arrowhead pointing where it's going, and a trail; Big: a halo; Splitter: a line across; Drifter: a hollow centre), so kinds never read by colour alone. The stage intro names each kind in the stage and flags new ones.

## 7. Upgrades

Upgrades come in three rarities: common, rare and epic. Most of them stack. Each offer shows three distinct upgrades, weighted by rarity. Values below are from the M3 balance pass: each upgrade was measured by holding it from stage 1 against the same seeds without it ([upgrade-strength.md](upgrade-strength.md)), and the outliers were changed.

**Walls**
- **Quick Build** (C, stacks): walls grow 20% faster.
- **Hardened Tip** (R): your walls shrug off the first 2 ball hits each stage; the ball bounces off and the half keeps growing. (Once per half, then once per wall, both won nearly every run.)
- **Twin Crews** (E): two walls can build at once, and walls grow 50% faster. (Two walls alone did nothing: there's no clock to beat.)
- **Crossbeam** (E): hold Shift to build a + wall (four halves), whose halves grow 30% faster.
- **Last Stretch** (R): a half within 5 cells of finishing completes instantly.

**Balls**
- **Thick Air** (C, stacks): balls move 8% slower.
- **Shrink** (C, stacks): balls are 10% smaller.
- **Stun** (R): balls freeze for 1 s whenever a wall finishes, unless another wall is still building. (Freezing when a half set left balls frozen in the other half's path and cost lives.)

**Squeeze**
- **Loose Fit** (C, stacks): pen limit +8%.
- **Snug Reward** (R, stacks): squeeze bonus ×2.
- **Auto-Lock** (E): a pen up to 35% over its limit locks anyway.

**Score and XP**
- **Greed** (C, stacks): +15% points.
- **Study** (C, stacks): +20% XP.
- **Chain** (R): combo multiplier +1.
- **Reroll** (C, stacks): +1 reroll per upgrade screen.

**Survival**
- **Spare** (C, stacks): +1 life now, and stage clears top you up to 1 more (the 5-life cap rises by 1).
- **Second Wind** (R): +1 more life per level clear.
- **Close Call** (R): the first life you'd lose each level is spared.

**Actives** (one active slot. Picking a second swaps it. Press **Q** to use. Charges refill as walls complete.)
- **Freeze** (R): stop all balls for 3 s. 6 walls to recharge.
- **Repel** (R): every ball turns to head away from the cursor. 3 walls to recharge.
- Each stage starts with the active ready. The HUD shows its charge under the field.

## 8. Screens and Flow

Title → Run start → Stage intro (balls, pen limit) → Play → Stage clear (score breakdown, then queued upgrade picks) → next stage. Then either Game over (run summary, best score) or Victory after stage 12 (summary, then the Endless offer).

- **Pause** with Esc or P: resume, restart run, settings, quit to title.
- **Pause** also happens by itself when the window or the game's frame loses focus. Restart run and Quit to title ask for a second press.
- **Settings:** volume (master, music, effects), reduced motion, colour-blind-safe palette, show grid, tutorial tips. One schema in `scripts/settings.gd` drives the screen, the defaults and the sanitiser; each change is saved at once. Reduced motion starts on if the browser asks for it.
- **Tutorial:** tips over the bottom of the field on stages 1 and 2, one at a time, each until the player has done what it teaches (build, turn) or for a few seconds (danger, two balls). Tab hides them for good; they turn themselves off after stage 2, and the stage-clear screen says so. Settings can turn them back on. No separate tutorial mode.
- **Saving:** best score, best stage and settings are saved locally. Runs aren't saved mid-run (stretch goal).

## 9. Controls

| Action | Input |
| --- | --- |
| Build wall | Left-click |
| Switch direction | Right-click or Space |
| Use active | Q |
| Pause | Esc or P (or click outside the game) |
| Hide tips | Tab |
| Menus | Mouse, or arrows/Enter |

## 10. Look and Sound

- **Look:** clean, flat, high-contrast shapes on a dark field with a soft additive glow on balls, growing walls and locked pens. Each wall half has its own colour (cyan for the half growing left or up, orange for right or down) with a bright tip. Open space has a rim where it meets a wall; a locked pen's rim turns green. The title is the game's name built from cells, with a box around "IN". State never relies on colour alone: growing walls have stripes that move outward, locked pens get a green rim, a padlock and a full meter bar, boxed balls get a dark ring, and each ball kind has its own mark. A locking pen pulses brighter in its own colour, never toward the ball's colour. Menu focus is a thick outline in the text colour; a switch that's on is a tinted fill. Upgrade rarity strips get thicker as well as changing colour. The colour-blind palette (Okabe–Ito) swaps red and green for vermilion, blue and yellow.
- **HUD:** stage, score, lives as pips and the XP bar across the top; the limit and the boxed count under them. Left of the field: the controls, Crossbeam's key and the active ability (Q, its charge as segments). Right: the ball kinds in play. Each pen shows area / limit with a bar.
- **Feel:** a white flash and glow along a half when it sets (snap), a sweep that lights captured cells outward from where the wall started, then fades into wall colour; a 90 ms hit-stop, a 7 px shake, a red border pulse and flying shards when a wall breaks; a pulse and a ring when a pen locks; floating score and combo text; a burst on level-up and on clear. Reduced motion turns off shake, rings, particles, moving stripes and the sweep's stagger. The full-screen flash is capped at 14% red, a luminance step of about 0.04.
- **Sound:** synthesised by `dev -Sounds` (`scripts/dev/make_sounds.gd`, sine, triangle and filtered noise, seeded): 19 effects (interface move/select/back, wall start, turn, blocked, snap, capture, break, shield, lock, split, freeze, repel, level-up, clear, game over, victory, pick) and two loops (menu, 32 s, pads and bells; play, 40 s at 96 BPM, pads, bass, plucked arpeggio, soft kick, hats and a bell line in the second half). Effects vary in pitch by ±2.5%; captures pitch down as they get bigger; each pen that locks in a stage chimes a step higher on a pentatonic scale. Buses: Music and SFX into Master. All are made by us. The sponsor tools (ElevenLabs, fal, Meshy) are out of scope unless we decide otherwise. **Nobody has listened to them yet; levels were set by meter.**

## 11. Tech

- **Engine:** Godot 4.7.2 (portable copy in `.tools`, fetched by `dev.ps1`), GDScript, **Compatibility renderer** (WebGL 2).
- **Web export:** single-threaded (no SharedArrayBuffer, so no special server headers needed). Output goes to `build/web/`.
- **Structure:**
  - `scripts/core/`: pure logic with no nodes, so it's testable headless. Grid and flood fill, pens, scoring, XP curve, stage table, upgrade data and effects, seeded RNG.
  - `scenes/game/`: the field (drawn with `_draw`), balls, walls and HUD.
  - `scenes/ui/`: title, stage intro, stage clear, upgrade pick, pause, settings, game over and victory.
  - Autoloads: `Audio` and `Settings` (`scripts/`). The run's state is a plain `Run` object owned by `scripts/main.gd`.
  - `scripts/dev/`: the balance report, the sound generator and the icon and splash generator. `scenes/dev/shots.tscn` (`dev -Shots`) is a scripted screenshot tour. None of these are exported.
  - `tests/`: a headless test runner (`dev -Test`) for the core logic.
- **Determinism:** each run has a seed, so a run can be replayed for balancing and capture.
- **Balance bot:** a headless simulated player (`scripts/core/bot.gd`) at four tiers: random clicking, novice, average and expert. It predicts ball paths and builds the wall that cuts the most space without being hit, within what that tier can foresee: novices read straight lines only, average players one bounce ahead, experts two. Tiers also differ in reaction time, margin, misclicks and patience. `dev -Balance` plays seeded runs and writes the report (plan, M3). With Crossbeam it also weighs + walls. Between walls it pauses to decide, as a person would.
- **Run log:** each finished run is appended to `user://runs.jsonl` (stage times, walls, lives lost, upgrades), and `dev -Balance --real` puts your unstaged runs beside the bot tiers.

## 12. Jam Checklist

- [ ] Runs in a desktop browser with mouse and keyboard, nothing to install.
- [ ] Made during the jam, with a clean git history.
- [ ] Complete: title, tutorial, a 12-stage run with an ending, plus Endless.
- [ ] Genre: Puzzle & Casual (confirm with `opengame jams --json` before submitting).
- [ ] Passes `opengame check --build`.
- [ ] All assets are our own.
