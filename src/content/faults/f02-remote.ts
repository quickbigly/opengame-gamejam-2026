// Fault #2 "The Remote Stopped Working" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { dev, inputSpec, sock, spec, tvInputs } from '../helpers';

const SPOTS = { front: { x: 250, y: 252 }, lowered: { x: 560, y: 320 } };

const blocked = (s: RoomState) => s.devices.soundbar.settings.spot === 'front' && !s.installedParts.includes('remoteBooster');

export const f02Remote: Fault = {
  id: 'f02',
  number: 2,
  tier: 1,
  title: 'The Remote Stopped Working',
  caller: 'fenwick',
  call: { text: "Remote's dead. I even put new batteries in!" },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(2, ['in2']),
        settings: { input: 'in1' },
        settingSpecs: { input: inputSpec(2) },
      }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 690, y: 410, w: 180, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
      soundbar: dev({
        id: 'soundbar', name: 'Sound Bar', kind: 'soundbar', ...SPOTS.front, w: 260, h: 44,
        sockets: [sock('tv', 'TV', 'right')],
        settings: { spot: 'front' },
        settingSpecs: { spot: spec('Placement', [['front', 'Up front'], ['lowered', 'Slide down']]) },
      }),
      remote: dev({ id: 'remote', name: 'Remote', kind: 'remote', x: 110, y: 440, w: 120, h: 50, sockets: [], noPower: true }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      sb: { id: 'sb', kind: 'standard', a: { device: 'soundbar', socket: 'tv' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (_before, a, s) => {
    if (a.type === 'setting' && a.device === 'soundbar' && a.key === 'spot') {
      Object.assign(s.devices.soundbar, SPOTS[a.value as keyof typeof SPOTS]);
    }
    return s;
  },

  goal: (s) => !blocked(s) && s.devices.tv.powered,

  view: (s) => ({
    lines: {
      c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
      sb: { signal: 'sound', state: s.devices.soundbar.powered ? 'ok' : 'idle' },
    },
    links: [
      {
        id: 'ir', from: 'remote', to: 'tv', signal: 'control', toOffset: { dx: 40, dy: 165 },
        state: blocked(s) ? 'failed' : 'ok', stopsAt: blocked(s) ? 'soundbar' : undefined,
        icon: s.installedParts.includes('remoteBooster') ? '📡' : undefined,
      },
    ],
    status: {
      tv: s.devices.tv.powered ? { text: blocked(s) ? 'Ignoring the remote' : 'Answers the remote!', tone: blocked(s) ? 'bad' : 'good' } : { text: 'Off', tone: 'neutral' },
      soundbar: { text: s.devices.soundbar.settings.spot === 'front' ? 'Sitting up front' : 'Slid down a little', tone: 'neutral' },
      remote: { text: 'New batteries', tone: 'neutral' },
    },
  }),

  optimal: [
    { pattern: { type: 'setting', device: 'soundbar', key: 'spot', value: 'lowered' }, hint: 'The remote’s purple line hits the Sound Bar. Open the Sound Bar and slide it down out of the way.' },
  ],
  alternatives: [
    [{ pattern: { type: 'installPart', part: 'remoteBooster' }, hint: 'Fit a Remote Booster so the signal gets around the Sound Bar.' }],
  ],

  inspect: {
    tv: 'The TV’s remote sensor is the little dark window at its bottom-left corner.',
    soundbar: 'It sits right in front of the TV’s remote sensor.',
    remote: 'Fresh batteries. Its light blinks every time you press a button, so it works.',
    ir: 'The remote’s signal travels in a straight line. Something is in the way.',
  },

  ask: [
    { id: 'new', question: 'Did anything change near the TV lately?', answer: 'My daughter sent me that sound bar last week. Sounds wonderful. Fiddly to set up.' },
    { id: 'batteries', question: 'Which batteries did you use?', answer: 'Double-As, from the drawer. Sorted by size, of course.' },
  ],

  thanks: 'Click! It works! Fifty years of remotes and I never knew they needed to see the TV.',
  tipCard: 'Remotes need a clear path to the TV.',
};
