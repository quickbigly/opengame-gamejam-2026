# Boxed In: Persona Playtest Results

Round 1, Nov 23–24. Plan and tools: [persona-playtest.md](persona-playtest.md).

The scripted runs were on builds of `854b5a4-dirty`: commit 854b5a4 plus the uncommitted work of this round.

- **Final scripted run:** 38 of 41 checks passed. The 3 failures were P9's two budget checks and P4's pick check, which only failed because its run ended before an upgrade pick. P4 passes when replayed. Report: `tests/browser/out/2026-11-24T00-13-12/results.md`.
- **Plant proofs:** all 9 planted defects were caught on the final build, 8 of them by a persona's check and one (a stale `index.pck`) by the build receipt check. Report: `tests/browser/out/2026-11-24T00-24-01/results.md`.
- **In-character agents:** three agents played the stepped build from screenshots only: P1 (jam judge), P2 (new to the genre) and P5 (deuteranopia). Their reports are in `tests/browser/out/agent-P*-report.md`.

**Limits of this evidence:**
- Nobody has heard the game yet.
- The agents played on a stepped clock with unlimited time to think, so their lives lost say nothing about difficulty.
- Motion was judged from frames, not watched at speed.

## Fixed this round

Ranked by how many personas ran into each one.

| # | Finding | Found by | Fix | Check |
| --- | --- | --- | --- | --- |
| 1 | **The wall that clears a stage never scored.** In the step where it sets, the board reports `cleared` before `wall_finished`, and the game stopped listening at `cleared`. Every stage's last capture (often the biggest) earned no points and no XP. The balance bot handles every event, so its numbers always included those points: real players got fewer points and fewer upgrades than the bot. | P2 agent ("the wall that finally boxed a ball never showed a points popup") | [main.gd](../scripts/main.gd) keeps handling events while the stage ends | `test_flow.gd`, shown to fail without the fix |
| 2 | **The tutorial tip covered the bottom of the field.** It hid a live ball (P1), the end of a growing wall (P5) and a locked pen with its meter (P5 scripted). | P1 agent, P5 agent, P5 scripted | The tip moves to the clear edge of the field once its edge has been busy for 0.4 s. When both edges are busy, it fades until its own edge clears ([field.gd](../scenes/game/field.gd)). | P2: "the tip box never hides a ball for more than 0.6 s"; the plant `tip_stays_put` is caught at 1.33 s |
| 3 | **The HUD showed old lives behind the stage-clear screen** (3 against the card's 4), and after a Spare pick. | P1, P2 and P5 agents | [run.gd](../scripts/core/run.gd) updates the board's lives on a clear and on Spare | `test_variety.gd`, shown to fail without the fix |
| 4 | **The browser's reduced-motion setting was ignored.** Godot's web bridge returns the browser's `true` as the number `1`, and `1 == true` is false in GDScript. | P6 scripted | [settings.gd](../scripts/settings.gd) compares it as a number | P6: "the browser's reduced-motion preference turns it on" |
| 5 | **Slow frames.** The field redrew all 1,536 cells every frame, and each wall that set took up to 20 ms in the flood fill and capture. | P9 scripted | Cells draw on their own layer, which redraws only when they change. The flood fill, capture and pen centroids work on plain indices. The same 90 seeded bot runs give identical results. | P9, below |

P9 timings, stage 12, Chrome on this laptop (Intel UHD graphics, confirmed as the GPU in use):

| | Before | After |
| --- | --- | --- |
| Median frame, 4× CPU slowdown | 45.8 ms | 20.9 ms |
| Median frame, 2× CPU slowdown | 20.9 ms | 12.5 ms |
| Worst frame when a wall sets, 4× CPU slowdown | 104–113 ms | 62.5 ms |
| Slowest board step, native | 20.6 ms | 0.8 ms |
| `dev -Balance`, 90 runs | 145 s | 85 s |

## Fixed in round 2 (Nov 24)

Fixes 1–6 of the open list below, as described in [design.md](design.md) §4 and §10. Each has a scripted check and a plant that the check is shown to catch:

| Open item | Fix | Check (P2 unless noted) | Plant |
| --- | --- | --- | --- |
| 1. Red preview misread | The path shows only when a click would build. While crews are busy, a grey outline marked "wall building". A refused click says why. | "no red path while a wall builds" (pixels along the hovered row) | `red_busy_preview` |
| 2. Direction hard to see | "turn now" plus a direction mark in the HUD, and a mark beside the cursor over filled space | "the HUD shows which way the next wall grows" (pixels change on Space) | `no_direction_icon` |
| 3. Swift looks like Basic | An arrowhead inside the ball, pointing where it's going (also in the ball list) | judged by eye on screenshots | none |
| 4. Colour-blind side effects | Focus is a thick text-coloured outline, and "On" is a tinted fill. Rarity strips are 4, 8 and 12 px. Locking pens pulse in their own colour, and boxed balls get a dark ring. | P5 colour checks; `P5-*-lock-pulse.png` judged by eye | none (the dark ring keeps the ball visible whatever the pulse colour, so no check could tell a plant from the fix) |
| 5. Meter on walls | The meter sits at the nearest open spot clear of every growing wall's path | "pen meters stay off growing walls" (0 of 168 looks) | `meter_at_centre` |
| 6. No warning before a hit | A pulsing outline while a free ball is within 2 cells. Shield and Close Call charges in the HUD. | "a growing wall warns before a ball hits it" | `no_danger_cue` |

Round 2 runs:
- **Plant proofs:** 13 of 13 caught (12 plants plus the stale-file receipt check). Report: `tests/browser/out/2026-11-24T00-50-09/results.md`.
- **Full run:** 43 of 46 checks passed. Report: `tests/browser/out/2026-11-24T01-00-48/results.md`. The three failures:
  - P9's load time: 14.5 s against a 12 s budget.
  - P9's frame times at 4× slowdown: median 16.7 ms, and 99% of frames within 33.3 ms against a 33 ms target.
  - One browser min-maxer run lost on stage 12 (the click-latency effect above). The headless bot won 30 of 30.
- **Re-checked after two small changes:** P2 and P5 pass 15 of 15 on the final build, after removing one plant no check could catch and shortening a clipped HUD line ("absorbs a hit").

Still open: 7 (difficulty, waiting for human runs) and 8 (load time, deferred).

## Open: design decisions (round 1 list)

1. **The red wall preview is misread.** While a wall is building and you can't start another, the hover preview turns red (`preview_blocked`). P1 and P2 both read it as "where the wall will end". P5 (deuteranopia) saw it as murky brown and couldn't tell what it meant. Clicking then does nothing, with no message. Options:
   - hide the preview while all crews are busy;
   - draw it grey with a "busy" cursor or label;
   - keep red only for cells where a wall can never start.
2. **The pen meter sits on top of walls.** The "area / limit" label is drawn at the pen's centre, which is often where the next wall goes (P1, P2). It could shift away from growing halves.
3. **The wall direction shows only while hovering open space** (P2). P2's one wish: "a permanent small icon showing which way the next wall will grow". The HUD's "Right / Space: turn" line could show the current direction.
4. **There is no warning before a ball hits a growing wall** (P5), and a charged Hardened Tip shows only as a thin white outline, with no label.
5. **Swift and Basic balls look alike in a still frame** (P5). Only a faint three-dot trail sets Swift apart. A different shape would help.
6. **The colour-blind palette has side effects** (P5):
   - In Settings, the focus border and the "On" border are the same yellow.
   - Common and Rare upgrade stripes have about the same brightness.
   - During the 0.9 s lock pulse, a boxed ball is yellow on a yellow pen. At rest it stands out fine (checked on the scripted screenshot).
7. **Difficulty and pace.** The persona bot profiles (30 seeds each, [balance-personas.md](balance-personas.md)):

   | Profile | Wins | Median stage reached | Runs lost on stage 1 |
   | --- | --- | --- | --- |
   | `newcomer` | 7% | 3 | 27% |
   | `hurried` | 10% | 6 | 7% |
   | `minmaxer` | 100% | won | 0% |

   The minmaxer, stacking the strongest upgrades, lost almost no lives. The P1 judge gave Fun 3/5: "the early stages are easy and the walls grow slowly". That's fast for a bot and easy for a careful player, but harsh for a first-timer who doesn't turn walls.

   The bot always scored the clearing wall, so fix 1 doesn't change any bot numbers. Real players now earn what the bot assumed, which means more upgrades than they were getting. The open retune question still waits for human runs.
8. **Load time.** On 10 Mbit/s with 4× CPU slowdown, the title takes 15.6 s against a 12 s budget. That's the 39 MB engine (10 MB gzipped); only a custom engine build with unused modules stripped would shrink it.

## Smaller notes

- P1 said a quick second click on "Pick upgrade" skipped the next screen, because buttons sit in the same place. Not reproduced.
- P1 recognised the genre by name from the first screen. Judges will too; the design doc's originality section already covers how we differ.
- Instrument note: in the browser, the advising bot plays a little worse than headless, because each click arrives 0.1–0.2 s late. One minmaxer browser run lost on stage 9 and one average-bot run lost on stage 1. Treat browser bot runs as input-path checks, not difficulty numbers.

## What every check covered

| Persona | Checks (final run) |
| --- | --- |
| P1 jam judge | frame 1 s after Play; first click builds; stage 1 in under 3 min (9 s); 5 minutes with no errors (reached stage 6) |
| P2 newcomer | first tip teaches building; meter drawn; right-click turns; click builds; red flash on a life lost; tip never hides a ball (0.13 s worst); no errors |
| P3 min-maxer | won in 1.6 min (bot); Endless to stage 16 with score rising; no errors |
| P4 keyboard | focus visible; settings by keys; run by keys; Esc pauses; Esc and P resume; Quit asks twice; R rerolls; one key, one upgrade |
| P5 colour-blind | locked and open pens differ under none, deuteranopia, protanopia, tritanopia and achromatopsia (RGB distance 40–65, both palettes); padlock drawn |
| P6 motion | control: shake seen with motion on; browser preference honoured; no shake, particles or rings under either reduced-motion route |
| P7 chaos | 692 random actions (clicks, keys, Esc/P spam, resizes, blur) plus play: no errors, no stuck screen, lives in range, double-click picks once, reached stage 9 |
| P8 returning | second run starts clean; Tab turns tips off; best score and settings survive a reload |
| P9 weak laptop | hi-DPI canvas at full resolution; load 15.6 s (fail); stage 12 p99 33.4 ms (fail by 0.4 ms) |
