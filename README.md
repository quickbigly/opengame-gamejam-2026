# Boxed In

A ball-trapping arcade puzzler with roguelite upgrades, made in Godot for the OpenGame Game Jam 2026. Grow walls to split the field, box every ball into a small enough pen, and level up into a new build each run.

- Design: [docs/design.md](docs/design.md)
- Build plan: [docs/plan.md](docs/plan.md)
- Jam rules: [docs/jam-rules.md](docs/jam-rules.md)
- Playtest guide: [docs/playtest.md](docs/playtest.md)

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
dev -Web          :: export the web build to build\web
dev -Editor       :: open the Godot editor
dev -Godot ...    :: run Godot's console binary with any arguments
```

The icon and loading splash are drawn by `dev -Godot --headless --path . --script res://scripts/dev/make_art.gd`.

From PowerShell, use `.\dev.cmd` or `.\dev.ps1`. `opengame check --build` runs the web export itself (see `opengame.json`).
