// Balance report: Par for every night, with and without upgrades and callbacks. Run with `npm run par`.

import { FAULTS_BY_ID } from '../src/content/faults';
import { NEIGHBORS } from '../src/content/neighbors';
import { NIGHTS } from '../src/content/nights';
import { TOWN } from '../src/content/town';
import { callsFor, type NightDef } from '../src/engine/night';
import { solveNight } from '../src/engine/solver';
import type { Upgrades } from '../src/engine/upgrades';

const clock = (m: number) => {
  const t = 18 * 60 + m;
  const h = Math.floor(t / 60) % 24;
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')}`;
};

export function parReport(): string {
  const out: string[] = [];
  const allCallbacks = NIGHTS.flatMap((n) => n.calls.map((c) => c.id));
  const cases: [string, Upgrades][] = [
    ['no upgrades', {}],
    ['snow tires', { snowTires: true }],
    ['thermos', { thermos: true }],
    ['all upgrades', { snowTires: true, thermos: true, friendlyFace: true, signalLens: true }],
  ];
  for (const def of NIGHTS) {
    const variants: [string, NightDef][] = [['no callbacks', { ...def, calls: callsFor(def, []) }]];
    if (def.calls.some((c) => c.callbackOf)) variants.push(['every callback', { ...def, calls: callsFor(def, allCallbacks) }]);
    for (const [vName, night] of variants) {
      out.push(`\nNight ${def.number} (${vName}, ${night.calls.length} calls)`);
      for (const [name, up] of cases) {
        const t0 = performance.now();
        const par = solveNight(night, TOWN, FAULTS_BY_ID, { up });
        const ms = Math.round(performance.now() - t0);
        out.push(`  ${name.padEnd(13)} Par ${String(par.score).padStart(4)}  ${par.stops.length}/${night.calls.length} calls  last done ${clock(Math.max(0, ...par.stops.map((s) => s.finish)))}  (${ms} ms)`);
        if (name === 'no upgrades') {
          for (const s of par.stops) {
            const call = night.calls.find((c) => c.id === s.call)!;
            const who = NEIGHBORS[FAULTS_BY_ID[call.fault].caller].name;
            out.push(`      ${clock(s.depart)} → ${who.padEnd(20)} arrive ${clock(s.arrive)} start ${clock(s.start)} done ${clock(s.finish)} (due ${clock(call.deadline)})  🪙${s.pay}${s.bonus ? ' +bonus' : ''}`);
          }
        }
      }
    }
  }
  return out.join('\n');
}
