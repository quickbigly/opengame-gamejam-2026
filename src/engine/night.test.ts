import { describe, expect, it } from 'vitest';
import { FAULTS_BY_ID } from '../content/faults';
import { NIGHTS } from '../content/nights';
import { TOWN } from '../content/town';
import { NIGHT_MINUTES, bestDeparture, fastestRoute, roadMinutes, snowAt, type SnowEvent } from './night';
import { canAnswerAll, solveNight } from './solver';

const events: SnowEvent[] = [
  { at: 60, kind: 'plow', roads: ['a'], label: '' },
  { at: 120, kind: 'snowfall', roads: [], label: '' },
];
const road = { id: 'a', a: 'x', b: 'y', name: 'A', base: 10, snow: 'deep' as const };

describe('snow', () => {
  it('plows, then snowfall makes roads worse', () => {
    expect(snowAt(road, events, 0)).toBe('deep');
    expect(snowAt(road, events, 60)).toBe('plowed');
    expect(snowAt(road, events, 120)).toBe('snowy');
  });

  it('applies the design’s snow factors and Snow Tires', () => {
    expect(roadMinutes(road, 'plowed')).toBe(10);
    expect(roadMinutes(road, 'snowy')).toBe(15);
    expect(roadMinutes(road, 'deep')).toBe(25);
    expect(roadMinutes(road, 'deep', { snowTires: true })).toBe(20);
    expect(roadMinutes(road, 'blocked')).toBe(Infinity);
  });
});

describe('routing', () => {
  it('drives around a blocked road until the plow opens it', () => {
    const early = fastestRoute(TOWN, NIGHTS[0].snow, 'hall', 'lindqvist', 0)!;
    expect(early.roads).not.toContain('lantern');
    const late = fastestRoute(TOWN, NIGHTS[0].snow, 'hall', 'lindqvist', 180)!;
    expect(late.roads).toEqual(['lantern']);
  });

  it('can recommend waiting for the plow', () => {
    // Ridge Rd is deep until 10:00 PM; just before then, waiting beats driving.
    const dep = bestDeparture(TOWN, NIGHTS[0].snow, 'vic', 'ingrid', 235)!;
    expect(dep.depart).toBe(240);
    expect(dep.route.minutes).toBe(14);
  });

  it('connects every place', () => {
    for (const p of Object.keys(TOWN.places)) expect(fastestRoute(TOWN, [], 'shop', p, 0)).not.toBeNull();
  });
});

describe.each(NIGHTS.map((n) => [n.number, n] as const))('night %i', (_n, night) => {
  it('only schedules real faults and places', () => {
    for (const c of night.calls) {
      expect(FAULTS_BY_ID).toHaveProperty(c.fault);
      expect(TOWN.places).toHaveProperty(c.place);
      expect(c.deadline).toBeGreaterThan(c.calledAt);
    }
  });

  it('lets a perfect player reach every call before midnight, callbacks included', () => {
    expect(canAnswerAll(night, TOWN, FAULTS_BY_ID)).toBe(true);
    const plain = { ...night, calls: night.calls.filter((c) => !c.callbackOf) };
    const par = solveNight(plain, TOWN, FAULTS_BY_ID);
    expect(par.stops).toHaveLength(plain.calls.length);
    expect(Math.max(...par.stops.map((s) => s.finish))).toBeLessThan(NIGHT_MINUTES);
    expect(par.score).toBeGreaterThan(0);
  });

  it('never lowers Par with Snow Tires or the Thermos', () => {
    const plain = { ...night, calls: night.calls.filter((c) => !c.callbackOf) };
    const base = solveNight(plain, TOWN, FAULTS_BY_ID).score;
    expect(solveNight(plain, TOWN, FAULTS_BY_ID, { up: { snowTires: true } }).score).toBeGreaterThanOrEqual(base);
    expect(solveNight(plain, TOWN, FAULTS_BY_ID, { up: { thermos: true } }).score).toBeGreaterThanOrEqual(base);
  });
});

describe('par solver', () => {
  it('waits at a house for a call that has not come in yet', () => {
    const night = { number: 0, snow: [], calls: [{ id: 'x', fault: 'f01', place: 'hall', calledAt: 100, deadline: 160 }] };
    const [stop] = solveNight(night, TOWN, FAULTS_BY_ID).stops;
    expect(stop.arrive).toBeLessThan(100);
    expect(stop.start).toBe(100);
  });

  it('pays nothing for callbacks', () => {
    const night = { number: 0, snow: [], calls: [{ id: 'x', fault: 'f01', place: 'hall', calledAt: 0, deadline: 60, callbackOf: 'old' }] };
    const par = solveNight(night, TOWN, FAULTS_BY_ID);
    expect(par.score).toBe(0);
    expect(par.stops).toHaveLength(1);
  });
});
