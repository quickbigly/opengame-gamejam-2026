# Boxed In: Persona Playtest Plan

For M5 ([plan.md](plan.md)). Agents play the game as different kinds of player before any person does. Then the human sessions in [playtest.md](playtest.md) aren't spent on things a script could have found.

**What this can't replace:** ears, real reaction times and an honest first impression. No agent can hear the sound. An agent reads a film frame by frame and can't watch it at speed. A persona that knows the code isn't really new to the game. Human sessions are still required. Every finding below says whether a person confirmed it.

## 1. Players to cover

Each persona has a goal, a way of playing and pass/fail checks. Some checks are judgement calls made from screenshots. Those are marked *(judged)*.

| # | Persona | How they play | Checks |
| --- | --- | --- | --- |
| P1 | **Jam judge in a hurry** | Cold load from a fresh profile. Gives the game 5 minutes, skims text, starts by clicking. | First wall built within 20 s of pressing Play. Stage 1 cleared within 3 minutes. One second after Play, the frame shows the field, the HUD and a tip, not a black or loading frame. *(judged)* After 5 minutes, they can say the goal in one sentence. |
| P2 | **New to the genre** | Never played a wall-trapper. Clicks near balls, ignores the direction preview, doesn't know right-click turns. | Finds turning (right-click or Space) only through the tip. Every life lost has a visible cause: break flash, shake, the lives counter changing. *(judged)* The pen meter makes it clear when a pen will lock. Reaches stage 3. |
| P3 | **Genre veteran, min-maxer** | Plays well and tries to break the game: picks the same upgrade every time, hunts for combos, waits for perfect gaps, then plays Endless. | Wins in under 25 minutes, or finds the wall that stops them. Any upgrade or combination that makes a stage free is reported. In Endless, score keeps rising with difficulty and nothing overflows or stalls. Answers the open retune question (see §4). |
| P4 | **Keyboard-first** | Uses arrows, Enter, Esc and P everywhere, and the mouse only to place walls. | Every screen (title, settings, intro, pause, clear, pick, reroll, over, victory) can be reached and left without the mouse. Focus is always visible. Esc always goes back or pauses, never quits a run without asking twice. |
| P5 | **Colour-blind** | Colour-blind palette on, and also the default palette, viewed through deuteranopia, protanopia and tritanopia filters on screenshots. | *(judged)* In every case they can tell apart: a growing wall from a solid one, a locked pen from an open region, each ball type, safe from unsafe. Nothing relies on hue alone (padlock, stripes and meter shape carry it too). |
| P6 | **Motion-sensitive** | Reduced motion on, and also the browser's `prefers-reduced-motion` with the game setting untouched. | No shake, rings, particles, moving stripes or staggered sweep. No full-screen flash more than 3 times a second. The game still reads and is still fun to play. *(judged)* |
| P7 | **Chaos player** | Seeded fuzzing: spam clicks and right-clicks, click during sweeps, Esc/P spam, alt-tab or click outside the frame mid-wall, double-click on pick and reroll, resize the window, Q with no active held. | No error in the console, no stuck screen, no lost input after resume, no double pick or double reroll. Every key does something or nothing, and never something wrong. Each finding cut down to its shortest repeat. |
| P8 | **Returning player** | Plays a run, reloads the page, plays again, then starts a second run in the same page without reloading. | Best score and settings survive a reload. Tips don't come back once switched off. A second run in the same page starts clean: lives, XP, upgrades, ball count. |
| P9 | **Weak laptop, slow line** | 4× CPU throttle, 10 Mbit/s and 40 ms latency, 1280×720, and once at a 1920×1080 window with a pixel ratio of 2. | Load to title: report the seconds (budget 12 s on this line). Frame time with a wall building on stage 12: p99 under 33 ms. Text is crisp and unclipped at both sizes. |
| P10 | **Listener** | **Humans only.** The sound check in [playtest.md](playtest.md). | Not done by agents. Each report says "nobody has heard this" until a person has. |

## 2. Tools

Built (Nov 23). All the hooks live in one autoload, [test_hooks.gd](../scripts/test_hooks.gd), and are on only in a **test build**: `dev -WebTest` exports `build/web-test` with the `test_hooks` feature. `dev -Web` (the build that gets deployed) never turns them on, whatever its URL says. [test_hooks.gd](../tests/test_hooks.gd) checks that nothing else reads a test flag and that every plant is wired in exactly one place.

1. **State contract.** Every build mirrors a summary to `window.boxedIn` when it changes: build id, screen, stage, lives, score and level. A test build also publishes the full state as JSON in `window.boxedInTest` every frame: the run (XP, queued level-ups, upgrades, offer, rerolls), the board as 32 rows of `#`/`.`, balls, growing halves, pens, walls started, the active, settings, best score, the tip, effects on screen (shake offset, flash, particles) and every visible button with its rectangle. On desktop, `--state-log=path` writes it once a second.
2. **Stepped clock.** With `?step`, the board, the end-of-stage delay, tip timers and effects all wait for `boxedInStep(n)` (n steps of 1/120 s). Nothing moves while an agent looks and thinks. Real-time runs judge difficulty; stepped runs judge whether the screen makes sense.
3. **Advising bot.** With `?autoplay=<tier>`, a [Bot](../scripts/core/bot.gd) watches each stage and publishes what it would do as `advice`. The browser harness does it with real clicks, right-clicks, Space, Shift and Q. The bot never touches the board, so scripted runs go through the same input path as a person.
4. **Other flags:** `persona=P2` (labels the run), `plant=a,b` (known defects, below), `stage=N` (start at stage N) and `quiet` (publish nothing per frame, for timing runs).
5. **Browser harness**, [tests/browser/](../tests/browser/) (Node, Playwright 1.65.0, the installed Chrome). It serves a build with `no-store` and gzip, as the host does. Before any persona runs, it hashes every served file against the build's `receipt.json` (written by `dev -Web`/`-WebTest`). It drives Chrome with real mouse and keyboard events, starts each persona from a fresh profile, and stamps each screenshot with the game's state.
   - `npm install` once in `tests/browser`.
   - `node run.mjs [--only=P2,P4] [--plant=no_meter] [--seed=N] [--headed]` runs the scripted personas and writes `out/<time>/results.md` plus screenshots.
   - `node run.mjs --prove` runs every plant with the persona that must catch it.
   - `node agent.mjs --persona=P2 --port=5190` opens a stepped session that an agent plays through `curl` (`/look`, `/click?x=&y=&button=right`, `/key?k=`, `/wait?ms=`, `/quit`). The agent sees only screenshots. Everything the game knows is logged beside them.
6. **Bot persona profiles** in [bot.gd](../scripts/core/bot.gd):
   - `newcomer`: novice reads, and only horizontal walls for its first four, unless 15 s pass with no way through.
   - `hurried`: average reads, but barely waits for a gap.
   - `minmaxer`: expert reads, and stacks the upgrades it already holds, strongest first.

   `dev -Balance --tiers=newcomer,hurried,minmaxer` runs them over many seeds.
7. **Persona runs never count as real runs.** Each run log entry has a `source` (`human` or `persona:P2`) and a `build`. `dev -Balance --real` reads only `human`.

Plants, each proved caught by `node run.mjs --prove`:

| Plant | Must be caught by |
| --- | --- |
| `no_meter`: pen meters not drawn | P2, "the pen meter is drawn" (text pixels where the meter should be) |
| `no_right_turn`: right-click does nothing | P2, "right-click turns the wall" |
| `esc_quits`: Esc in play quits to the title | P4, "Esc during play pauses" |
| `double_pick`: one pick applies twice | P4, "one key press, one upgrade" (P7 also double-clicks cards) |
| `hide_locks`: locked pens look like open space | P5, the colour-distance check under five vision types |
| `shake_ignores_reduced`: shake under reduced motion | P6, "system reduced motion: no shake" |
| `no_best_save`: best score never saved | P8, "best score survives a reload" |
| `tip_stays_put`: the tip never moves off the play | P2, "the tip box never hides a ball for more than 0.6 s" |
| `red_busy_preview`: the whole path in red while a wall builds | P2, "no red path while a wall builds" |
| `no_direction_icon`: direction shown only over open space | P2, "the HUD shows which way the next wall grows" |
| `no_danger_cue`: no warning as a ball nears a growing wall | P2, "a growing wall warns before a ball hits it" |
| `meter_at_centre`: meters at the pen's centre, on walls or not | P2, "pen meters stay off growing walls" |
| a stale `index.pck` served | the receipt check |

P6 also has a control: with motion on, the same instrument must see the shake and particles. Otherwise the reduced-motion checks would prove nothing.

## 3. Running it

Each persona is played in two ways:

- **Scripted browser run.** Real time, real input, judged by the pass/fail checks. P1, P4, P6, P7, P8 and P9 are mostly this.
- **Agent playing in character.** One agent per persona plays the stepped build from screenshots. It is given only that persona's background, never the code or design doc. It thinks out loud and logs what it believes the rules are, its first click, its hesitations, each life lost and its stated cause. Afterwards it answers the six questions in [playtest.md](playtest.md). Each in-character agent is new and has never seen the game. Where it misreads a rule, that's a finding about the screen, not the agent. P1, P2, P3 and P5 are mostly this.

Order of work:

The starting point is commit `854b5a4` ("M4 and M5"). Commit each tool and each fix on its own, so every run and finding names a commit.

1. ~~Build the tools, prove the plants and run the existing tests.~~ Done Nov 23.
2. ~~Do the scripted runs for all personas and fix what fails, one fix at a time. Re-run the persona that failed, plus the one most likely to be broken by the fix (P7 after any input change, P9 after any visual one).~~ Done Nov 24.
3. ~~Have the in-character agents play. Rank findings by how many personas tripped on the same thing.~~ Done Nov 24 for P1, P2 and P5. Results and ranked findings: [persona-results.md](persona-results.md).
4. ~~Update [playtest.md](playtest.md): remove what the personas have settled, and keep the human sessions for P10 (sound), real difficulty and first impressions.~~ Done Nov 24.
5. Run the human sessions.

## 4. Open questions this should answer

- **Retune now or wait?** After the hit-rule fix the average bot reaches stage 11 and wins 37%. P2 and P3 give two more points of view, but the decision still waits for human runs. If the newcomer and hurried profiles also clear past stage 9, that's a reason to tighten stages 7–12 before the human sessions rather than after.
- **Freeze and Crossbeam** are the weakest upgrades on the bot (+0.7 and +0.8 stages). Does an in-character P3 find a use for them that the bot doesn't?
- **The turn control.** Do new players find right-click or Space without help, or does the tip need to come sooner or be louder?

## 5. Report

The results go in `docs/persona-results.md`, one section per persona:

- The build id and commit it ran on.
- Pass/fail for each check.
- Each finding with a screenshot path, how to repeat it, and whether it's fixed.
- For P10, the line "nobody has heard this".
- For motion claims, "read from frames, not watched at speed" unless a person watched.

Findings that several personas share go first.
