import type { Fault } from '../../engine/types';
import { f01NoSignal } from './f01-no-signal';
import { f02Remote } from './f02-remote';
import { f03PictureSize } from './f03-picture-size';
import { f04TooSmooth } from './f04-too-smooth';
import { f05Satellite } from './f05-satellite';
import { f06SoundSocket } from './f06-sound-socket';
import { f07WifiRestart } from './f07-wifi-restart';
import { f08Hum } from './f08-hum';
import { f09LipSync } from './f09-lip-sync';
import { f10Laptop } from './f10-laptop';
import { f11SmartPlug } from './f11-smart-plug';
import { cb12QuietBar, f12Switching } from './f12-switching';
import { f13Surround } from './f13-surround';
import { f14Buffering } from './f14-buffering';
import { f15Surge } from './f15-surge';
import { f16Headphones } from './f16-headphones';
import { f17Handshake } from './f17-handshake';
import { f18FastCable } from './f18-fast-cable';
import { f19BlackLevel } from './f19-black-level';
import { f20Festival } from './f20-festival';

export const FAULTS: Fault[] = [
  f01NoSignal, f02Remote, f03PictureSize, f04TooSmooth, f05Satellite, f06SoundSocket,
  f07WifiRestart, f08Hum, f09LipSync, f10Laptop, f11SmartPlug,
  f12Switching, f13Surround, f14Buffering, f15Surge, f16Headphones,
  f17Handshake, f18FastCable, f19BlackLevel, f20Festival,
  cb12QuietBar,
];
export const FAULTS_BY_ID: Record<string, Fault> = Object.fromEntries(FAULTS.map((f) => [f.id, f]));
