// Fault #11 "Internet Dies at 9 Every Night" — see docs/fault-library.md.

import { otherEnd } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { dev, sock } from '../helpers';

const onTimer = (s: RoomState, device: string) => otherEnd(s, { device, socket: 'pwr' })?.device === 'smartplug';
const powered = (s: RoomState, device: string) => !!otherEnd(s, { device, socket: 'pwr' });

export const f11SmartPlug: Fault = {
  id: 'f11',
  number: 11,
  tier: 2,
  title: 'Internet Dies at 9 Every Night',
  caller: 'brennan',
  call: { text: 'Like clockwork, the internet goes out at 9 PM and comes back at 7 AM!' },

  setup: () => ({
    devices: {
      wifi: dev({ id: 'wifi', name: 'Wi-Fi Box', kind: 'router', x: 160, y: 150, w: 190, h: 64, noPower: true, sockets: [sock('pwr', 'Power', 'bottom')] }),
      console: dev({ id: 'console', name: 'Game Console', kind: 'console', x: 650, y: 150, w: 190, h: 64, noPower: true, sockets: [sock('pwr', 'Power', 'bottom')] }),
      outlet: dev({
        id: 'outlet', name: 'Wall Outlet', kind: 'outlet', x: 560, y: 420, w: 190, h: 56, noPower: true,
        sockets: [sock('o1', 'Left', 'top'), sock('o2', 'Right', 'top')],
      }),
      smartplug: dev({
        id: 'smartplug', name: 'Smart Plug', kind: 'outlet', badge: '🌙', x: 230, y: 420, w: 170, h: 56, noPower: true,
        sockets: [sock('p1', 'Plug', 'top')],
      }),
    },
    cables: {
      pw: { id: 'pw', kind: 'power', a: { device: 'wifi', socket: 'pwr' }, b: { device: 'smartplug', socket: 'p1' } },
      pc: { id: 'pc', kind: 'power', a: { device: 'console', socket: 'pwr' }, b: { device: 'outlet', socket: 'o1' } },
    },
    installedParts: [],
    flags: {},
  }),

  goal: (s) => powered(s, 'wifi') && !onTimer(s, 'wifi'),

  view: (s) => ({
    lines: {
      pw: { signal: 'power', state: powered(s, 'wifi') ? 'ok' : 'idle' },
      pc: { signal: 'power', state: powered(s, 'console') ? 'ok' : 'idle' },
    },
    links: powered(s, 'wifi') ? [{ id: 'air', from: 'wifi', to: 'console', signal: 'internet', state: onTimer(s, 'wifi') ? 'weak' : 'ok' }] : [],
    status: {
      wifi: !powered(s, 'wifi')
        ? { text: 'No power', tone: 'bad' }
        : onTimer(s, 'wifi')
          ? { text: 'Loses power at 9 PM', tone: 'bad' }
          : { text: 'Always on', tone: 'good' },
      console: !powered(s, 'console')
        ? { text: 'No power', tone: 'neutral' }
        : onTimer(s, 'console')
          ? { text: 'Bedtime at 9 PM ✓', tone: 'good' }
          : { text: 'No bedtime', tone: 'neutral' },
      smartplug: { text: s.flags['asked:moon'] ? '🌙 Off 9 PM – 7 AM' : '🌙 A little moon icon', tone: 'neutral' },
      outlet: { text: 'Always on', tone: 'neutral' },
    },
  }),

  optimal: [
    { pattern: { type: 'ask', topic: 'moon' }, hint: 'Ask about the little moon icon on the Smart Plug.' },
    { pattern: { type: 'moveCable', cable: 'pw', end: 'b', to: { device: 'outlet', socket: 'o2' } }, hint: 'Move the Wi-Fi Box’s power cable to the free wall outlet.' },
  ],

  bonus: {
    pattern: { type: 'moveCable', cable: 'pc', end: 'b', to: { device: 'smartplug', socket: 'p1' } },
    reward: 25,
    message: 'The console goes to bed at 9 now. Mrs. Brennan is thrilled. Liam… less so.',
  },

  inspect: {
    smartplug: 'A Smart Plug with a little moon icon. It switches its power off on a schedule.',
    wifi: 'It works fine right now. It’s plugged into the Smart Plug.',
    console: 'Plugged straight into the wall.',
    pw: 'The Wi-Fi Box’s power comes from the Smart Plug.',
  },

  ask: [
    {
      id: 'moon',
      question: 'What’s the little moon on that plug?',
      answer: 'That’s my bedtime timer! It cuts the power at 9 so Liam stops gaming. …Wait. What’s plugged into it?',
    },
    { id: 'liam', question: 'What does Liam think is wrong?', answer: '“The router is garbage, Mom.” He says that about everything.' },
  ],

  thanks: 'So the internet was going to bed instead of Liam. That explains SO much.',
  tipCard: 'Ask before you replace anything.',
};
