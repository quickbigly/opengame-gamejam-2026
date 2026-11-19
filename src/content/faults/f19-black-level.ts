// Fault #19 "The PC Looks Gray and Foggy" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const BLACK = spec('Black Level', [['soft', 'Soft'], ['deep', 'Deep']]);
const LEVEL = (label: string) => spec(label, [['normal', 'Normal'], ['high', 'High']]);

const pc = (s: RoomState) => s.devices.pc.settings;
const tv = (s: RoomState) => s.devices.tv.settings;
const hdrOff = (s: RoomState) => pc(s).hdr === 'off';
const blackMatch = (s: RoomState) => pc(s).black === tv(s).black;
const muddy = (s: RoomState) => tv(s).brightness === 'high' || tv(s).contrast === 'high';
const game = (s: RoomState) => tv(s).mode === 'game';
const showing = (s: RoomState) => allOn(s, 'tv', 'pc') && inputSource(s) === 'pc';

export const f19BlackLevel: Fault = {
  id: 'f19',
  number: 19,
  tier: 4,
  title: 'The PC Looks Gray and Foggy',
  caller: 'nakamura',
  call: { text: 'My son hooked his computer to the big TV for family game night. Everything looks gray and foggy.' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in2', mode: 'standard', black: 'deep', brightness: 'normal', contrast: 'normal' },
        settingSpecs: {
          input: inputSpec(2),
          mode: spec('Picture Mode', [['standard', 'Standard'], ['vivid', 'Vivid'], ['movie', 'Movie'], ['game', 'Game']]),
          black: BLACK,
          brightness: LEVEL('Brightness'),
          contrast: LEVEL('Contrast'),
        },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 120, y: 420, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      pc: dev({
        id: 'pc', name: 'Computer', kind: 'laptop', x: 620, y: 410, w: 230, h: 72,
        sockets: [sock('out', 'Picture Out', 'top')],
        settings: { hdr: 'on', black: 'soft' },
        settingSpecs: { hdr: spec('HDR', [['on', 'On'], ['off', 'Off']]), black: BLACK },
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      pcc: { id: 'pcc', kind: 'standard', a: { device: 'pc', socket: 'out' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (before, a, s) => {
    // Switching HDR off resets the computer's Black Level; a new Picture Mode brings its own Black Level.
    if (a.type === 'setting' && a.device === 'pc' && a.key === 'hdr' && a.value === 'off' && pc(before).hdr === 'on') pc(s).black = 'soft';
    if (a.type === 'setting' && a.device === 'tv' && a.key === 'mode' && a.value !== tv(before).mode) tv(s).black = 'deep';
    return s;
  },

  goal: (s) => showing(s) && hdrOff(s) && blackMatch(s) && game(s) && !muddy(s),

  view: (s) => {
    const clear = hdrOff(s) && blackMatch(s) && !muddy(s);
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        pcc: { signal: 'picture', state: !s.devices.pc.powered ? 'idle' : clear ? 'ok' : 'weak' },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : !showing(s)
            ? { text: 'Cable TV', tone: 'neutral' }
            : !hdrOff(s)
              ? { text: 'Gray and foggy', tone: 'bad' }
              : !blackMatch(s)
                ? { text: 'Blacks look gray', tone: 'bad' }
                : muddy(s)
                  ? { text: 'Dark scenes look muddy', tone: 'bad' }
                  : !game(s)
                    ? { text: 'Looks right, but the controls lag', tone: 'neutral' }
                    : { text: 'Crisp and dark. Game night! 🎲', tone: 'good' },
        cablebox: s.devices.cablebox.powered ? { text: 'On Input 1', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        pc: !s.devices.pc.powered
          ? { text: 'Off', tone: 'neutral' }
          : { text: `HDR ${hdrOff(s) ? 'off' : 'on'} · Black: ${pc(s).black === 'deep' ? 'Deep' : 'Soft'}`, tone: hdrOff(s) && blackMatch(s) ? 'good' : 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'pc', key: 'hdr', value: 'off' }, hint: 'The computer has HDR on for no reason. Turn it off.' },
    { pattern: { type: 'setting', device: 'pc', key: 'black', value: 'deep', when: hdrOff }, hint: 'Now make both ends agree: set the computer’s Black Level to Deep, like the TV.' },
    { pattern: { type: 'setting', device: 'tv', key: 'mode', value: 'game' }, hint: 'Last, set the TV’s Picture Mode to Game.' },
  ],
  alternatives: [
    [
      { pattern: { type: 'setting', device: 'pc', key: 'hdr', value: 'off' }, hint: 'Turn off HDR on the computer.' },
      { pattern: { type: 'setting', device: 'tv', key: 'mode', value: 'game' }, hint: 'Set the TV’s Picture Mode to Game.' },
      { pattern: { type: 'setting', device: 'tv', key: 'black', value: 'soft', when: game }, hint: 'Now make both ends agree: set the TV’s Black Level to Soft, like the computer.' },
    ],
  ],

  inspect: {
    pc: 'HDR is on, though nothing here needs it. Its Black Level says Soft.',
    tv: 'The TV’s Black Level says Deep. The two ends disagree about how dark black is.',
    pcc: 'The picture arrives fine. It’s just washed out.',
  },

  ask: [
    { id: 'tried', question: 'Did anyone change settings?', answer: 'Ken turned the brightness up. Then it was gray AND blinding.' },
    { id: 'computer', question: 'Is the computer new?', answer: 'New to the TV. It used to live on his desk with its own screen.' },
  ],

  thanks: 'Real black! Ken says the dungeon is “actually scary now.” Thank you… I think.',
  tipCard: 'When colors look foggy, both ends must agree on Black Level.',
};
