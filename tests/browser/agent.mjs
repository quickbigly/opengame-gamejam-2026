// A browser an agent can play in character, one command at a time, over HTTP on localhost.
// The game runs on the stepped clock, so nothing moves while the agent looks and thinks: game
// time passes only on /wait. The agent sees only screenshots, like a player; everything the
// game knows is logged to log.jsonl beside them for whoever reads the session afterwards.
//
//   node agent.mjs --persona=P2 [--port=5190] [--reduced] [--colorblind-filter=deuteranopia]
//
// Commands (canvas pixels: the game is drawn at 1280x720, top left 0,0):
//   GET /look                       screenshot; returns its file path
//   GET /click?x=640&y=360          left click (button=right for right-click; shift=1 holds Shift)
//   GET /key?k=Space                press a key (Enter, Escape, Space, p, q, Tab, 1, ArrowDown...)
//   GET /wait?ms=500                let 500 ms of game time pass (menus: real time)
//   GET /quit                       end the session
import { createServer } from "node:http";
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import * as h from "./lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const persona = String(args.persona ?? "agent");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = join(h.ROOT, "tests/browser/out", `agent-${persona}-${stamp}`);
await mkdir(out, { recursive: true });

const game = await h.serve(h.BUILDS.test);
const build = await h.checkReceipt(game.url, h.BUILDS.test);
const b = await h.launch({ reducedMotion: !!args.reduced, headed: !!args.headed });
if (args["colorblind-filter"]) await b.cdp.send("Emulation.setEmulatedVisionDeficiency", { type: args["colorblind-filter"] });
await h.boot(b.page, game.url + `?step&persona=${encodeURIComponent(persona)}`);
let shots = 0;
const started = Date.now();

async function log(command, extra = {}) {
  const s = await h.state(b.page);
  const { rows, ...board } = s?.board ?? {};
  await appendFile(join(out, "log.jsonl"), JSON.stringify({ t: (Date.now() - started) / 1000, command, ...extra,
    screen: s?.screen, stage: s?.stage, lives: s?.lives, score: s?.score, tip: s?.tip, vertical: s?.vertical,
    walls_started: board.walls_started, pens: board.pens, balls: board.balls?.length, time: board.time }) + "\n");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const q = Object.fromEntries(url.searchParams);
  let reply = "ok";
  try {
    switch (url.pathname) {
      case "/look": {
        const path = join(out, `${String(++shots).padStart(3, "0")}.png`);
        await b.page.screenshot({ path });
        reply = path;
        break;
      }
      case "/click":
        await h.clickAt(b.page, Number(q.x), Number(q.y), { button: q.button === "right" ? "right" : "left", shift: q.shift === "1" });
        await b.page.waitForTimeout(80);
        break;
      case "/key":
        await h.press(b.page, q.k);
        await b.page.waitForTimeout(80);
        break;
      case "/wait": {
        const ms = Math.max(0, Math.min(10000, Number(q.ms ?? 500)));
        const s = await h.state(b.page);
        if (s.screen === "PLAYING" || s.screen === "ENDING") {
          const before = s.test.steps_taken, n = Math.round(ms * 120 / 1000);
          await b.page.evaluate(k => window.boxedInStep(k), n);
          await h.until(b.page, x => x.test.steps_pending === 0 || x.screen !== s.screen, { what: "wait", timeoutMs: 20000 });
          if ((await h.state(b.page)).test.steps_taken < before + n) await b.page.waitForTimeout(50);
        } else await b.page.waitForTimeout(ms);
        break;
      }
      case "/quit":
        reply = `session over; log at ${join(out, "log.jsonl")}`;
        setTimeout(async () => { await b.close(); await game.close(); server.close(); }, 100);
        break;
      default:
        res.writeHead(404).end("unknown command");
        return;
    }
    await log(url.pathname + url.search);
  } catch (e) {
    reply = `error: ${e.message.split("\n")[0]}`;
  }
  res.writeHead(200, { "Content-Type": "text/plain" }).end(reply + "\n");
});
const port = Number(args.port ?? 5190);
server.listen(port, "127.0.0.1", () => console.log(`Agent session for ${persona} on build ${build}: http://127.0.0.1:${port}/  (output ${out})`));
