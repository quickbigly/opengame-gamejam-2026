// Fault #14 "Shows Buffer Every Evening" — see docs/fault-library.md.

import type { Fault, LineState, RoomState } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec } from '../helpers';

const out = (s: RoomState) => s.devices.stick.settings.place === 'out';
const fast = (s: RoomState) => s.devices.stick.settings.lane === 'fast';
const streaming = (s: RoomState) => allOn(s, 'tv', 'stick', 'wifi') && inputSource(s) === 'stick';

function wifiState(s: RoomState): LineState {
  if (!allOn(s, 'wifi', 'stick')) return 'idle';
  if (out(s) && fast(s)) return 'ok';
  return out(s) ? 'weak' : 'unstable';
}

export const f14Buffering: Fault = {
  id: 'f14',
  number: 14,
  tier: 3,
  title: 'Shows Buffer Every Evening',
  caller: 'lindqvist',
  call: { text: 'Shows are fine in the morning, but they keep loading-loading-loading every night!' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: [sock('in1', 'Input 1', 'bottom'), sock('in2', 'Input 2', 'right')],
        settings: { input: 'in2' },
        settingSpecs: { input: inputSpec(2) },
      }),
      stick: dev({
        // Tucked right against the back of the TV until an Extension Cable brings it out.
        id: 'stick', name: 'Streaming Stick', kind: 'box', x: 645, y: 128, w: 180, h: 52,
        sockets: [sock('hdmi', '', 'left')],
        settings: { lane: 'slow', place: 'behind' },
        settingSpecs: { lane: spec('Wi-Fi lane', [['slow', 'Slow lane (long reach)'], ['fast', 'Fast lane (short reach)']]) },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 300, y: 420, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      wifi: dev({ id: 'wifi', name: 'Wi-Fi Box', kind: 'router', x: 40, y: 420, w: 190, h: 64, sockets: [] }),
      neighbors: dev({ id: 'neighbors', name: 'Neighbors’ Wi-Fi', kind: 'outdoor', x: 690, y: 470, w: 220, h: 56, noPower: true, sockets: [] }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      st: { id: 'st', kind: 'standard', a: { device: 'stick', socket: 'hdmi' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  legal: (s, a) => (a.type === 'installPart' && a.part === 'extensionCable' && out(s) ? 'The stick is already out in the open.' : null),

  rules: (_before, a, s) => {
    if (a.type === 'installPart' && a.part === 'extensionCable') {
      const stick = s.devices.stick;
      stick.settings.place = 'out';
      stick.x = 690;
      stick.y = 290;
    }
    return s;
  },

  // The fast lane is short-range: it can't reach through the metal back of the TV.
  gates: [{ device: 'stick', key: 'lane', option: 'fast', requires: out }],

  goal: (s) => streaming(s) && out(s) && fast(s),

  view: (s) => {
    const st = wifiState(s);
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        st: { signal: 'picture', state: !allOn(s, 'stick') ? 'idle' : st === 'ok' ? 'ok' : st === 'idle' ? 'idle' : 'weak' },
      },
      links: [
        { id: 'air', from: 'wifi', to: 'stick', signal: 'internet', state: st },
        ...(fast(s) ? [] : [{ id: 'crowd', from: 'neighbors', to: 'stick', signal: 'internet' as const, state: 'unstable' as const, icon: '👥' }]),
      ],
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : inputSource(s) !== 'stick'
            ? { text: 'Cable TV', tone: 'neutral' }
            : st === 'ok'
              ? { text: 'Streaming smoothly ✨', tone: 'good' }
              : st === 'weak'
                ? { text: 'Loading… 61%', tone: 'bad' }
                : { text: 'Loading… loading… 12%', tone: 'bad' },
        stick: !s.devices.stick.powered
          ? { text: 'Off', tone: 'neutral' }
          : { text: `${out(s) ? 'Out in the open' : 'Behind the TV'} · ${fast(s) ? 'Fast lane' : 'Slow lane'}`, tone: st === 'ok' ? 'good' : 'bad' },
        cablebox: s.devices.cablebox.powered ? { text: 'On Input 1', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        wifi: s.devices.wifi.powered ? { text: 'Working fine', tone: 'good' } : { text: 'Off', tone: 'neutral' },
        neighbors: { text: fast(s) ? 'Crowding the slow lane' : 'Crowding your lane', tone: 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'installPart', part: 'extensionCable' }, hint: 'The stick is hidden behind the metal TV. Use an Extension Cable to bring it out into the open.' },
    { pattern: { type: 'setting', device: 'stick', key: 'lane', value: 'fast' }, hint: 'Now that it can see the Wi-Fi Box, switch the stick to the Fast lane.' },
  ],

  inspect: {
    stick: 'Plugged straight into the back of the TV. The TV’s metal back blocks most of its Wi-Fi.',
    wifi: 'Working fine. Its fast lane is quick but short-range; its slow lane reaches far but everyone uses it.',
    air: 'Thin and wobbly. It has to squeeze around the TV.',
    crowd: 'At night, everyone on Birch Lane streams on the same slow lane.',
    neighbors: 'You can see a dozen Wi-Fi names from here. All on the slow lane.',
  },

  ask: [
    { id: 'when', question: 'When does it start?', answer: 'Around supper, when the whole street gets home. Mornings are perfect.' },
    { id: 'router', question: 'Have you restarted the Wi-Fi Box?', answer: 'Every night! It doesn’t help, and the kids complain.' },
  ],

  thanks: 'Not a single spinning circle! The Christmas baking final, uninterrupted.',
  tipCard: 'Get Wi-Fi gadgets out from behind the TV.',
};
