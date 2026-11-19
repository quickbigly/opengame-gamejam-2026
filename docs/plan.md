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
- [ ] Balls: diagonal movement on a fixed 120 Hz step, swept collision against cells.
- [ ] Walls: click to build, switch direction, two halves, breaking on a ball hit, solidifying.
- [ ] Capture: fill regions with no balls in them.
- [ ] Squeeze: pen limit, pen meters, locking, stage clear.
- [ ] Lives and game over.
- [ ] Tests for flood fill, capture, pen locking and wall collision.
- **Exit:** one stage is playable from start to clear or to game over.

## M2: Run and Upgrades (Nov 26–30)

- [ ] Stage table (12 stages), stage intro and stage clear screens.
- [ ] Scoring: capture, combo, squeeze bonus, clean clear, stage multiplier.
- [ ] XP curve, queued level-ups, upgrade pick screen with rerolls.
- [ ] The first ~12 upgrades (walls, balls, squeeze, score, survival).
- [ ] Victory after stage 12, game over summary, local best score.
- **Exit:** a full run is playable from title to victory.

## M3: Variety and Balance (Dec 1–5)

- [ ] Ball types: Swift, Big, Splitter, Drifter.
- [ ] Remaining upgrades, including Actives (Freeze, Repel) and the epics.
- [ ] Endless mode.
- [ ] Balance bot: a headless seeded player at three skill tiers. Report clear rate per stage and the most picked and strongest upgrades.
- [ ] Tune the stage table and upgrade values from the bot report and real runs.
- **Exit:** a typical run reaches stage 6–9, and a good run wins.

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
