# Snowbound Signal

A cozy winter puzzle and management game for the OpenGame Game Jam 2026. You're a snowed-in town's only TV and gadget fixer, the night before the festival broadcast.

- Design: [docs/design.md](docs/design.md)
- Puzzle content: [docs/fault-library.md](docs/fault-library.md)
- Jam rules: [docs/jam-rules.md](docs/jam-rules.md)

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # static build to dist/
```

In dev:

- `http://localhost:5173/?fault=f07` jumps straight into any fault (`f01` to `f20`, plus the callback `cb12`) with the full kit.
- `http://localhost:5173/?night=3` starts that night with 200 coins; add `&callbacks` to bring in every Night 3 callback.

`npm run par` prints the balance report: Par for every night, with and without upgrades and callbacks, and the Par route.
