import type { Fault } from '../../engine/types';
import { f01NoSignal } from './f01-no-signal';
import { f06SoundSocket } from './f06-sound-socket';

export const FAULTS: Fault[] = [f01NoSignal, f06SoundSocket];
export const FAULTS_BY_ID: Record<string, Fault> = Object.fromEntries(FAULTS.map((f) => [f.id, f]));
