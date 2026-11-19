// Fault #9 "Mouths Move Before the Words" — see docs/fault-library.md.

import { linked } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, inputSpec, sock, spec, tvInputs } from '../helpers';

const BAR = { device: 'soundbar', socket: 'tv' };
const SOUND_SOCKET = { device: 'tv', socket: 'in3' };

const wired = (s: RoomState) => linked(s, BAR, SOUND_SOCKET);
const wirelessOn = (s: RoomState) => s.devices.soundbar.settings.wireless === 'on';
const tv = (s: RoomState) => s.devices.tv.settings;
const barCanPlay = (s: RoomState) => wired(s) && tv(s).auto === 'on' && !wirelessOn(s);

export const f09LipSync: Fault = {
  id: 'f09',
  number: 9,
  tier: 2,
  title: 'Mouths Move Before the Words',
  caller: 'nakamura',
  call: { text: "Everyone's lips move before the words come out. Drives me nuts!" },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(3, ['in3']),
        settings: { input: 'in1', auto: 'off', soundOut: 'wireless', lipSync: 'off' },
        settingSpecs: {
          input: inputSpec(3),
          auto: spec('Auto-control', [['off', 'Off'], ['on', 'On']]),
          soundOut: spec('Sound Output', [['tv', 'TV Speakers'], ['wireless', 'Wireless Speaker'], ['bar', 'Sound Bar']]),
          lipSync: spec('Lip Sync', [['off', 'Off'], ['auto', 'Auto']]),
        },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 110, y: 410, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      soundbar: dev({
        id: 'soundbar', name: 'Sound Bar', kind: 'soundbar', x: 560, y: 420, w: 300, h: 48,
        sockets: [sock('tv', 'TV', 'top')],
        settings: { wireless: 'on' },
        settingSpecs: { wireless: spec('Wireless', [['on', 'Connected'], ['off', 'Disconnect']]) },
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      spare: { id: 'spare', kind: 'standard', a: { ...BAR }, b: null },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (before, a, s) => {
    // Without the wireless link, the TV falls back to its own speakers.
    if (a.type === 'setting' && a.device === 'soundbar' && a.key === 'wireless' && a.value === 'off' && tv(s).soundOut === 'wireless') {
      tv(s).soundOut = 'tv';
    }
    // Lip Sync is tuned per output; switching outputs resets it.
    if (a.type === 'setting' && a.device === 'tv' && a.key === 'soundOut' && tv(before).soundOut !== a.value) tv(s).lipSync = 'off';
    return s;
  },

  gates: [
    { device: 'tv', key: 'soundOut', option: 'bar', requires: barCanPlay },
    { device: 'tv', key: 'soundOut', option: 'wireless', requires: wirelessOn },
  ],

  goal: (s) => allOn(s, 'tv', 'soundbar', 'cablebox') && barCanPlay(s) && tv(s).soundOut === 'bar' && tv(s).lipSync === 'auto',

  view: (s) => {
    const out = tv(s).soundOut;
    const inSync = out === 'bar' && tv(s).lipSync === 'auto';
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        spare: { signal: 'sound', state: out === 'bar' && wired(s) ? (inSync ? 'ok' : 'unstable') : wired(s) ? 'weak' : 'idle' },
      },
      links:
        wirelessOn(s) && out === 'wireless'
          ? [{ id: 'bt', from: 'tv', to: 'soundbar', signal: 'sound', state: 'weak', icon: '⏱' }]
          : [],
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : out === 'wireless'
            ? { text: 'Lips move before the words', tone: 'bad' }
            : out === 'tv'
              ? { text: 'Sound from TV speakers', tone: 'bad' }
              : inSync
                ? { text: 'In sync!', tone: 'good' }
                : { text: 'Close… still a little off', tone: 'bad' },
        soundbar: { text: wirelessOn(s) ? 'Wireless: connected ⏱' : wired(s) ? 'Wired' : 'Waiting for sound', tone: out === 'bar' ? 'good' : 'neutral' },
        cablebox: s.devices.cablebox.powered ? { text: 'Sending picture + sound', tone: 'good' } : { text: 'Off', tone: 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'soundbar', key: 'wireless', value: 'off' }, hint: 'Wireless sound arrives late. Disconnect the Sound Bar’s wireless link.' },
    { pattern: { type: 'moveCable', cable: 'spare', end: 'b', to: { ...SOUND_SOCKET } }, hint: 'Plug the loose cable into the TV’s sound socket (the one with the speaker icon).' },
    { pattern: { type: 'setting', device: 'tv', key: 'auto', value: 'on' }, hint: 'Turn on Auto-control on the TV.' },
    { pattern: { type: 'setting', device: 'tv', key: 'soundOut', value: 'bar' }, hint: 'Set the TV’s Sound Output to Sound Bar.' },
    {
      pattern: { type: 'setting', device: 'tv', key: 'lipSync', value: 'auto', when: (s) => tv(s).soundOut === 'bar' },
      hint: 'Last, set Lip Sync to Auto.',
    },
  ],

  inspect: {
    soundbar: 'It’s getting sound wirelessly. There’s a little clock icon: wireless sound arrives late.',
    spare: 'A cable lies behind the TV, plugged into the Sound Bar at one end. The other end is loose.',
    tv: 'Input 3 has the speaker icon: the sound socket. It’s empty.',
    bt: 'The wireless sound line. The clock means delay.',
  },

  ask: [
    { id: 'cable', question: 'What’s that cable behind the TV?', answer: 'It came with the Sound Bar. The wireless was easier, so we never used it.' },
    { id: 'tried', question: 'Did you change any settings?', answer: 'I fiddled with Lip Sync once, but then I changed something else and it went wrong again.' },
  ],

  thanks: 'Their mouths match the words! We can finally turn the subtitles off. …We won’t, but we could.',
  tipCard: 'Wires beat wireless for sound timing.',
};
