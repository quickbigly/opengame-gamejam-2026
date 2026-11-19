// Fault #16 "Headphones Won't Connect" — see docs/fault-library.md.

import type { Fault, LinkView, RoomState } from '../../engine/types';
import { allOn, button, dev, inputSpec, sock, tvInputs } from '../helpers';

/** What the TV's wireless sound is connected to. */
type Bt = 'patio' | 'none' | 'headphones';
/** normal · pairing (blinking blue) · failed (the TV was busy). */
type Mode = 'normal' | 'pairing' | 'failed';
const bt = (s: RoomState) => s.devices.tv.settings.bt as Bt;
const mode = (s: RoomState) => s.devices.phones.settings.mode as Mode;

export const f16Headphones: Fault = {
  id: 'f16',
  number: 16,
  tier: 3,
  title: 'Headphones Won’t Connect',
  caller: 'rosa',
  call: { text: 'I got Grandpa wireless headphones for the TV so the rest of us can sleep, but they won’t connect!' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in1', bt: 'patio', wireless: 'rest' },
        settingSpecs: {
          input: inputSpec(2),
          wireless: button('Wireless sound', [['forget', 'Forget “Patio Speaker”'], ['connect', 'Connect “Headphones”']]),
        },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 120, y: 420, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      phones: dev({
        id: 'phones', name: 'Headphones', kind: 'other', x: 620, y: 420, w: 200, h: 64,
        sockets: [],
        settings: { mode: 'normal', pair: 'rest' },
        settingSpecs: { pair: button('Button', [['pair', 'Hold to pair']]) },
      }),
      patio: dev({ id: 'patio', name: 'Patio Speaker (garage)', kind: 'outdoor', x: 740, y: 40, w: 230, h: 56, noPower: true, sockets: [] }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (_before, a, s) => {
    const tv = s.devices.tv.settings;
    const ph = s.devices.phones.settings;
    if (a.type === 'setting' && a.device === 'tv' && a.key === 'wireless') {
      if (a.value === 'forget') tv.bt = 'none';
      if (a.value === 'connect') {
        tv.bt = 'headphones';
        ph.mode = 'normal';
      }
    }
    // The TV only takes one wireless sound device; while it's busy, pairing times out.
    if (a.type === 'setting' && a.device === 'phones' && a.value === 'pair') ph.mode = tv.bt === 'none' ? 'pairing' : tv.bt === 'patio' ? 'failed' : 'normal';
    if (a.type === 'power' && a.device === 'phones' && !a.on) ph.mode = 'normal';
    return s;
  },

  gates: [
    { device: 'tv', key: 'wireless', option: 'forget', requires: (s) => bt(s) === 'patio' },
    { device: 'tv', key: 'wireless', option: 'connect', requires: (s) => mode(s) === 'pairing' && bt(s) === 'none' },
  ],

  goal: (s) => bt(s) === 'headphones' && allOn(s, 'tv', 'phones'),

  view: (s) => {
    const links: LinkView[] = [];
    // Links meet the TV at its edge, clear of the words on its screen.
    const tvEdge = { dx: 272, dy: 150 };
    if (bt(s) === 'patio') links.push({ id: 'patioLink', from: 'patio', to: 'tv', signal: 'sound', state: 'ok', toOffset: { dx: 280, dy: 30 } });
    if (bt(s) === 'headphones' && allOn(s, 'phones')) links.push({ id: 'phonesLink', from: 'phones', to: 'tv', signal: 'sound', state: 'ok', toOffset: tvEdge });
    if (mode(s) === 'pairing') links.push({ id: 'phonesLink', from: 'phones', to: 'tv', signal: 'sound', state: 'weak', icon: '…', toOffset: tvEdge });
    if (mode(s) === 'failed') links.push({ id: 'phonesLink', from: 'phones', to: 'tv', signal: 'sound', state: 'failed', icon: '✗', toOffset: tvEdge });
    const m = mode(s);
    return {
      lines: { c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' } },
      links,
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : bt(s) === 'headphones'
            ? { text: 'Sound: Headphones 🎧', tone: 'good' }
            : bt(s) === 'patio'
              ? { text: 'Sound: Patio Speaker (connected)', tone: 'bad' }
              : { text: 'Sound: TV speakers', tone: 'neutral' },
        cablebox: s.devices.cablebox.powered ? { text: 'Late-night movie', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        phones: !s.devices.phones.powered
          ? { text: 'Off', tone: 'neutral' }
          : bt(s) === 'headphones'
            ? { text: 'Connected ♪', tone: 'good' }
            : m === 'pairing'
              ? { text: 'Pairing… (blinking blue)', tone: 'neutral' }
              : m === 'failed'
                ? { text: 'Pairing failed: the TV is busy', tone: 'bad' }
                : { text: 'Not connected', tone: 'bad' },
        patio: { text: bt(s) === 'patio' ? 'Playing to an empty garage' : 'Forgotten. Quiet now.', tone: bt(s) === 'patio' ? 'bad' : 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'tv', key: 'wireless', value: 'forget' }, hint: 'The TV only connects one wireless sound device. Forget the Patio Speaker first.' },
    { pattern: { type: 'setting', device: 'phones', key: 'pair', value: 'pair', when: (s) => bt(s) === 'none' }, hint: 'Hold the headphones’ button to put them in pairing mode.' },
    { pattern: { type: 'setting', device: 'tv', key: 'wireless', value: 'connect' }, hint: 'Now connect the Headphones from the TV’s Wireless sound menu.' },
  ],

  inspect: {
    tv: 'Its wireless sound list says: “Patio Speaker (connected).” Only one at a time.',
    patio: 'Still plugged in out in the garage, from the summer barbecue. It grabs the TV whenever it can.',
    phones: 'Brand new, fully charged. They pair by holding the button.',
    patioLink: 'The TV is sending its sound all the way out to the garage.',
  },

  ask: [
    { id: 'patio', question: 'Is there a speaker in the garage?', answer: 'Oh! The one Tony set up for the barbecue. Nobody’s turned it off since July.' },
    { id: 'grandpa', question: 'How loud does Grandpa watch TV?', answer: 'Loud enough that the neighbors know the plot.' },
  ],

  thanks: 'Grandpa’s grinning in his headphones and the house is finally quiet. Bless you.',
  tipCard: 'Wireless sound: one at a time. Clear the old one first.',
};
