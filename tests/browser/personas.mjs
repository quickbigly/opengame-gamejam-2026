// The scripted persona playtests (docs/persona-playtest.md, section 1). Each persona plays
// through real input and records checks with ctx.check(id, pass, detail, evidence). A check
// that throws is recorded as failed ("incomplete" never reads as a pass).
import { readFile } from "node:fs/promises";
import * as h from "./lib.mjs";
import * as px from "./pixels.mjs";
import { play, tick, rng, startRun, beginStage, breakWall, toScreen, doAdvice } from "./play.mjs";

const BAD = px.hex("ff5d73");
const TEXT = px.hex("e8ecf4");
const GOOD = { default: px.hex("7fd8be"), colorblind: px.hex("f0e442") };

const query = (ctx, flags) => {
  const all = { ...flags, persona: ctx.persona };
  if (ctx.plants.length) all.plant = ctx.plants.join(",");
  return "?" + Object.entries(all).map(([k, v]) => v === true ? k : `${k}=${encodeURIComponent(v)}`).join("&");
};

const noErrors = b => [...b.log.errors, ...b.log.console.filter(l => /^error:|SCRIPT ERROR|ERROR:/.test(l))];

/** Open cells grouped into regions (flood fill over the state's rows). */
function regions(s) {
  const rows = s.board.rows, H = rows.length, W = rows[0].length, id = rows.map(r => Array(W).fill(-1));
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (rows[y][x] !== "." || id[y][x] >= 0) continue;
    const cells = [], stack = [[x, y]]; id[y][x] = out.length;
    while (stack.length) {
      const [cx, cy] = stack.pop(); cells.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (ny >= 0 && ny < H && nx >= 0 && nx < W && rows[ny][nx] === "." && id[ny][nx] < 0) { id[ny][nx] = out.length; stack.push([nx, ny]); }
      }
    }
    out.push(cells);
  }
  return { list: out, at: (x, y) => id[Math.floor(y)]?.[Math.floor(x)] ?? -1 };
}

/** A cell of a region whose neighbours are all open, as far as possible from balls and the
 * meter at `avoid` (in cells). */
function quietCell(s, cells, avoid) {
  const rows = s.board.rows;
  let best = null, bestScore = -1;
  for (const [x, y] of cells) {
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => rows[y + dy]?.[x + dx] === ".")) continue;
    const near = Math.min(...s.board.balls.map(b => Math.hypot(b.x - x - 0.5, b.y - y - 0.5)), Math.hypot(avoid[0] - x - 0.5, (avoid[1] - y - 0.5) * 2));
    if (near > bestScore) { bestScore = near; best = [x, y]; }
  }
  return bestScore >= 2.5 ? best : null;
}

async function pngOf(path) { return px.decodePng(await readFile(path)); }

// --- P1: a jam judge in a hurry -----------------------------------------------------------------

export async function P1(ctx) {
  const b = await h.launch(ctx.launch);
  try {
    const bootS = await h.boot(b.page, ctx.url + query(ctx, { autoplay: "hurried" }));
    ctx.note(`Cold load to title: ${bootS.toFixed(1)} s (test build, local, no throttle).`);
    await h.shot(b.page, ctx.out, "P1-title");
    await startRun(b.page);
    await beginStage(b.page);
    const played = Date.now();
    await h.sleep(b.page, 1000);
    let s = await h.state(b.page);
    const frame = await h.shot(b.page, ctx.out, "P1-one-second-after-play");
    ctx.check("frame 1 s after Play shows the field, HUD and a tip", s.screen === "PLAYING" && s.board.balls.length > 0 && s.tip !== "",
      `screen ${s.screen}, ${s.board?.balls.length} balls, tip "${s.tip}"`, frame);

    // A judge's first click lands on open space away from the ball: it should build a wall.
    const ball = s.board.balls[0];
    const target = [ball.x < 24 ? 36 : 12, ball.y < 16 ? 24 : 8];
    const before = s.board.walls_started;
    await h.clickCell(b.page, s, ...target);
    s = await h.until(b.page, n => n.board?.walls_started > before || Date.now() - played > 3000, { what: "first wall" });
    ctx.check("first click on open space builds a wall", s.board.walls_started > before, `walls started ${before} -> ${s.board.walls_started}`);

    s = await play(b.page, { stop: n => n.stage >= 2, timeoutMs: 180000, seed: ctx.seed });
    const stage1 = (Date.now() - played) / 1000;
    ctx.check("stage 1 cleared within 3 minutes", s.stage >= 2, `${s.stage >= 2 ? "cleared" : "not cleared"} after ${stage1.toFixed(0)} s (hurried bot, real time)`);

    const left = Math.max(1000, 300000 - (Date.now() - played));
    s = await play(b.page, { stop: () => false, timeoutMs: left, seed: ctx.seed + 1 }).catch(() => h.state(b.page));
    await h.shot(b.page, ctx.out, "P1-after-5-minutes");
    ctx.note(`After 5 minutes: ${s.screen}, stage ${s.stage}, score ${s.score}, lives ${s.lives}.`);
    const errors = noErrors(b);
    ctx.check("no errors in a 5-minute session", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
  } finally { await b.close(); }
}

// --- P2: new to the genre -----------------------------------------------------------------------

export async function P2(ctx) {
  const b = await h.launch(ctx.launch);
  try {
    await h.boot(b.page, ctx.url + query(ctx, { step: true, autoplay: "newcomer" }));
    await startRun(b.page);
    await beginStage(b.page);
    let s = await h.until(b.page, n => n.tip !== "", { what: "first tip", timeoutMs: 2000 }).catch(() => h.state(b.page));
    ctx.check("the first tip teaches building", /click/i.test(s.tip), `tip: "${s.tip}"`);

    // The meter, read off the screen with the ball well away from it.
    for (let i = 0; i < 40; i++) {
      const pen = s.board.pens[0];
      if (Math.min(...s.board.balls.map(bl => Math.hypot(bl.x - pen.centre[0], bl.y - pen.centre[1]))) > 5) break;
      await h.step(b.page, 6); s = await h.state(b.page);
    }
    const meter = s.effects.meters[0]; // where the game drew it: [x, y, w, h], text at the middle
    const [mx, my] = [meter[0] + meter[2] / 2, meter[1] + 28];
    const meterShot = await h.shot(b.page, ctx.out, "P2-meter");
    const lit = px.count(await pngOf(meterShot), [Math.round(mx - 60), Math.round(my - 14), 120, 30], TEXT, 30);
    ctx.check("the pen meter (area / limit) is drawn", lit > 40, `${lit} text pixels where the meter should be`, meterShot);

    // Right-click turns.
    const vertical = s.vertical;
    await h.clickAt(b.page, mx, my + 80, { button: "right" });
    await h.sleep(b.page, 100); s = await h.state(b.page);
    ctx.check("right-click turns the wall", s.vertical !== vertical, `vertical ${vertical} -> ${s.vertical}`);
    if (s.vertical !== vertical) await h.press(b.page, "Space");

    // A click on open space away from the ball builds; then the tip moves on to turning.
    const ball = s.board.balls[0];
    const before = s.board.walls_started;
    await h.clickCell(b.page, s, ball.x < 24 ? 38 : 10, ball.y < 16 ? 26 : 6);
    await h.step(b.page, 2); s = await h.state(b.page);
    ctx.check("a click on open space builds a wall", s.board.walls_started > before, `walls started ${before} -> ${s.board.walls_started}`);
    ctx.note(`Tip after the first wall: "${s.tip}"`);

    // While that wall builds, hovering elsewhere must not paint a red path (P1 and P2 read it
    // as "where the wall will end"). Hover a row the wall and balls aren't on.
    {
      const row = s.board.balls[0].y < 16 ? 20 : 11;
      await h.moveTo(b.page, ...h.cellCentre(s, 24.5, row + 0.5));
      await h.step(b.page, 1); s = await h.state(b.page);
      const shotPath = await h.shot(b.page, ctx.out, "P2-busy-preview");
      const img = await pngOf(shotPath);
      const [, y] = h.cellCentre(s, 0, row + 0.5);
      const red = px.countWhere(img, [180, Math.round(y - 6), 920, 12], ([r, g, bl]) => r > g + 20 && r > bl + 10);
      ctx.check("no red path while a wall builds", s.board.walls_building > 0 && red < 60,
        `preview "${s.effects.preview}", ${red} reddish pixels along the hovered row (walls building ${s.board.walls_building})`, shotPath);
    }

    // The next wall's direction shows off the field too: the mark beside "turn" changes with Space.
    {
      const before = await pngOf(await h.shot(b.page, ctx.out, "P2-direction-before"));
      await h.press(b.page, "Space"); await h.step(b.page, 1);
      const afterPath = await h.shot(b.page, ctx.out, "P2-direction-after");
      const after = await pngOf(afterPath);
      let changed = 0;
      for (let y = 124; y < 160; y++) for (let x = 60; x < 120; x++) if (px.distance(px.pixel(before, x, y), px.pixel(after, x, y)) > 60) changed++;
      await h.press(b.page, "Space"); await h.step(b.page, 1);
      ctx.check("the HUD shows which way the next wall grows", changed > 20, `${changed} pixels changed beside "turn" when Space turned the wall`, afterPath);
    }

    // A life lost is visible: red flash on the field.
    s = await breakWall(b.page);
    if (!s) ctx.check("a life lost shows a red flash", false, "could not make a ball break a wall");
    else {
      const flashShot = await h.shot(b.page, ctx.out, "P2-life-lost");
      const img = await pngOf(flashShot);
      // The field's frame turns red: count clearly red pixels along its top and bottom edges.
      const reddish = ([r, g, bl]) => r > 120 && r > g + 60 && r > bl + 40;
      const red = px.countWhere(img, [140, 50, 1000, 20], reddish) + px.countWhere(img, [140, 690, 1000, 24], reddish);
      ctx.check("a life lost shows a red flash", red > 300 && s.effects.flash > 0.3, `${red} red border pixels, flash ${s.effects.flash}`, flashShot);
      // A wall started right on a ball is hit at once; the warning matters for one it runs into.
      const far = await breakWall(b.page, { aheads: [3.5, 4, 3] });
      ctx.check("a growing wall warns before a ball hits it", !!far?.warned,
        far ? (far.warned ? "the danger outline showed before a ball ran into a wall started 3+ cells ahead of it" : "no warning before the hit") : "incomplete: no ball ran into the wall");
    }

    // How far the newcomer bot gets is one seed's worth of balance evidence, not a pass/fail:
    // dev -Balance --tiers=newcomer gives the spread over many seeds. On the way, with tips on
    // (stages 1 and 2), measure the longest a ball sits under the tip box.
    let covered = 0, worstCover = 0, coverAt = "", near = 0, meterLooks = 0, meterHits = 0, meterAt = "";
    const watch = n => {
        const box = n.effects?.tip_box;
        const inside = (m) => n.screen === "PLAYING" && box?.length >= 4 && n.board.balls.some(bl => {
          const [x, y] = h.cellCentre(n, bl.x, bl.y); return x >= box[0] - m && x <= box[0] + box[2] + m && y >= box[1] - m && y <= box[1] + box[3] + m; });
        // Hidden: under the box while it's solid (a box faded to let play show through doesn't hide it).
        const under = inside(0) && (box[4] ?? 0) < 0.5;
        // Chances to cover a ball: one near either edge of the field, where the tip can sit.
        if (box?.length >= 4 && n.screen === "PLAYING" && n.board.balls.some(bl => bl.y < 6 || bl.y > n.board.rows.length - 6)) near++;
        if (n.screen === "PLAYING" && n.board.halves.length) {
          meterLooks++;
          const walls = n.board.halves.map(hf => { const [x, y] = h.cellCentre(n, hf.rect[0], hf.rect[1]); return [x, y, hf.rect[2] * n.field.cell, hf.rect[3] * n.field.cell]; });
          const overlap = (a, c) => a[0] < c[0] + c[2] && c[0] < a[0] + a[2] && a[1] < c[1] + c[3] && c[1] < a[1] + a[3];
          if ((n.effects.meters ?? []).some(m => walls.some(wl => overlap(m, wl)))) { meterHits++; meterAt = meterAt || `stage ${n.stage}, ${n.board.time.toFixed(1)} s`; }
        }
        if (under) { covered = covered || n.board.time; const span = n.board.time - covered; if (span > worstCover) { worstCover = span; coverAt = `stage ${n.stage}`; } }
        else covered = 0;
      };
    const firstRun = await play(b.page, { stepped: true, chunk: 8, stop: n => n.stage >= 3, timeoutMs: 480000, seed: ctx.seed, onState: watch });
    s = firstRun;
    // Keep playing new runs (tips stay on until stage 2 is cleared) until the tip check has had
    // enough chances to measure.
    for (let again = 1; again < 4 && near < 50 && s.screen === "OVER"; again++) {
      await h.clickControl(b.page, s, "Play again");
      s = await play(b.page, { stepped: true, chunk: 8, stop: n => n.stage >= 3 || near >= 50, timeoutMs: 300000, seed: ctx.seed + again, onState: watch });
    }
    // A ball crossing under a box that never moves stays about 0.9 s; the box should move within 0.4 s.
    ctx.check("the tip box never hides a ball for more than 0.6 s", near >= 3 && worstCover <= 0.6,
      near >= 3 ? `longest a ball sat under the tip: ${worstCover.toFixed(2)} s of play${coverAt ? ` (${coverAt})` : ""}; ${near} looks with a tip up and a ball near an edge of the field`
        : `incomplete: only ${near} looks had a tip up and a ball near an edge`);
    await h.shot(b.page, ctx.out, "P2-end");
    ctx.check("pen meters stay off growing walls", meterLooks >= 20 && meterHits === 0,
      meterLooks >= 20 ? `${meterHits} of ${meterLooks} looks with a wall growing had a meter on it${meterAt ? ` (first: ${meterAt})` : ""}` : `incomplete: only ${meterLooks} looks with a wall growing`);
    ctx.note(`Newcomer bot (one seed, after one life thrown away on purpose): ${firstRun.screen}, stage ${firstRun.stage}, lives ${firstRun.lives}.`);
    const errors = noErrors(b);
    ctx.check("no errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
  } finally { await b.close(); }
}

// --- P3: genre veteran, min-maxer ---------------------------------------------------------------

export async function P3(ctx) {
  const b = await h.launch(ctx.launch);
  try {
    await h.boot(b.page, ctx.url + query(ctx, { autoplay: "minmaxer" }));
    const t0 = Date.now();
    let s = await play(b.page, { picks: "stack", timeoutMs: 25 * 60000, seed: ctx.seed });
    const minutes = (Date.now() - t0) / 60000;
    const won = s.screen === "OVER" && s.stage >= 12 && !!h.control(s, "Endless");
    await h.shot(b.page, ctx.out, "P3-end-of-run");
    ctx.check("wins within 25 minutes", won, `${won ? "won" : "lost"} on stage ${s.stage} after ${minutes.toFixed(1)} min, score ${s.score}`);
    ctx.note(`Held at the end: ${JSON.stringify(s.run?.upgrades)}`);
    if (won) {
      await h.clickControl(b.page, s, "Endless");
      const scores = [];
      s = await play(b.page, { picks: "stack", seed: ctx.seed + 1, timeoutMs: 8 * 60000,
        stop: n => { if (n.screen === "INTRO" && scores.at(-1)?.[0] !== n.stage) scores.push([n.stage, n.score]); return n.stage >= 16; } });
      const rising = scores.every((x, i) => i === 0 || x[1] >= scores[i - 1][1]);
      ctx.check("Endless keeps going and score keeps rising", s.stage >= 14 && rising, `reached ${s.stage} (${s.screen}); scores at each intro: ${scores.map(x => x.join(":")).join(", ")}`);
    }
    const errors = noErrors(b);
    ctx.check("no errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
  } finally { await b.close(); }
}

// --- P4: keyboard first -------------------------------------------------------------------------

export async function P4(ctx) {
  const b = await h.launch(ctx.launch);
  const p = b.page;
  try {
    await h.boot(p, ctx.url + query(ctx, { autoplay: "average" }));
    await h.clickAt(p, 640, 700); // a person clicks into the game frame once to give it the keys
    let s = await h.state(p);
    ctx.check("title has a visibly focused button", s.controls.some(c => c.focused), s.controls.map(c => `${c.text}${c.focused ? "*" : ""}`).join(" "));
    await h.press(p, "ArrowDown"); await h.sleep(p, 100); s = await h.state(p);
    const onSettings = s.controls.find(c => c.focused)?.text === "Settings";
    await h.press(p, "Enter"); await h.sleep(p, 150); s = await h.state(p);
    const opened = s.settings && s.controls.some(c => c.focused);
    await h.shot(p, ctx.out, "P4-settings");
    await h.press(p, "Escape"); await h.sleep(p, 150); s = await h.state(p);
    ctx.check("settings open and close by keys (Down, Enter, Esc)", onSettings && opened && !s.settings && s.screen === "TITLE",
      `focus on Settings ${onSettings}, opened with focus ${opened}, back on ${s.screen}`);

    await h.press(p, "ArrowUp"); await h.sleep(p, 100);
    await startRun(p, { keys: true });
    s = await beginStage(p, { keys: true });
    ctx.check("a run starts by keys alone", s.screen === "PLAYING", s.screen);

    await h.press(p, "Escape"); await h.sleep(p, 150); s = await h.state(p);
    ctx.check("Esc during play pauses (never quits)", s.screen === "PAUSED", `after Esc: ${s.screen}`);
    if (s.screen === "TITLE") return;
    await h.shot(p, ctx.out, "P4-paused");
    await h.press(p, "Escape"); await h.sleep(p, 150); s = await h.state(p);
    const escResumes = s.screen === "PLAYING";
    await h.press(p, "p"); await h.sleep(p, 150); const pPauses = (await h.state(p)).screen === "PAUSED";
    await h.press(p, "p"); await h.sleep(p, 150); const pResumes = (await h.state(p)).screen === "PLAYING";
    ctx.check("Esc resumes, P pauses and resumes", escResumes && pPauses && pResumes, `Esc resumes ${escResumes}, P pauses ${pPauses}, P resumes ${pResumes}`);

    // Quit to title asks twice.
    await h.press(p, "p"); await h.sleep(p, 150);
    for (let i = 0; i < 3; i++) { await h.press(p, "ArrowDown"); await h.sleep(p, 60); }
    s = await h.state(p);
    const quitFocused = /Quit/.test(s.controls.find(c => c.focused)?.text ?? "");
    await h.press(p, "Enter"); await h.sleep(p, 150); s = await h.state(p);
    const armed = s.screen === "PAUSED" && /Press again/.test(s.controls.find(c => c.focused)?.text ?? "");
    await h.press(p, "ArrowUp"); await h.sleep(p, 60);
    for (let i = 0; i < 3; i++) { await h.press(p, "ArrowUp"); await h.sleep(p, 60); }
    await h.press(p, "Enter"); await h.sleep(p, 150); s = await h.state(p);
    ctx.check("Quit to title asks before quitting", quitFocused && armed && s.screen === "PLAYING",
      `Quit focused ${quitFocused}, first Enter armed it and stayed paused ${armed}, back to ${s.screen}`);

    // Play by keys (Space to turn, mouse only for walls) until an upgrade pick, then pick with 1.
    s = await play(p, { keys: true, seed: ctx.seed, timeoutMs: 300000, stop: n => n.screen === "PICK" });
    for (let again = 1; again < 4 && s.screen === "OVER"; again++) {
      await h.press(p, "ArrowDown"); await h.sleep(p, 80); // "Play again" by keys (Endless only shows after a win)
      s = await h.state(p);
      const focused = s.controls.find(c => c.focused)?.text;
      if (focused !== "Play again") { await h.clickControl(p, s, "Play again"); }
      else await h.press(p, "Enter");
      s = await play(p, { keys: true, seed: ctx.seed + again, timeoutMs: 300000, stop: n => n.screen === "PICK" });
    }
    if (s.screen !== "PICK") { ctx.check("upgrade pick by keys", false, `never reached a pick (${s.screen}, stage ${s.stage})`); return; }
    await h.shot(p, ctx.out, "P4-pick");
    const offer = s.run.offer.join(",");
    if (s.run.rerolls_left > 0) {
      await h.press(p, "r"); await h.sleep(p, 150); s = await h.state(p);
      ctx.check("R rerolls the offer", s.run.offer.join(",") !== offer || s.run.offer.length < 3, `${offer} -> ${s.run.offer.join(",")}`);
    }
    const stacks = Object.values(s.run.upgrades).reduce((a, n) => a + n, 0);
    const pending = s.run.pending_levels;
    await h.press(p, "1"); await h.sleep(p, 200); s = await h.state(p);
    const after = Object.values(s.run.upgrades).reduce((a, n) => a + n, 0);
    ctx.check("one key press, one upgrade", after - stacks === 1 && s.run.pending_levels === pending - 1,
      `upgrades held ${stacks} -> ${after}, pending ${pending} -> ${s.run.pending_levels}`);
    const errors = noErrors(b);
    ctx.check("no errors", errors.length === 0, errors.slice(0, 3).join(" | ") || "none");
  } finally { await b.close(); }
}

// --- P5: colour-blind ---------------------------------------------------------------------------

const VISION = ["none", "deuteranopia", "protanopia", "tritanopia", "achromatopsia"];

export async function P5(ctx) {
  for (const palette of ["default", "colorblind"]) {
    const b = await h.launch(ctx.launch);
    try {
      await h.boot(b.page, ctx.url + query(ctx, { step: true, autoplay: "average" }));
      let s = await h.state(b.page);
      if (palette === "colorblind") {
        await h.clickControl(b.page, s, "Settings");
        s = await h.until(b.page, n => n.settings, { what: "settings" });
        await h.clickControl(b.page, s, { setting: "colorblind" });
        await h.sleep(b.page, 150); s = await h.state(b.page);
        await h.clickControl(b.page, s, "Back");
        await toScreen(b.page, "TITLE");
      }
      // Play stage 1 and into stage 2 until one pen is locked and another isn't.
      const both = n => n.screen === "PLAYING" && n.board.pens.some(q => q.locked && q.area >= 8) && n.board.pens.some(q => !q.locked && q.area >= 12);
      for (let run = 0; run < 3; run++) {
        s = await play(b.page, { stepped: true, chunk: 3, seed: ctx.seed + run, timeoutMs: 300000, stop: both });
        if (both(s)) break;
        await h.clickControl(b.page, s, "Play again");
      }
      if (s.screen !== "PLAYING") { ctx.check(`${palette}: locked and open pens tell apart`, false, `no scene with both (${s.screen}, stage ${s.stage})`); continue; }
      await h.shot(b.page, ctx.out, `P5-${palette}-lock-pulse`); // judged by eye: the boxed ball against its pulsing pen
      // Let the lock pulse finish (effects run on the stepped clock) so the resting colours are judged.
      await h.step(b.page, 130);
      s = await h.state(b.page);
      if (!both(s)) { ctx.check(`${palette}: locked and open pens tell apart`, false, "the scene changed while the pulse faded"); continue; }
      const reg = regions(s);
      const locked = s.board.pens.find(q => q.locked && q.area >= 12), open = s.board.pens.find(q => !q.locked && q.area >= 20);
      const cellOf = pen => {
        const ballIn = s.board.balls.find(bl => (bl.locked === pen.locked) && reg.at(bl.x, bl.y) >= 0 && reg.list[reg.at(bl.x, bl.y)].length === pen.area);
        const id = ballIn ? reg.at(ballIn.x, ballIn.y) : reg.list.findIndex(c => c.length === pen.area);
        return id >= 0 ? quietCell(s, reg.list[id], pen.centre) : null;
      };
      const lc = cellOf(locked), oc = cellOf(open);
      if (!lc || !oc) { ctx.check(`${palette}: locked and open pens tell apart`, false, "no quiet cell to sample in one of the pens"); continue; }
      const worst = [];
      for (const vision of VISION) {
        await b.cdp.send("Emulation.setEmulatedVisionDeficiency", { type: vision === "none" ? "none" : vision });
        await h.sleep(b.page, 100);
        const path = await h.shot(b.page, ctx.out, `P5-${palette}-${vision}`);
        const img = await pngOf(path);
        const a = px.mean(img, ...h.cellCentre(s, lc[0] + 0.5, lc[1] + 0.5), 3), o = px.mean(img, ...h.cellCentre(s, oc[0] + 0.5, oc[1] + 0.5), 3);
        const [lx, ly] = h.cellCentre(s, locked.centre[0], locked.centre[1]);
        const padlock = vision === "none" ? px.count(img, [Math.round(lx - 10), Math.round(ly - 30), 20, 18], GOOD[palette], 50) : null;
        worst.push({ vision, distance: px.distance(a, o), padlock, path });
      }
      await b.cdp.send("Emulation.setEmulatedVisionDeficiency", { type: "none" });
      const min = worst.reduce((m, w) => w.distance < m.distance ? w : m);
      ctx.check(`${palette}: locked pen differs from open space under every vision type`, min.distance >= 18,
        worst.map(w => `${w.vision} ${w.distance.toFixed(0)}`).join(", ") + " (RGB distance, pass >= 18)", min.path);
      const pad = worst[0].padlock;
      ctx.check(`${palette}: locked pen has a padlock (not hue alone)`, pad > 20, `${pad} padlock pixels`, worst[0].path);
    } finally { await b.close(); }
  }
}

// --- P6: motion-sensitive -----------------------------------------------------------------------

async function shakeAfterBreak(ctx, b, label) {
  let s = await startRun(b.page).then(() => beginStage(b.page));
  s = await breakWall(b.page);
  if (!s) return null;
  const samples = [];
  for (let i = 0; i < 8; i++) { const n = await h.state(b.page); samples.push(n.effects); await h.sleep(b.page, 30); }
  await h.shot(b.page, ctx.out, `P6-${label}`);
  return { moved: Math.max(...samples.map(e => Math.hypot(...e.offset))), particles: Math.max(...samples.map(e => e.particles)),
    rings: Math.max(...samples.map(e => e.rings)), reduced: s.settings_values.reduced_motion };
}

export async function P6(ctx) {
  // Control: with motion on, the instrument must see shake, or the checks below prove nothing.
  let b = await h.launch(ctx.launch);
  try {
    await h.boot(b.page, ctx.url + query(ctx, { step: true }));
    const r = await shakeAfterBreak(ctx, b, "motion-on");
    ctx.check("control: with motion on, a break shakes and bursts", r && r.moved > 0.5 && r.particles > 0, r ? `offset ${r.moved.toFixed(1)} px, ${r.particles} particles` : "no break");
  } finally { await b.close(); }

  b = await h.launch({ ...ctx.launch, reducedMotion: true });
  try {
    await h.boot(b.page, ctx.url + query(ctx, { step: true }));
    const r = await shakeAfterBreak(ctx, b, "system-reduced");
    ctx.check("the browser's reduced-motion preference turns it on", r?.reduced === true, `reduced_motion ${r?.reduced}`);
    ctx.check("system reduced motion: no shake, particles or rings", r && r.moved === 0 && r.particles === 0 && r.rings === 0,
      r ? `offset ${r.moved.toFixed(1)} px, ${r.particles} particles, ${r.rings} rings` : "no break");
  } finally { await b.close(); }

  b = await h.launch(ctx.launch);
  try {
    await h.boot(b.page, ctx.url + query(ctx, { step: true }));
    let s = await h.state(b.page);
    await h.clickControl(b.page, s, "Settings");
    s = await h.until(b.page, n => n.settings, { what: "settings" });
    await h.clickControl(b.page, s, { setting: "reduced_motion" });
    await h.sleep(b.page, 150); s = await h.state(b.page);
    await h.clickControl(b.page, s, "Back");
    await toScreen(b.page, "TITLE");
    const r = await shakeAfterBreak(ctx, b, "setting-reduced");
    ctx.check("game setting reduced motion: no shake, particles or rings", r && r.reduced && r.moved === 0 && r.particles === 0 && r.rings === 0,
      r ? `reduced ${r.reduced}, offset ${r.moved.toFixed(1)} px, ${r.particles} particles, ${r.rings} rings` : "no break");
  } finally { await b.close(); }
}

// --- P7: chaos player ---------------------------------------------------------------------------

export async function P7(ctx) {
  const b = await h.launch(ctx.launch);
  const p = b.page;
  const rand = rng(ctx.seed);
  const actions = [];
  const sizes = [{ width: 1280, height: 720 }, { width: 1000, height: 700 }, { width: 1600, height: 900 }, { width: 800, height: 600 }];
  try {
    await h.boot(p, ctx.url + query(ctx, { autoplay: "average" }));
    const play_ = { keys: false, picks: "random", rand, stepped: false, lastAdvice: 0 };
    const chaos = [
      ["click", async s => { const x = 1 + Math.floor(rand() * 46), y = 1 + Math.floor(rand() * 30); await h.clickCell(p, s, x, y); return `click ${x},${y}`; }],
      ["right", async () => { await h.clickAt(p, 640, 360, { button: "right" }); return "right-click"; }],
      ["dbl", async () => { await h.clickAt(p, 640, 400, { count: 2 }); return "double-click"; }],
      ["key", async () => { const k = ["Escape", "p", "Space", "Enter", "Tab", "q", "1", "2", "3", "r", "ArrowDown", "Shift"][Math.floor(rand() * 12)]; await h.press(p, k); return `key ${k}`; }],
      ["spam", async () => { for (let i = 0; i < 6; i++) await h.press(p, rand() < 0.5 ? "Escape" : "p"); return "Esc/P spam"; }],
      ["resize", async () => { const v = sizes[Math.floor(rand() * sizes.length)]; await p.setViewportSize(v); return `resize ${v.width}x${v.height}`; }],
      ["blur", async () => { await p.evaluate(() => { window.dispatchEvent(new Event("blur")); document.dispatchEvent(new Event("visibilitychange")); }); return "blur"; }],
    ];
    const start = Date.now();
    let sameSince = Date.now(), lastScreen = "", stuck = null, badLives = null, picksChecked = 0, pickProblems = [];
    let stagesSeen = new Set();
    while (Date.now() - start < (ctx.long ? 600000 : 150000)) {
      let s = await h.state(p);
      stagesSeen.add(s.stage);
      if (s.screen !== lastScreen) { lastScreen = s.screen; sameSince = Date.now(); }
      else if (s.screen !== "PLAYING" && Date.now() - sameSince > 20000 && !stuck) stuck = `${s.screen} for 20 s after: ${actions.slice(-5).join("; ")}`;
      if (s.board && (s.board.lives < 0 || s.board.lives > 12)) badLives = `${s.board.lives} lives`;
      if (s.screen === "OVER") { actions.push("play again"); await h.clickControl(p, s, "Play again"); continue; }
      if (s.screen === "PICK" && picksChecked < 3 && s.run.pending_levels === 1) {
        const card = s.controls.find(c => c.upgrade);
        const held = Object.values(s.run.upgrades).reduce((a, n) => a + n, 0);
        await h.clickAt(p, card.rect[0] + card.rect[2] / 2, card.rect[1] + card.rect[3] / 2, { count: 2 });
        actions.push("double-click a card");
        await h.sleep(p, 300);
        const n = await h.state(p);
        const after = Object.values(n.run.upgrades).reduce((a, k) => a + k, 0);
        picksChecked++;
        if (after - held !== 1) pickProblems.push(`held ${held} -> ${after}`);
        continue;
      }
      if (rand() < 0.35) { const [, act] = chaos[Math.floor(rand() * chaos.length)]; actions.push(await act(s).catch(e => `failed: ${e.message}`)); }
      else await tick(p, s, play_).catch(e => actions.push(`tick failed: ${e.message.slice(0, 80)}`));
    }
    await p.setViewportSize(sizes[0]);
    await h.shot(p, ctx.out, "P7-end");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(`${ctx.out}/P7-actions.json`, JSON.stringify(actions, null, 1));
    const errors = noErrors(b);
    ctx.check("chaos: no errors", errors.length === 0, errors.slice(0, 3).join(" | ") || `none in ${actions.length} actions`);
    ctx.check("chaos: no screen stuck for 20 s", !stuck, stuck ?? "none");
    ctx.check("chaos: lives stay in range", !badLives, badLives ?? "ok");
    ctx.check("chaos: one double-click, one upgrade", picksChecked > 0 && pickProblems.length === 0,
      picksChecked ? `${picksChecked} double-clicks; ${pickProblems.join(", ") || "each added one"}` : "no single-level pick reached");
    ctx.check("chaos: the game still progresses", stagesSeen.size >= 2, `stages seen: ${[...stagesSeen].join(",")}`);
  } finally { await b.close(); }
}

// --- P8: returning player -----------------------------------------------------------------------

export async function P8(ctx) {
  const b = await h.launch(ctx.launch);
  const p = b.page;
  try {
    const url = ctx.url + query(ctx, { step: true, autoplay: "hurried" });
    await h.boot(p, url);
    let s = await h.state(p);
    await h.clickControl(p, s, "Settings");
    s = await h.until(p, n => n.settings, { what: "settings" });
    await h.clickControl(p, s, { setting: "show_grid" });
    await h.sleep(p, 150); s = await h.state(p);
    await h.clickControl(p, s, "Back");
    await toScreen(p, "TITLE");

    s = await play(p, { stepped: true, chunk: 8, seed: ctx.seed, stop: n => n.stage >= 2 && n.screen === "PLAYING", timeoutMs: 300000 });
    for (let i = 0; i < 12 && s.screen === "PLAYING"; i++) {
      await breakWall(p);
      await h.step(p, 10);
      s = await h.state(p);
      while (s.screen === "ENDING") { await h.step(p, 30); s = await h.state(p); }
    }
    s = await toScreen(p, "OVER", 5000);
    await h.shot(p, ctx.out, "P8-game-over");
    const best = s.best;
    ctx.note(`Game over on stage ${s.stage}, score ${s.score}; best ${JSON.stringify(best)}.`);

    await h.clickControl(p, s, "Play again");
    s = await toScreen(p, "INTRO");
    const clean = s.stage === 1 && s.lives === 3 && s.score === 0 && s.level === 1 && Object.keys(s.run.upgrades).length === 0;
    ctx.check("a second run in the same page starts clean", clean, `stage ${s.stage}, lives ${s.lives}, score ${s.score}, level ${s.level}, upgrades ${JSON.stringify(s.run.upgrades)}`);

    s = await beginStage(p);
    await h.press(p, "Tab"); await h.sleep(p, 150); s = await h.state(p);
    ctx.check("Tab switches the tips off", s.tip === "" && s.settings_values.tips === false, `tip "${s.tip}", tips ${s.settings_values.tips}`);

    await h.sleep(p, 3000); // let the browser's storage catch up, as a person would before leaving
    await h.boot(p, url);
    s = await h.state(p);
    await h.shot(p, ctx.out, "P8-return-visit");
    ctx.check("best score and stage survive a reload", best.score > 0 && s.best.score === best.score && s.best.stage === best.stage,
      `before ${JSON.stringify(best)}, after ${JSON.stringify(s.best)}`);
    ctx.check("settings survive a reload", s.settings_values.show_grid === false && s.settings_values.tips === false,
      `show_grid ${s.settings_values.show_grid}, tips ${s.settings_values.tips}`);
  } finally { await b.close(); }
}

// --- P9: weak laptop, slow line -----------------------------------------------------------------

export async function P9(ctx) {
  let b = await h.launch({ ...ctx.launch, cpu: 4, network: { mbps: 10, latencyMs: 40 } });
  try {
    const bootS = await h.boot(b.page, ctx.releaseUrl, 120000);
    ctx.check("cold load to title on 10 Mbit/s, 4x CPU slowdown: within 12 s", bootS <= 12, `${bootS.toFixed(1)} s (release build, gzip)`);
  } finally { await b.close(); }

  // Three sessions pooled: a session ends early when the clicks lose the run, so one alone is noisy.
  const pooled = [];
  const screens = [];
  for (let session = 0; session < 3; session++) {
    b = await h.launch({ ...ctx.launch, cpu: 4 });
    try {
      await h.boot(b.page, ctx.url + query(ctx, { quiet: true, stage: 12 }), 120000);
      await h.clickAt(b.page, 640, 712); // into the frame (off any button), then keys
      await h.press(b.page, "Enter"); await h.until(b.page, s => s.screen === "INTRO", { full: false, what: "intro" });
      await h.press(b.page, "Enter"); await h.until(b.page, s => s.screen === "PLAYING", { full: false, what: "play" });
      // Frame intervals while in play only: the screens that follow a lost run are another matter.
      const timing = b.page.evaluate(() => new Promise(done => {
        const times = []; let last = performance.now(); const end = last + 6000;
        const frame = now => { if (window.boxedIn?.screen === "PLAYING") times.push(now - last); last = now; if (now < end) requestAnimationFrame(frame); else done(times); };
        requestAnimationFrame(frame);
      }));
      for (let i = 0; i < 6; i++) { await h.clickAt(b.page, 300 + i * 120 + session * 30, 200 + ((i + session) % 3) * 150); await h.sleep(b.page, 900); }
      pooled.push(...(await timing).slice(1));
      screens.push((await h.summary(b.page)).screen);
    } finally { await b.close(); }
  }
  const times = pooled.sort((x, y) => x - y);
  const at = q => times[Math.min(times.length - 1, Math.floor(times.length * q))];
  ctx.check("stage 12 with walls building at 4x CPU slowdown: p99 frame under 33 ms", at(0.99) < 33,
    `${times.length} frames in play over 3 sessions: median ${at(0.5).toFixed(1)} ms, p95 ${at(0.95).toFixed(1)} ms, p99 ${at(0.99).toFixed(1)} ms, worst ${times.at(-1).toFixed(1)} ms (sessions ended on ${screens.join(", ")}; animation-frame callbacks, quiet test build)`);

  b = await h.launch({ ...ctx.launch, viewport: { width: 1920, height: 1080 }, scale: 2 });
  try {
    await h.boot(b.page, ctx.url + query(ctx, {}), 120000);
    const canvas = await b.page.evaluate(() => { const c = document.querySelector("canvas"); return [c.width, c.height, c.clientWidth, c.clientHeight]; });
    ctx.check("1920x1080 at pixel ratio 2: canvas renders at full resolution", canvas[0] >= 3800, `canvas ${canvas[0]}x${canvas[1]} for ${canvas[2]}x${canvas[3]} CSS px`);
    await h.shot(b.page, ctx.out, "P9-hidpi-title");
    await startRun(b.page); await beginStage(b.page); await h.sleep(b.page, 800);
    await h.shot(b.page, ctx.out, "P9-hidpi-play");
  } finally { await b.close(); }
}

export const PERSONAS = { P1, P2, P3, P4, P5, P6, P7, P8, P9 };

/** Each plant, the persona that must catch it and the check that must fail. */
export const PLANT_PROOFS = [
  { plant: "no_meter", persona: "P2", check: "the pen meter (area / limit) is drawn" },
  { plant: "no_right_turn", persona: "P2", check: "right-click turns the wall" },
  { plant: "esc_quits", persona: "P4", check: "Esc during play pauses (never quits)" },
  { plant: "double_pick", persona: "P4", check: "one key press, one upgrade" },
  { plant: "hide_locks", persona: "P5", check: "default: locked pen differs from open space under every vision type" },
  { plant: "shake_ignores_reduced", persona: "P6", check: "system reduced motion: no shake, particles or rings" },
  { plant: "no_best_save", persona: "P8", check: "best score and stage survive a reload" },
  { plant: "tip_stays_put", persona: "P2", check: "the tip box never hides a ball for more than 0.6 s" },
  { plant: "red_busy_preview", persona: "P2", check: "no red path while a wall builds" },
  { plant: "no_direction_icon", persona: "P2", check: "the HUD shows which way the next wall grows" },
  { plant: "no_danger_cue", persona: "P2", check: "a growing wall warns before a ball hits it" },
  { plant: "meter_at_centre", persona: "P2", check: "pen meters stay off growing walls" },
];
