// One night on the town map: snow over time, routing, call arrivals. Pure, no UI. See design §4, §7, §8.

import type { Upgrades } from './upgrades';

export type Snow = 'plowed' | 'snowy' | 'deep' | 'blocked';

export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: 'shop' | 'house' | 'hall';
  neighbor?: string;
}

export interface Road {
  id: string;
  a: string;
  b: string;
  name: string;
  /** Minutes on a plowed road. */
  base: number;
  /** Condition at 6:00 PM. */
  snow: Snow;
}

export interface Town {
  places: Record<string, Place>;
  roads: Record<string, Road>;
}

/** Plows clear roads; snowfall worsens every road that isn't blocked. */
export interface SnowEvent {
  at: number;
  kind: 'plow' | 'snowfall';
  roads: string[];
  label: string;
}

export interface Call {
  id: string;
  fault: string;
  place: string;
  calledAt: number;
  deadline: number;
  /** A callback: only happens if this earlier call left a problem behind. Callbacks are fixed for free. */
  callbackOf?: string;
  /** Replaces the fault's usual call text (callbacks say "it's happening again"). */
  callText?: string;
  /** The festival screen. Fixing it before midnight starts the broadcast. */
  finale?: boolean;
}

export interface NightDef {
  number: number;
  calls: Call[];
  snow: SnowEvent[];
}

export const NIGHT_MINUTES = 360; // 6:00 PM to midnight (the Thermos adds 30, see upgrades.ts)
export const SNOW_FACTOR: Record<Snow, number> = { plowed: 1, snowy: 1.5, deep: 2.5, blocked: Infinity };
const WORSE: Record<Snow, Snow> = { plowed: 'snowy', snowy: 'deep', deep: 'deep', blocked: 'blocked' };

export function snowAt(road: Road, events: SnowEvent[], t: number): Snow {
  let s = road.snow;
  for (const e of events) {
    if (e.at > t) break;
    if (e.kind === 'plow' && e.roads.includes(road.id)) s = 'plowed';
    if (e.kind === 'snowfall' && (e.roads.length === 0 || e.roads.includes(road.id))) s = WORSE[s];
  }
  return s;
}

export function roadMinutes(road: Road, snow: Snow, up: Upgrades = {}): number {
  if (snow === 'blocked') return Infinity;
  const f = SNOW_FACTOR[snow] - (up.snowTires && snow !== 'plowed' ? 0.5 : 0);
  return Math.round(road.base * f);
}

export interface Route {
  places: string[];
  roads: string[];
  /** Arrival time (game minutes). */
  arrive: number;
  minutes: number;
}

/**
 * Fastest route leaving `from` at time `depart`. Each road's snow is judged when you start driving it
 * (time-dependent Dijkstra; roads only get faster when plowed, so arriving earlier never hurts).
 */
export function fastestRoute(town: Town, events: SnowEvent[], from: string, to: string, depart: number, up: Upgrades = {}): Route | null {
  const best: Record<string, number> = { [from]: depart };
  const prev: Record<string, { place: string; road: string }> = {};
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [p, t] of Object.entries(best)) if (!done.has(p) && (cur === null || t < best[cur])) cur = p;
    if (cur === null) return null;
    if (cur === to) break;
    done.add(cur);
    for (const r of Object.values(town.roads)) {
      if (r.a !== cur && r.b !== cur) continue;
      const next = r.a === cur ? r.b : r.a;
      const t = best[cur] + roadMinutes(r, snowAt(r, events, best[cur]), up);
      if (t < (best[next] ?? Infinity)) {
        best[next] = t;
        prev[next] = { place: cur, road: r.id };
      }
    }
  }
  const places = [to];
  const roads: string[] = [];
  for (let p = to; p !== from; p = prev[p].place) {
    roads.unshift(prev[p].road);
    places.unshift(prev[p].place);
  }
  return { places, roads, arrive: best[to], minutes: best[to] - depart };
}

/**
 * Best arrival allowing a wait at the start: compares leaving now with leaving right after each upcoming snow event.
 */
export function bestDeparture(town: Town, events: SnowEvent[], from: string, to: string, now: number, up: Upgrades = {}) {
  let best: { depart: number; route: Route } | null = null;
  for (const depart of [now, ...events.filter((e) => e.at > now).map((e) => e.at)]) {
    const route = fastestRoute(town, events, from, to, depart, up);
    if (route && (!best || route.arrive < best.route.arrive)) best = { depart, route };
  }
  return best;
}

/** The night's calls, keeping only the callbacks that earlier nights left behind. */
export function callsFor(night: NightDef, callbacks: string[]): Call[] {
  return night.calls.filter((c) => !c.callbackOf || callbacks.includes(c.callbackOf));
}

export function knownCalls(night: NightDef, t: number): Call[] {
  return night.calls.filter((c) => c.calledAt <= t);
}

export function nextEvent(events: SnowEvent[], t: number): SnowEvent | undefined {
  return events.find((e) => e.at > t);
}
