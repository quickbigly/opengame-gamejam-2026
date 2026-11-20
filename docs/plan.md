# Boxed In: Build Plan

**Target:** submitted by **Dec 17, 2026** (entries close Dec 18, 11:59 pm PT). Design: [design.md](design.md).

Each milestone ends with something playable. Anything not done by its date gets cut or moved to "Stretch", not squeezed in.

## M0: Pipeline (Nov 19–20)

- [x] Godot 4.7.2 project: Compatibility renderer, 1280×720, `canvas_items` stretch.
- [x] Fetch the 4.7.2 web export templates into `.tools` (`dev -Setup`). Add a single-threaded "Web" export preset that writes `build/web/index.html`.
- [x] Export a placeholder scene from the command line (`dev -Web`). Still to do: open it in a browser. `opengame dev` (CLI 0.13.5) refuses to run on Windows (`filesystem_unsupported`), so serve it with `python -m http.server 5180 --directory build/web` instead.
- [x] `opengame check --build --json` passes on the placeholder. Ask before any deploy.
- [x] Headless test runner (`dev -Test`).

## M1: Core Loop (Nov 21–25)

- [x] Grid model: open and filled cells, flood-fill regions, region areas (`scripts/core/grid.gd`).
- [x] Balls: diagonal movement on a fixed 120 Hz step, swept collision against cells.
- [x] Walls: click to build, switch direction, two halves, breaking on a ball hit, solidifying.
- [x] Capture: fill regions with no balls in them.
- [x] Squeeze: pen limit, pen meters, locking, stage clear.
- [x] Lives and game over.
- [x] Tests for flood fill, capture, pen locking and wall collision.
- **Exit:** one stage is playable from start to clear or to game over. Done: `scripts/core/` (Grid, Ball, WallHalf, Board) and `scenes/game/field.gd`; try other stages with `dev --balls=3 --limit=0.11 --seed=42`.

## M2: Run and Upgrades (Nov 26–30)

- [x] Stage table (12 stages), stage intro and stage clear screens.
- [x] Scoring: capture, combo, squeeze bonus, clean clear, stage multiplier.
- [x] XP curve, queued level-ups, upgrade pick screen with rerolls.
- [x] The first ~12 upgrades (walls, balls, squeeze, score, survival).
- [x] Victory after stage 12, game over summary, local best score.
- **Exit:** a full run is playable from title to victory. Done: `Run`, `StageTable` and `Upgrades` in `scripts/core/`, flow in `scripts/main.gd`, screens in `scenes/ui/screens.gd`. 16 upgrades. Start at any stage with `dev --stage=6 --seed=42`.

## M3: Variety and Balance (Dec 1–5)

- [x] Ball types: Swift, Big, Splitter, Drifter.
- [x] Remaining upgrades: Hardened Tip, Crossbeam (the last epic), and the actives Freeze and Repel (Q, one slot, recharged by walls). 20 upgrades in all.
- [x] Endless mode, offered on the victory screen.
- [x] Balance bot: a headless seeded player at three skill tiers, plus random clicking. It foresees 0, 1 or 2 bounces by tier, pauses to decide between walls, uses actives and Crossbeam. `dev -Balance` reports where runs end and each stage's clear rate, time, walls and lives lost: [balance.md](balance.md). `dev -Balance --strength` measures each upgrade on paired seeds: [upgrade-strength.md](upgrade-strength.md).
- [x] Tune the stage table and upgrade values from the bot reports.
- [ ] Check the tuning against real runs. Finished runs are logged to `user://runs.jsonl`; after a few unstaged runs (started from stage 1), `dev -Balance --real` shows them beside the bot tiers. If they disagree, recalibrate the bot tiers first, then retune. Until then every number here is provisional.
- **Exit:** a typical run reaches stage 6–9, and a good run wins. On the bot (60 runs per tier): average median stage 9, 85% reach stage 6, 22% win; expert wins 97%; novice median stage 4; random clicking median stage 2 and never wins.

Changes made from the bot reports, one at a time:

| Change | Why | Effect |
| --- | --- | --- |
| Pen value counts locking a pen (bot fix) | The bot stalled on a pen 1.5 cells over its limit | No stalls |
| Bot foresees 0/1/2 bounces by tier, slower reactions, pauses between walls | It read every bounce perfectly: stages cleared in 4 s, 100% expert wins | Calibration |
| Clear bonus capped at 5 lives | Lives piled up; stages 6–12 cost nothing | Average wins 53% → 37% |
| Stages 1–2 at 0.85× and 0.9× speed | 17% of novice runs ended on the one-ball stage 1 | Novice stage 1 losses 17% → 8–12% |
| Ball speed ramps to 1.45× by stage 12 | Escalation (little effect alone: the bot waits for gaps) | ~same |
| One more ball on stages 9, 11 and 12 | Late stages cost the average bot about 0.5 lives | Average wins 40% → 30% |
| Stun fires when a whole wall finishes and nothing else is building | Freezing when a half set left balls frozen in the other half's path | Stun −0.3 lives a stage → +1.3 stages |
| Hardened Tip: 2 shrugged-off hits per stage (was 1 per half) | Held from stage 1 it won every run | +4.4 stages, 100% wins → +3.0, 83% |
| Twin Crews also +50% wall speed; Crossbeam + walls 30% faster; Repel turns every ball and recharges in 3; Auto-Lock 35%; Last Stretch 5 cells; Snug Reward ×2; Spare raises the life cap | Each added under one stage, or nothing (Twin Crews −0.3, Repel 0.0, Auto-Lock +0.2) | All now +0.7 to +3.2 stages |
| XP growth 1.25 → 1.3 → 1.35 | Upgrades carry runs (none: median stage 5, no wins); the buffs above made them carry more | 8 upgrades a run; average median stage 12 → 9 |

The strength report was measured at XP growth 1.3, just before the last change; the upgrades' standings relative to each other hold.

Left for real runs and M5:

- The bot clears stages in 4–25 s; people will take much longer. Time doesn't change difficulty (there's no timer), but the bot's reads are faster than a person's. The real-run check above is what makes these numbers trustworthy.
- Freeze (+0.7) and Crossbeam (+0.8) are the weakest. The bot's use of both is simple (Freeze before long walls; crosses on a third as many cells as straight walls); people may get more out of them.

## M4: Feel, Look and Sound (Dec 6–11)

- [ ] Art pass: palette, glow, wall stripes, pen lock animation, background.
- [ ] Juice: snap, capture sweep, break shake and hit-stop, level-up burst. Respect reduced motion.
- [ ] Synthesized sound effects and music loops, plus volume settings.
- [ ] Title, pause, settings (colour-blind palette, reduced motion, grid toggle), keyboard menu navigation.
- [ ] Stage 1–2 tutorial overlays.
- **Exit:** it looks and sounds finished.

## M5: Playtest and Harden (Dec 12–15)

- [ ] Playtests by other people. Fix what they trip on.
- [ ] Web build checks: load time, frame pacing, audio starting on the first click, focus and keys inside the OpenGame frame.
- [ ] Bug bash: wall edge cases (a click on a wall, a ball inside a wall's start cell, a wall that closes two pens at once).

## M6: Submit (Dec 16–17)

- [ ] Follow the deploy steps (in memory). Ask before every deploy or publish.
- [ ] Play the private preview, then enter the jam.

## Stretch

- Saving mid-run.
- Meta unlocks between runs (new upgrades or starting perks).
- Daily seed with an OpenGame leaderboard.
- More ball types and active upgrades.
