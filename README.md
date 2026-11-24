# Boxed In

A ball-trapping arcade puzzler with roguelite upgrades, made in Godot for the OpenGame Game Jam 2026. Grow walls to split the field, box every ball into a small enough pen, and level up into a new build each run.

- Design: [docs/design.md](docs/design.md)
- Build plan: [docs/plan.md](docs/plan.md)
- Jam rules: [docs/jam-rules.md](docs/jam-rules.md)
- Playtest guide: [docs/playtest.md](docs/playtest.md)
- Persona playtests (agents playing as different players): [docs/persona-playtest.md](docs/persona-playtest.md)

## Develop (Windows, command line only)

`dev.cmd` drives a portable Godot 4.7.2. On first use it downloads Godot (about 85 MB) and the web export templates (a 1.3 GB archive, of which only the two single-threaded web templates, about 20 MB, are kept) into `.tools\`, which is git-ignored. Nothing is installed system-wide.

```bat
dev -Setup        :: fetch Godot and the web templates, import the project
dev               :: play in a window
dev -Test         :: headless tests (exit code 1 on any failure)
dev -Balance      :: balance report: seeded bot runs at four skill tiers (--runs=N --out=docs/balance.md --real)
dev -Balance --strength :: how much each upgrade helps, on paired seeds (--out=docs/upgrade-strength.md)
dev -Sounds       :: regenerate the synthesised sound effects and music in audio\
dev -Shots --out=C:\temp\shots :: screenshot tour of every screen
dev -Web          :: export the web build to build\web, with receipt.json (file hashes)
dev -WebTest      :: export the test build (state, stepped clock, plants) to build\web-test
dev -Editor       :: open the Godot editor
dev -Godot ...    :: run Godot's console binary with any arguments
```

`dev -Godot --headless --path . --script res://scripts/dev/bench_capture.gd` times the slowest board step (a wall setting on a busy field).

The icon and loading splash are drawn by `dev -Godot --headless --path . --script res://scripts/dev/make_art.gd`.

Persona playtests in Chrome (after `npm install` in `testsrowser`):

```bat
cd testsrowser
node run.mjs                  :: every scripted persona; report in out\<time>esults.md
node run.mjs --only=P2,P4     :: some of them
node run.mjs --prove          :: show that every check catches its planted defect
node agent.mjs --persona=P2   :: a stepped session for an agent to play over HTTP
```

From PowerShell, use `.\dev.cmd` or `.\dev.ps1`. `opengame check --build` runs the web export itself (see `opengame.json`).
