// M1 vertical slice: two calls on a short evening. Replaced by nights.ts + the town map in M2.
// Times are game minutes after 6:00 PM.

import { f01NoSignal } from './faults/f01-no-signal';
import { f06SoundSocket } from './faults/f06-sound-socket';
import type { Fault } from '../engine/types';

export interface ScheduledJob {
  fault: Fault;
  /** When the call came in. */
  calledAt: number;
  /** Drive time to this house from the previous stop. */
  travel: number;
  deadline: number;
}

export const SLICE_JOBS: ScheduledJob[] = [
  { fault: f01NoSignal, calledAt: 0, travel: 10, deadline: 45 },
  { fault: f06SoundSocket, calledAt: 0, travel: 15, deadline: 90 },
];
