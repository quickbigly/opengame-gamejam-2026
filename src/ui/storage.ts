// localStorage is a convenience only (design §11): every read and write is wrapped, and the game works without it.

import { fromSave, runScore, toSave, type RunState, type SaveData } from '../game/run';

const SAVE_KEY = 'snowbound-signal.save.v1';
const BEST_KEY = 'snowbound-signal.best.v1';

export function loadSave(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? fromSave(JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

/** Saves at the start of a night. Continuing restarts that night at 6:00 PM. */
export function writeSave(run: RunState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(run)));
  } catch {
    // Storage is blocked or full: the run just won't be resumable.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function loadBest(): number | null {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Records the run's score; returns true if it's a new personal best. */
export function recordBest(run: RunState): boolean {
  const score = runScore(run);
  const best = loadBest();
  if (best !== null && score <= best) return false;
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // ignore
  }
  return true;
}
