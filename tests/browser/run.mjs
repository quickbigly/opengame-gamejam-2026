// Runs the scripted persona playtests and writes a report.
//   node run.mjs                    every persona (P1-P9)
//   node run.mjs --only=P2,P4       some of them
//   node run.mjs --plant=no_meter   with a known defect switched on (TestHooks.PLANTS)
//   node run.mjs --prove            proves each check can fail: every plant with the persona
//                                   that must catch it, plus a stale file against the receipt
//   node run.mjs --headed --seed=7 --long
// Builds first: dev -Web and dev -WebTest. Exit code 1 when any check fails or a persona
// couldn't finish (incomplete never counts as a pass).
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as h from "./lib.mjs";
import { PERSONAS, PLANT_PROOFS } from "./personas.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = join(h.ROOT, "tests/browser/out", stamp);
await mkdir(out, { recursive: true });

const test = await h.serve(h.BUILDS.test);
const release = await h.serve(h.BUILDS.release);
const results = [];
const notes = [];
let builds = {};

async function runPersona(id, plants = []) {
  const checks = [];
  const ctx = {
    persona: id, plants, url: test.url, releaseUrl: release.url, out, seed: Number(args.seed ?? 1), long: !!args.long,
    launch: { headed: !!args.headed },
    check: (name, pass, detail = "", evidence = "") => { checks.push({ persona: id, plants, name, pass: !!pass, detail, evidence }); console.log(`  ${pass ? "pass" : "FAIL"} ${id} ${name}: ${detail}`); },
    note: text => { notes.push({ persona: id, plants, text }); console.log(`  note ${id}: ${text}`); },
  };
  const t0 = Date.now();
  try { await PERSONAS[id](ctx); }
  catch (e) { ctx.check("ran to the end", false, `incomplete: ${e.message.split("\n")[0]}`); }
  console.log(`  ${id} took ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return checks;
}

try {
  builds.test = await h.checkReceipt(test.url, h.BUILDS.test);
  builds.release = await h.checkReceipt(release.url, h.BUILDS.release);
  console.log(`Builds: test ${builds.test}, release ${builds.release}. Output: ${out}`);
  if (args.prove) {
    // The receipt check must catch a stale file.
    const stale = await h.serve(h.BUILDS.test, { swap: { "index.pck": Buffer.from("stale") } });
    let caught = false;
    try { await h.checkReceipt(stale.url, h.BUILDS.test); } catch (e) { caught = /index\.pck/.test(e.message); }
    await stale.close();
    results.push({ persona: "receipt", plants: ["stale index.pck"], name: "plant caught: a stale index.pck fails the receipt check", pass: caught, detail: caught ? "named index.pck" : "not caught" });
    const only = args.only ? String(args.only).split(",") : null;
    for (const proof of PLANT_PROOFS.filter(p => !only || only.includes(p.plant))) {
      console.log(`Plant ${proof.plant} -> ${proof.persona}`);
      const checks = await runPersona(proof.persona, [proof.plant]);
      const target = checks.find(c => c.name === proof.check);
      results.push({ persona: proof.persona, plants: [proof.plant], name: `plant caught: ${proof.plant} fails "${proof.check}"`,
        pass: !!target && !target.pass, detail: target ? `check ${target.pass ? "passed (NOT caught)" : "failed"}: ${target.detail}` : "the check never ran" });
    }
  } else {
    const ids = args.only ? String(args.only).split(",") : Object.keys(PERSONAS);
    const plants = args.plant ? String(args.plant).split(",") : [];
    for (const id of ids) { console.log(`Persona ${id}${plants.length ? ` with ${plants}` : ""}`); results.push(...await runPersona(id, plants)); }
  }
} finally { await test.close(); await release.close(); }

const failed = results.filter(r => !r.pass);
const md = [`# Persona playtest results (${args.prove ? "plant proofs" : "scripted run"})`, "",
  `Test build \`${builds.test}\`, release build \`${builds.release}\`, ${stamp}. Screenshots in \`tests/browser/out/${stamp}/\`.`, "",
  `${results.length - failed.length} passed, ${failed.length} failed.`, "",
  "| Persona | Check | Result | Detail |", "| --- | --- | --- | --- |",
  ...results.map(r => `| ${r.persona}${r.plants?.length ? ` (${r.plants})` : ""} | ${r.name} | ${r.pass ? "pass" : "**FAIL**"} | ${String(r.detail).replace(/\|/g, "/")} |`),
  "", "Notes:", "", ...notes.map(n => `- ${n.persona}: ${n.text}`)].join("\n");
await writeFile(join(out, "results.json"), JSON.stringify({ builds, results, notes }, null, 1));
await writeFile(join(out, "results.md"), md + "\n");
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Report: ${join(out, "results.md")}`);
process.exit(failed.length ? 1 : 0);
