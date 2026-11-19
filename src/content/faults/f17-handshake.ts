// Fault #17 "Black Screen with an Error" — see docs/fault-library.md.

import { otherEnd } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, sock } from '../helpers';

const HANDSHAKE = ['handshake'];
const hub = (s: RoomState) => s.devices.hub.settings;
const on = (s: RoomState, id: string) => s.devices[id].powered;
/** The Streaming Box sits in a hub socket with the ✓ handshake badge. */
const inBadge = (s: RoomState) => {
  const p = otherEnd(s, { device: 'sbox', socket: 'out' });
  return p?.device === 'hub' && !!s.devices.hub.sockets.find((k) => k.id === p.socket)?.badges?.includes('handshake');
};
const shook = (s: RoomState) => hub(s).hs === 'yes';
const fresh = (s: RoomState) => hub(s).fresh === 'yes';

export const f17Handshake: Fault = {
  id: 'f17',
  number: 17,
  tier: 4,
  title: 'Black Screen with an Error',
  caller: 'june',
  call: { text: 'The new streaming box just shows a black screen and an error. The cable box works fine!' },

  setup: () => ({
    devices: {
      tv: dev({ id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170, sockets: [sock('in1', 'Input 1', 'bottom')] }),
      hub: dev({
        id: 'hub', name: 'Speaker Hub', kind: 'box', x: 380, y: 400, w: 240, h: 64,
        sockets: [
          sock('out', 'TV', 'top'),
          sock('in1', 'In 1', 'bottom', HANDSHAKE),
          sock('in2', 'In 2', 'bottom'),
          sock('in3', 'In 3', 'bottom', HANDSHAKE),
        ],
        // hs: the Streaming Box's handshake worked · fresh: the hub woke up after the TV, with its sockets as they are now.
        settings: { hs: 'no', fresh: 'yes' },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 60, y: 430, w: 180, h: 56, sockets: [sock('out', 'Picture Out', 'top')] }),
      sbox: dev({ id: 'sbox', name: 'Streaming Box', kind: 'box', x: 740, y: 430, w: 200, h: 56, sockets: [sock('out', 'Picture Out', 'top')] }),
    },
    cables: {
      ht: { id: 'ht', kind: 'standard', a: { device: 'hub', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      cb: { id: 'cb', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'hub', socket: 'in1' } },
      sb: { id: 'sb', kind: 'standard', a: { device: 'sbox', socket: 'out' }, b: { device: 'hub', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  // Devices say hello in the order they wake up: screen first, then the hub, then the box.
  rules: (_before, a, s) => {
    const h = hub(s);
    if (a.type === 'power' && a.device === 'tv') {
      h.fresh = 'no';
      h.hs = 'no';
    }
    if (a.type === 'power' && a.device === 'hub') {
      h.fresh = a.on && on(s, 'tv') ? 'yes' : 'no';
      h.hs = 'no';
    }
    if (a.type === 'moveCable' && a.cable === 'sb') {
      h.fresh = 'no';
      h.hs = 'no';
    }
    if (a.type === 'power' && a.device === 'sbox') h.hs = a.on && on(s, 'tv') && on(s, 'hub') && fresh(s) && inBadge(s) ? 'yes' : 'no';
    return s;
  },

  goal: (s) => shook(s) && inBadge(s) && allOn(s, 'tv', 'hub', 'sbox'),

  view: (s) => {
    const chain = allOn(s, 'tv', 'hub');
    const boxOn = on(s, 'sbox');
    const playing = chain && boxOn && shook(s);
    return {
      lines: {
        ht: { signal: 'picture', state: !chain ? 'idle' : playing ? 'ok' : boxOn ? 'failed' : 'weak' },
        cb: { signal: 'picture', state: on(s, 'cablebox') ? 'weak' : 'idle' },
        sb: { signal: 'picture', state: !boxOn ? 'idle' : playing ? 'ok' : 'failed' },
      },
      status: {
        tv: !on(s, 'tv')
          ? { text: 'Off', tone: 'neutral' }
          : playing
            ? { text: 'Auntie June’s holiday movie!', tone: 'good' }
            : boxOn && on(s, 'hub')
              ? { text: '⚠ “This picture can’t be shown here”', tone: 'bad' }
              : { text: 'No Signal', tone: 'bad' },
        hub: !on(s, 'hub')
          ? { text: 'Off', tone: 'neutral' }
          : { text: inBadge(s) ? (playing ? 'Handshake ✓' : 'Box in a ✓ socket') : 'Box in an old socket (no ✓)', tone: playing ? 'good' : inBadge(s) ? 'neutral' : 'bad' },
        cablebox: on(s, 'cablebox') ? { text: 'Works fine (In 1 ✓)', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        sbox: !boxOn ? { text: 'Off', tone: 'neutral' } : playing ? { text: 'Playing', tone: 'good' } : { text: 'Error: handshake failed', tone: 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'moveCable', cable: 'sb', end: 'b', to: { device: 'hub', socket: 'in3' } }, hint: 'Only some Hub sockets have the ✓ handshake badge. Move the Streaming Box to In 3.' },
    { pattern: { type: 'power', device: 'sbox', on: false }, hint: 'Now turn things off so they can say hello in order. Start with the Streaming Box.' },
    { pattern: { type: 'power', device: 'hub', on: false }, hint: 'Turn off the Speaker Hub.' },
    { pattern: { type: 'power', device: 'hub', on: true, when: (s) => on(s, 'tv') && !on(s, 'sbox') }, hint: 'The TV is on, so turn the Speaker Hub on next.' },
    { pattern: { type: 'power', device: 'sbox', on: true, when: (s) => allOn(s, 'tv', 'hub') && fresh(s) && inBadge(s) }, hint: 'Last, turn on the Streaming Box.' },
  ],
  alternatives: [
    [
      { pattern: { type: 'moveCable', cable: 'sb', end: 'b', to: { device: 'hub', socket: 'in3' } }, hint: 'Move the Streaming Box to In 3, a socket with the ✓ badge.' },
      { pattern: { type: 'power', device: 'sbox', on: false }, hint: 'Turn everything off: the Streaming Box…' },
      { pattern: { type: 'power', device: 'hub', on: false }, hint: '…the Speaker Hub…' },
      { pattern: { type: 'power', device: 'tv', on: false }, hint: '…and the TV.' },
      { pattern: { type: 'power', device: 'tv', on: true, when: (s) => !on(s, 'hub') && !on(s, 'sbox') }, hint: 'Now turn them on in order. TV first.' },
      { pattern: { type: 'power', device: 'hub', on: true, when: (s) => on(s, 'tv') && !on(s, 'sbox') }, hint: 'Then the Speaker Hub.' },
      { pattern: { type: 'power', device: 'sbox', on: true, when: (s) => allOn(s, 'tv', 'hub') && fresh(s) && inBadge(s) }, hint: 'Then the Streaming Box.' },
    ],
  ],

  inspect: {
    sb: 'A red ✗ on the line: “handshake failed.” It’s plugged into In 2, which has no ✓ badge.',
    hub: 'In 1 and In 3 have a little ✓ badge: they can do the handshake. In 2 is an old socket.',
    sbox: 'Brand new. Its picture is protected, so every device in the chain has to shake hands.',
    tv: 'The TV is fine. It shows whatever the Speaker Hub passes along.',
    cb: 'The Cable Box doesn’t need a handshake, so it works in any socket.',
  },

  ask: [
    { id: 'how', question: 'How did you plug it in?', answer: 'I used the empty socket in the middle. It looked lonely.' },
    { id: 'order', question: 'What do you turn on first?', answer: 'The streaming box, then the TV, then whatever that black box is.' },
  ],

  thanks: 'It works! Now, let me show you all 400 photos from Lisbon. Just kidding. Mostly.',
  tipCard: 'Turn on the screen first, then work backward to the box.',
};
