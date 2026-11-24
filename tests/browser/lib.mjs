// Browser harness for the persona playtests (docs/persona-playtest.md).
//
// Serves an exported build with no caching, proves the served files match the build's
// receipt, drives Chrome with real mouse and keyboard events (Playwright's page.mouse and
// page.keyboard go through the browser's input path), and reads the game's state:
//   window.boxedIn      short summary, in every build (scripts/main.gd)
//   window.boxedInTest  full state as JSON, test builds only (scripts/test_hooks.gd)

import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const BUILDS = { release: join(ROOT, "build/web"), test: join(ROOT, "build/web-test") };

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm", ".pck": "application/octet-stream",
  ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml",
};

// --- Serving ------------------------------------------------------------------------------------

/** Serves `dir` on a free port with Cache-Control: no-store, gzipping the big files when the
 * browser asks, as the OpenGame host does. `swap` maps a file name to other bytes, to serve a
 * stale or wrong file on purpose (the receipt plant). */
export async function serve(dir, { swap = {} } = {}) {
  const zipped = new Map();
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
    const path = resolve(dir, name);
    if (!path.startsWith(resolve(dir))) { res.writeHead(403).end(); return; }
    try {
      let body = swap[name] ?? await readFile(path);
      const headers = { "Content-Type": TYPES[extname(name)] ?? "application/octet-stream", "Cache-Control": "no-store" };
      if (/gzip/.test(req.headers["accept-encoding"] ?? "") && [".wasm", ".pck", ".js", ".html"].includes(extname(name))) {
        const key = name + (swap[name] ? ":swap" : "");
        if (!zipped.has(key)) zipped.set(key, gzipSync(body, { level: 6 }));
        body = zipped.get(key);
        headers["Content-Encoding"] = "gzip";
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      res.writeHead(404, { "Cache-Control": "no-store" }).end();
    }
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  return { url, close: () => new Promise(done => server.close(done)) };
}

/** Hashes every file the server sends against the build's receipt. Returns the build id, or
 * throws naming each file that differs. */
export async function checkReceipt(url, dir) {
  const receipt = JSON.parse(await readFile(join(dir, "receipt.json"), "utf8"));
  const wrong = [];
  for (const [name, hash] of Object.entries(receipt.files)) {
    const res = await fetch(url + name);
    const served = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
    if (!res.ok || served !== hash) wrong.push(name);
  }
  if (wrong.length) throw new Error(`served files differ from the receipt of ${receipt.build}: ${wrong.join(", ")}`);
  return receipt.build;
}

// --- Browser ------------------------------------------------------------------------------------

/** A fresh browser profile on one page. Options: viewport, scale (device pixel ratio),
 * reducedMotion, cpu (throttle rate), network ({mbps, latencyMs}), headed, storageFrom (a
 * previous session's storage state, for a return visit). */
export async function launch(opts = {}) {
  const browser = await chromium.launch({
    channel: process.env.BOXED_BROWSER === "bundled" ? undefined : "chrome",
    headless: !opts.headed,
    args: ["--mute-audio", "--autoplay-policy=user-gesture-required"],
  });
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    deviceScaleFactor: opts.scale ?? 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
    serviceWorkers: "block",
    storageState: opts.storageFrom,
  });
  const page = await context.newPage();
  const log = { console: [], errors: [], failed: [] };
  page.on("console", m => log.console.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", e => log.errors.push(e.message));
  page.on("requestfailed", r => log.failed.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) log.failed.push(`${r.url()} ${r.status()}`); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (opts.cpu) await cdp.send("Emulation.setCPUThrottlingRate", { rate: opts.cpu });
  if (opts.network) {
    const bytes = opts.network.mbps * 1e6 / 8;
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: opts.network.latencyMs ?? 0,
      downloadThroughput: bytes, uploadThroughput: bytes });
  }
  return { browser, context, page, cdp, log, close: () => browser.close() };
}

/** Loads the game and waits for the title. Returns seconds from navigation to the title. */
export async function boot(page, url, timeoutMs = 60000) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForFunction(() => window.boxedIn?.screen === "TITLE", null, { timeout: timeoutMs, polling: 50 });
  return (Date.now() - start) / 1000;
}

// --- Reading the game ---------------------------------------------------------------------------

export const summary = page => page.evaluate(() => window.boxedIn ?? null);
export const state = page => page.evaluate(() => window.boxedInTest ? JSON.parse(window.boxedInTest) : null);

/** Waits until fn(state) is true (full state in test builds, the summary otherwise). */
export async function until(page, fn, { timeoutMs = 10000, what = "condition", full = true } = {}) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = full ? await state(page) : await summary(page);
    if (last && fn(last)) return last;
    await page.waitForTimeout(40);
  }
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${what} (screen ${last?.screen})`);
}

export const sleep = (page, ms) => page.waitForTimeout(ms);

// --- Real input ---------------------------------------------------------------------------------

/** Canvas pixels (1280x720 design space) to page coordinates, through the canvas's real size. */
export async function toPage(page, x, y) {
  const box = await page.locator("canvas").boundingBox();
  const scale = Math.min(box.width / 1280, box.height / 720);
  const left = box.x + (box.width - 1280 * scale) / 2;
  const top = box.y + (box.height - 720 * scale) / 2;
  return [left + x * scale, top + y * scale];
}

/** The centre of field cell [cx, cy] (fractions allowed), in canvas pixels. */
export const cellCentre = (s, cx, cy) => [s.field.origin[0] + cx * s.field.cell, s.field.origin[1] + cy * s.field.cell];

export async function moveTo(page, x, y) {
  const [px, py] = await toPage(page, x, y);
  await page.mouse.move(px, py, { steps: 4 });
}

export async function clickAt(page, x, y, { button = "left", shift = false, count = 1 } = {}) {
  const [px, py] = await toPage(page, x, y);
  await page.mouse.move(px, py, { steps: 4 });
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(px, py, { button, clickCount: count });
  if (shift) await page.keyboard.up("Shift");
}

export async function clickCell(page, s, cx, cy, opts) {
  const [x, y] = cellCentre(s, cx + 0.5, cy + 0.5);
  await clickAt(page, x, y, opts);
}

/** Finds a visible control by text (exact or RegExp), or {setting: key}, in the full state. */
export function control(s, text) {
  if (text?.setting) return (s.controls ?? []).find(c => c.setting === text.setting);
  return (s.controls ?? []).find(c => c.text !== undefined && (text instanceof RegExp ? text.test(c.text) : c.text === text));
}

export async function clickControl(page, s, text, opts) {
  const c = control(s, text);
  if (!c) throw new Error(`no control "${text?.setting ?? text}" on ${s.screen}; have: ${(s.controls ?? []).map(c => c.text ?? c.kind).join(" | ")}`);
  await clickAt(page, c.rect[0] + c.rect[2] / 2, c.rect[1] + c.rect[3] / 2, opts);
}

export const press = (page, key) => page.keyboard.press(key);

/** Stepped clock (?step): runs n board steps of 1/120 s and waits for them to be taken. */
export async function step(page, n) {
  const before = (await state(page)).test.steps_taken;
  await page.evaluate(k => window.boxedInStep(k), n);
  await until(page, s => s.test.steps_pending === 0 && s.test.steps_taken >= before + n || s.board?.state !== "PLAYING" || s.screen !== "PLAYING",
    { what: `${n} steps`, timeoutMs: 15000 });
}

// --- Evidence -----------------------------------------------------------------------------------

/** Saves a screenshot with a stamp beside it (build, screen, stage, lives) read from the game,
 * so a capture can be checked against its label. Returns the image path. */
export async function shot(page, dir, name) {
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path });
  const stamp = (await state(page)) ?? (await summary(page));
  const { rows, ...board } = stamp?.board ?? {};
  await writeFile(join(dir, `${name}.json`), JSON.stringify({ ...stamp, board: stamp?.board ? board : undefined }, null, 1));
  return path;
}

export async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}
