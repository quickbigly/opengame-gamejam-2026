// Playing the game through real input: menus by mouse or keyboard, walls from the advising bot
// (?autoplay=<tier>, scripts/core/bot.gd), upgrade picks by persona policy.
import * as h from "./lib.mjs";

/** Strongest first, from docs/upgrade-strength.md (same as STRENGTH_ORDER in balance.gd). */
const STRENGTH = ["thick_air", "hardened_tip", "quick_build", "close_call", "spare", "last_stretch", "study", "greed",
  "second_wind", "repel", "reroll", "twin_crews", "auto_lock", "snug_reward", "chain", "stun", "shrink", "loose_fit",
  "crossbeam", "freeze"];

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function toScreen(page, screen, timeoutMs = 10000) {
  return h.until(page, s => s.screen === screen, { what: `screen ${screen}`, timeoutMs });
}

/** Title -> intro, by clicking "Start run" (or Enter on the focused button with keys). */
export async function startRun(page, { keys = false } = {}) {
  const s = await toScreen(page, "TITLE");
  if (keys) await h.press(page, "Enter");
  else await h.clickControl(page, s, "Start run");
  return toScreen(page, "INTRO");
}

export async function beginStage(page, { keys = false } = {}) {
  const s = await toScreen(page, "INTRO");
  if (keys) await h.press(page, "Enter");
  else await h.clickControl(page, s, "Start stage");
  return toScreen(page, "PLAYING");
}

/** Does one piece of advice with real input: turn if needed (right-click, or Space with
 * keys), then click the cell (holding Shift for a + wall); or aim and press Q for an active. */
export async function doAdvice(page, s, advice, { keys = false } = {}) {
  if (advice.kind === "active") {
    await h.moveTo(page, ...h.cellCentre(s, advice.at[0], advice.at[1]));
    await h.press(page, "q");
    return;
  }
  if (!advice.cross && s.vertical !== advice.vertical) {
    if (keys) await h.press(page, "Space");
    else await h.clickAt(page, ...h.cellCentre(s, advice.cell[0] + 0.5, advice.cell[1] + 0.5), { button: "right" });
  }
  await h.clickCell(page, s, advice.cell[0], advice.cell[1], { shift: !!advice.cross });
}

/** Chooses a card: "random" or "stack" (held first, then strongest). */
export function choosePick(s, policy, rand) {
  const cards = s.controls.filter(c => c.upgrade);
  if (!cards.length) return -1;
  if (policy !== "stack") return Math.floor(rand() * cards.length);
  const held = s.run.upgrades;
  const key = c => (held[c.upgrade] ?? 0) * 100 - (STRENGTH.indexOf(c.upgrade) + 1 || STRENGTH.length);
  return cards.indexOf(cards.reduce((a, b) => key(b) > key(a) ? b : a));
}

/** One move from wherever the game is: follow new advice in play, step a stepped clock,
 * press through menus, pick upgrades. `ctx` carries options and the last advice done
 * ({keys, picks, rand, stepped, chunk, lastAdvice}). */
export async function tick(page, s, ctx) {
  switch (s.screen) {
    case "TITLE": await startRun(page, ctx); break;
    case "INTRO": await beginStage(page, ctx); ctx.lastAdvice = 0; break;
    case "PLAYING": {
      const fresh = (s.advice ?? []).filter(a => a.id > ctx.lastAdvice);
      for (const a of fresh) { await doAdvice(page, s, a, ctx); ctx.lastAdvice = a.id; }
      if (ctx.stepped) await h.step(page, ctx.chunk ?? 4);
      else await h.sleep(page, 25);
      break;
    }
    case "ENDING": if (ctx.stepped) await h.step(page, 30); else await h.sleep(page, 100); break;
    case "CLEAR": {
      if (ctx.keys) await h.press(page, "Enter");
      else await h.clickControl(page, s, /^(Pick upgrade|Next stage)$/);
      await h.until(page, n => n.screen !== "CLEAR", { what: "leave clear" });
      break;
    }
    case "PICK": {
      const i = choosePick(s, ctx.picks, ctx.rand);
      const before = s.run.pending_levels;
      if (ctx.keys) await h.press(page, String(i + 1));
      else { const c = s.controls.filter(c => c.upgrade)[i]; await h.clickAt(page, c.rect[0] + c.rect[2] / 2, c.rect[1] + c.rect[3] / 2); }
      await h.until(page, n => n.screen !== "PICK" || n.run.pending_levels < before, { what: "pick taken" });
      break;
    }
    case "PAUSED": if (ctx.keys) await h.press(page, "p"); else await h.clickControl(page, s, "Resume"); break;
    default: await h.sleep(page, 50);
  }
}

/** Plays from wherever the game is until stop(s) is true or the run ends (OVER). Walls come
 * from the advising bot; menus are clicked (or keyed with keys). stepped: drive the stepped
 * clock in chunks of `chunk` steps. onState(s) sees every state read. Returns the last state. */
export async function play(page, { keys = false, picks = "random", seed = 1, stop = () => false, timeoutMs = 600000,
  stepped = false, chunk = 4, onState = () => {} } = {}) {
  const ctx = { keys, picks, rand: rng(seed), stepped, chunk, lastAdvice: 0 };
  const start = Date.now();
  let s = await h.state(page);
  for (const a of s.advice ?? []) ctx.lastAdvice = Math.max(ctx.lastAdvice, a.id);
  while (Date.now() - start < timeoutMs) {
    s = await h.state(page);
    onState(s);
    if (stop(s) || s.screen === "OVER") return s;
    await tick(page, s, ctx);
  }
  throw new Error(`play timed out after ${timeoutMs / 1000} s on ${s?.screen} (stage ${s?.stage})`);
}

/** Stepped clock only: makes a ball break a wall on purpose, by starting one just ahead of it.
 * Returns the state after the life is lost, with `warned` set when the wall showed its danger
 * outline first, or null if eight tries didn't manage it. */
export async function breakWall(page, { aheads = [1.5, 2.5, 1, 3] } = {}) {
  let warned = false;
  let s = await h.state(page);
  const lives = s.board.lives;
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = 0; i < 60 && s.board.walls_building > 0 && s.board.state === "PLAYING"; i++) { await h.step(page, 10); s = await h.state(page); }
    if (s.board.state !== "PLAYING") return null;
    const balls = s.board.balls.filter(b => !b.locked);
    const ball = balls[attempt % balls.length];
    const ahead = aheads[Math.floor(attempt / balls.length) % aheads.length];
    const cx = Math.floor(ball.x + Math.sign(ball.vx) * ahead), cy = Math.floor(ball.y + Math.sign(ball.vy) * ahead);
    if (s.board.rows[cy]?.[cx] !== ".") { await h.step(page, 6); s = await h.state(page); continue; }
    await h.clickCell(page, s, cx, cy);
    warned = false;
    for (let i = 0; i < 120; i++) {
      await h.step(page, 1); // one step at a time, so the caller sees the very frame of the hit
      s = await h.state(page);
      if (s.board.lives < lives || s.board.state !== "PLAYING") return { ...s, warned };
      if (s.effects.danger > 0) warned = true;
    }
  }
  return null;
}
