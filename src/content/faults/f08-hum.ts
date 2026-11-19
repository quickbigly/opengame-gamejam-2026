// Fault #8 "There's a Buzz" — see docs/fault-library.md.

import { linked } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, sock, spec } from '../helpers';

const WALL = { device: 'wall', socket: 'out' };
const BOX_IN = { device: 'cablebox', socket: 'line' };
const plugged = (s: RoomState) => linked(s, WALL, BOX_IN);
const stopper = (s: RoomState) => s.installedParts.includes('humStopper');
const hum = (s: RoomState) => plugged(s) && !stopper(s);

export const f08Hum: Fault = {
  id: 'f08',
  number: 8,
  tier: 2,
  title: "There's a Buzz",
  caller: 'vic',
  call: { text: "There's a hum coming out of the speakers, even when it's muted." },

  setup: () => ({
    devices: {
      wall: dev({ id: 'wall', name: 'Wall Cable', kind: 'outlet', x: 40, y: 290, w: 130, h: 56, noPower: true, sockets: [sock('out', 'Line', 'right')] }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 220, y: 410, w: 190, h: 64,
        sockets: [sock('line', 'Line', 'left'), sock('out', 'Out', 'right')],
      }),
      hub: dev({
        id: 'hub', name: 'Speaker Hub', kind: 'box', x: 500, y: 410, w: 200, h: 64,
        sockets: [sock('in', 'In', 'left'), sock('tv', 'TV', 'top'), sock('spk', 'Speakers', 'right')],
        settings: { power: 'left' },
        settingSpecs: { power: spec('Plugged into', [['left', 'Left wall outlet'], ['strip', 'Power strip']]) },
      }),
      speakers: dev({ id: 'speakers', name: 'Speakers', kind: 'soundbar', x: 790, y: 300, w: 150, h: 56, noPower: true, sockets: [sock('in', 'In', 'left')] }),
      tv: dev({ id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170, sockets: [{ id: 'in1', label: 'Input 1', side: 'bottom' }] }),
    },
    cables: {
      line: { id: 'line', kind: 'coax', a: { ...WALL }, b: { ...BOX_IN } },
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'hub', socket: 'in' } },
      c2: { id: 'c2', kind: 'standard', a: { device: 'hub', socket: 'tv' }, b: { device: 'tv', socket: 'in1' } },
      spk: { id: 'spk', kind: 'speaker', a: { device: 'hub', socket: 'spk' }, b: { device: 'speakers', socket: 'in' } },
    },
    installedParts: [],
    flags: {},
  }),

  legal: (s, a) =>
    a.type === 'installPart' && a.part === 'humStopper' && plugged(s) ? 'Unplug the wall cable from the Cable Box first.' : null,

  goal: (s) => plugged(s) && stopper(s) && allOn(s, 'cablebox', 'hub', 'tv'),

  view: (s) => {
    const on = allOn(s, 'cablebox', 'hub');
    return {
      lines: {
        line: { signal: 'picture', state: hum(s) ? 'hum' : plugged(s) ? 'ok' : 'idle' },
        c1: { signal: 'sound', state: on ? (plugged(s) ? 'ok' : 'idle') : 'idle' },
        c2: { signal: 'picture', state: on && plugged(s) ? 'ok' : 'idle' },
        spk: { signal: 'sound', state: hum(s) ? 'hum' : on && plugged(s) ? 'ok' : 'idle' },
      },
      links: hum(s) ? [{ id: 'loop', from: 'wall', to: 'hub', signal: 'sound', state: 'hum', icon: '〰' }] : [],
      status: {
        wall: { text: stopper(s) ? '🔇 Hum Stopper fitted' : 'Cable from outside', tone: 'neutral' },
        cablebox: s.devices.cablebox.powered ? { text: plugged(s) ? 'Sending picture + sound' : 'No line from outside', tone: plugged(s) ? 'good' : 'bad' } : { text: 'Off', tone: 'neutral' },
        hub: s.devices.hub.powered ? { text: s.devices.hub.settings.power === 'strip' ? 'On the power strip' : 'On the left outlet', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        speakers: hum(s) ? { text: 'BZZZZZZZ', tone: 'bad' } : plugged(s) ? { text: '♪ Clean sound', tone: 'good' } : { text: 'Quiet. No hum!', tone: 'neutral' },
        tv: plugged(s) && on ? { text: 'Jazz concert', tone: 'good' } : { text: 'No Signal', tone: 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'moveCable', cable: 'line', end: 'b', to: null }, hint: 'Unplug the wall cable from the Cable Box to test it. Does the hum stop?' },
    { pattern: { type: 'installPart', part: 'humStopper' }, hint: 'The hum came through that cable. Fit a Hum Stopper.' },
    { pattern: { type: 'moveCable', cable: 'line', end: 'b', to: { ...BOX_IN }, when: stopper }, hint: 'Plug the wall cable back into the Cable Box.' },
  ],

  bonus: {
    pattern: { type: 'setting', device: 'hub', key: 'power', value: 'strip' },
    reward: 15,
    message: 'Everything shares one power strip now. Vic is impressed.',
  },

  inspect: {
    wall: 'The cable from outside. It ties the house to the street’s wiring.',
    hub: 'Plugged into a different wall outlet than the Cable Box.',
    line: 'A wavy red loop runs from this cable around to the Speaker Hub. That’s the hum’s path.',
    speakers: 'They buzz even with the volume at zero.',
  },

  ask: [
    { id: 'when', question: 'When does it hum?', answer: 'All the time. Even muted. Even with the TV off, if the Cable Box is on.' },
    { id: 'new', question: 'Anything new in the setup?', answer: 'The cable company ran a new line in last month. Coincidence? I think not.' },
  ],

  thanks: 'Silence. Beautiful, beautiful silence. Now listen to this record…',
  tipCard: 'If unplugging a cable stops the hum, the hum came through that cable.',
};
