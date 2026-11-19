// Night schedules (design §8). The schedule is the same every run, so routes can be planned.
// Times are game minutes after 6:00 PM. About four calls are known at 6:00 PM; the rest come in later.

import type { NightDef } from '../engine/night';
import { NIGHT1_SNOW, NIGHT2_SNOW, NIGHT3_SNOW } from './town';

export const NIGHT1: NightDef = {
  number: 1,
  snow: NIGHT1_SNOW,
  calls: [
    { id: 'n1-rosa', fault: 'f01', place: 'rosa', calledAt: 0, deadline: 60 },
    { id: 'n1-fenwick', fault: 'f02', place: 'fenwick', calledAt: 0, deadline: 90 },
    { id: 'n1-harmon', fault: 'f03', place: 'harmon', calledAt: 0, deadline: 120 },
    { id: 'n1-lindqvist', fault: 'f06', place: 'lindqvist', calledAt: 0, deadline: 240 },
    { id: 'n1-patterson', fault: 'f04', place: 'patterson', calledAt: 75, deadline: 210 },
    { id: 'n1-ingrid', fault: 'f05', place: 'ingrid', calledAt: 135, deadline: 330 },
  ],
};

export const NIGHT2: NightDef = {
  number: 2,
  snow: NIGHT2_SNOW,
  calls: [
    { id: 'n2-dottie', fault: 'f07', place: 'dottie', calledAt: 0, deadline: 90 },
    { id: 'n2-fenwick', fault: 'f15', place: 'fenwick', calledAt: 0, deadline: 120 },
    { id: 'n2-harmon', fault: 'f12', place: 'harmon', calledAt: 0, deadline: 150 },
    { id: 'n2-vic', fault: 'f08', place: 'vic', calledAt: 0, deadline: 180 },
    { id: 'n2-nakamura', fault: 'f09', place: 'nakamura', calledAt: 60, deadline: 210 },
    { id: 'n2-june', fault: 'f10', place: 'june', calledAt: 120, deadline: 240 },
    { id: 'n2-brennan', fault: 'f11', place: 'brennan', calledAt: 185, deadline: 300 },
  ],
};

export const NIGHT3: NightDef = {
  number: 3,
  snow: NIGHT3_SNOW,
  calls: [
    { id: 'n3-hall', fault: 'f20', place: 'hall', calledAt: 0, deadline: 330, finale: true },
    { id: 'n3-patterson', fault: 'f13', place: 'patterson', calledAt: 0, deadline: 120 },
    { id: 'n3-rosa', fault: 'f16', place: 'rosa', calledAt: 0, deadline: 150 },
    { id: 'n3-lindqvist', fault: 'f14', place: 'lindqvist', calledAt: 0, deadline: 180 },
    { id: 'n3-june', fault: 'f17', place: 'june', calledAt: 60, deadline: 210 },
    { id: 'n3-brennan', fault: 'f18', place: 'brennan', calledAt: 120, deadline: 270 },
    { id: 'n3-nakamura', fault: 'f19', place: 'nakamura', calledAt: 150, deadline: 300 },
    // Callbacks: these only happen if the earlier visit left a problem behind. They're fixed for free.
    {
      id: 'n3-cb-ingrid', fault: 'f05', place: 'ingrid', calledAt: 30, deadline: 180, callbackOf: 'n1-ingrid',
      callText: 'It’s searching again! The snow piled right back onto the dish. You said this might happen…',
    },
    {
      id: 'n3-cb-harmon', fault: 'cb12', place: 'harmon', calledAt: 60, deadline: 210, callbackOf: 'n2-harmon',
      callText: 'Since your visit the TV stays put, but the Sound Bar hasn’t made a peep. Can you take another look?',
    },
    {
      id: 'n3-cb-fenwick', fault: 'f15', place: 'fenwick', calledAt: 90, deadline: 240, callbackOf: 'n2-fenwick',
      callText: 'The storm got the TV again! Same blinking red light as before.',
    },
  ],
};

export const NIGHTS = [NIGHT1, NIGHT2, NIGHT3];
