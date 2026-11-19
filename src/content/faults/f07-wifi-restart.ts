// Fault #7 "Internet's Out After the Lights Flickered" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { dev, sock } from '../helpers';

/** 'stuck' looks ready (solid light) but lost its connection in the storm until it's restarted. */
type Modem = 'off' | 'booting' | 'ready' | 'stuck';
const modem = (s: RoomState) => s.devices.modem.settings.state as Modem;
const linked = (s: RoomState) => s.devices.wifi.powered && s.devices.wifi.settings.link === 'ok' && modem(s) === 'ready';
const BOOT_MINUTES = 5;

export const f07WifiRestart: Fault = {
  id: 'f07',
  number: 7,
  tier: 2,
  title: "Internet's Out After the Lights Flickered",
  caller: 'dottie',
  call: { text: 'The lights blinked in the storm and now the TV says no internet.' },

  setup: () => ({
    devices: {
      wall: dev({ id: 'wall', name: 'Wall Jack', kind: 'outlet', x: 40, y: 300, w: 120, h: 56, noPower: true, sockets: [sock('out', 'Line', 'right')] }),
      modem: dev({
        id: 'modem', name: 'Internet Box', kind: 'router', x: 240, y: 410, w: 190, h: 64,
        sockets: [sock('line', 'Line', 'left'), sock('lan', 'Out', 'right')],
        settings: { state: 'stuck' },
      }),
      wifi: dev({
        id: 'wifi', name: 'Wi-Fi Box', kind: 'router', x: 560, y: 410, w: 190, h: 64,
        sockets: [sock('wan', 'Internet', 'left')],
        settings: { link: 'none' },
      }),
      tv: dev({ id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 50, w: 280, h: 170, sockets: [] }),
    },
    cables: {
      line: { id: 'line', kind: 'coax', a: { device: 'wall', socket: 'out' }, b: { device: 'modem', socket: 'line' } },
      lan: { id: 'lan', kind: 'standard', a: { device: 'modem', socket: 'lan' }, b: { device: 'wifi', socket: 'wan' } },
    },
    installedParts: [],
    flags: {},
  }),

  // The Wi-Fi Box only looks for the Internet Box when it wakes up.
  rules: (_before, a, s) => {
    const m = s.devices.modem.settings;
    const w = s.devices.wifi.settings;
    if (a.type === 'power' && a.device === 'modem') {
      m.state = a.on ? 'booting' : 'off';
      if (!a.on) w.link = 'none';
    }
    if (a.type === 'wait' && m.state === 'booting' && a.minutes >= BOOT_MINUTES) m.state = 'ready';
    if (a.type === 'power' && a.device === 'wifi') w.link = a.on && m.state === 'ready' ? 'ok' : 'none';
    return s;
  },

  goal: (s) => linked(s),

  view: (s) => {
    const m = modem(s);
    return {
      lines: {
        line: { signal: 'internet', state: 'ok' },
        lan: { signal: 'internet', state: linked(s) ? 'ok' : m === 'booting' ? 'unstable' : m === 'off' || !s.devices.wifi.powered ? 'idle' : 'failed' },
      },
      links: [{ id: 'air', from: 'wifi', to: 'tv', signal: 'internet', state: linked(s) ? 'ok' : s.devices.wifi.powered ? 'failed' : 'idle' }],
      status: {
        wall: { text: 'Internet from outside', tone: 'neutral' },
        modem: m === 'off' ? { text: 'Off', tone: 'neutral' } : m === 'booting' ? { text: '💡 Blinking… (warming up)', tone: 'neutral' } : { text: '💡 Solid light', tone: m === 'ready' ? 'good' : 'neutral' },
        wifi: !s.devices.wifi.powered ? { text: 'Off', tone: 'neutral' } : linked(s) ? { text: 'Connected', tone: 'good' } : { text: '⚠ No internet', tone: 'bad' },
        tv: linked(s) ? { text: 'Baking show streaming!', tone: 'good' } : { text: 'No internet connection', tone: 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'power', device: 'wifi', on: false }, hint: 'Turn the Wi-Fi Box off first.' },
    { pattern: { type: 'power', device: 'modem', on: false, when: (s) => !s.devices.wifi.powered }, hint: 'Now restart the Internet Box: turn it off…' },
    { pattern: { type: 'power', device: 'modem', on: true, when: (s) => !s.devices.wifi.powered }, hint: '…and back on.' },
    { pattern: { type: 'wait', minutes: BOOT_MINUTES, when: (s) => modem(s) === 'booting' }, hint: 'Wait for the Internet Box’s light to turn solid (press Space).' },
    { pattern: { type: 'power', device: 'wifi', on: true, when: (s) => modem(s) === 'ready' }, hint: 'Its light is solid. Turn the Wi-Fi Box back on.' },
  ],

  inspect: {
    modem: 'Its light is solid, but the storm knocked its connection loose. The Wi-Fi Box woke up before it was ready.',
    wifi: 'It says “no internet.” It only looks for the Internet Box when it starts up.',
    lan: 'The green line between the boxes is broken. They never said hello.',
    wall: 'The line from outside is fine.',
  },

  ask: [
    { id: 'storm', question: 'What happened when the lights blinked?', answer: 'Everything went dark for a second. The little boxes came back on by themselves… I think.' },
    { id: 'tried', question: 'Have you tried restarting anything?', answer: 'I switched the Wi-Fi Box off and on twice. No luck.' },
  ],

  thanks: 'My baking show! Take a cinnamon roll. Take two!',
  tipCard: 'Internet Box first, Wi-Fi Box second.',
};
