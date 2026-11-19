// Permanent upgrades bought between nights (design §9). Their effects live in the engine so the
// Par solver, the map and the house all agree on them.

import type { CostOptions } from './room';

export type UpgradeId = 'snowTires' | 'signalLens' | 'thermos' | 'friendlyFace';
export type Upgrades = Partial<Record<UpgradeId, boolean>>;

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  cost: number;
  blurb: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'snowTires', name: 'Snow Tires', icon: '🛞', cost: 60, blurb: 'Snowy roads ×1.0 instead of ×1.5, deep snow ×2.0 instead of ×2.5.' },
  { id: 'signalLens', name: 'Signal Lens', icon: '🔎', cost: 50, blurb: 'See every line’s details without stopping to look closer.' },
  { id: 'thermos', name: 'Thermos', icon: '☕', cost: 40, blurb: 'Hot cocoa keeps you going: every night runs 30 minutes longer.' },
  { id: 'friendlyFace', name: 'Friendly Face', icon: '😊', cost: 45, blurb: 'Neighbors open up right away: asking a question costs no time.' },
];

export const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

/** Minutes after 6:00 PM when the night ends: midnight, or 12:30 AM with the Thermos. */
export function nightEnd(up: Upgrades = {}): number {
  return 360 + (up.thermos ? 30 : 0);
}

export function costOptions(up: Upgrades = {}): CostOptions {
  return { freeAsk: !!up.friendlyFace };
}
