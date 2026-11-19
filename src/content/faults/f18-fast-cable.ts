// Fault #18 "Game Console Screen Blinks Black" — see docs/fault-library.md.

import type { Fault, LineState, RoomState } from '../../engine/types';
import { allOn, button, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const fast = (s: RoomState) => s.cables.cc.kind === 'fast';
const turbo = (s: RoomState) => s.devices.tv.settings.turbo === 'on';
const tuned = (s: RoomState) => s.devices.console.settings.tuned === 'yes';
const showing = (s: RoomState) => allOn(s, 'tv', 'console') && inputSource(s) === 'console';

function line(s: RoomState): LineState {
  if (!s.devices.console.powered) return 'idle';
  if (!fast(s)) return turbo(s) ? 'failed' : 'unstable';
  return turbo(s) && tuned(s) ? 'ok' : 'weak';
}

export const f18FastCable: Fault = {
  id: 'f18',
  number: 18,
  tier: 4,
  title: 'Game Console Screen Blinks Black',
  caller: 'brennan',
  call: { text: 'Every few minutes the kid’s new console blinks to black for a second, then comes back.' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in2', turbo: 'off' },
        settingSpecs: { input: inputSpec(2), turbo: spec('Turbo Mode (Input 2)', [['off', 'Off'], ['on', 'On']]) },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 120, y: 420, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      console: dev({
        id: 'console', name: 'Game Console', kind: 'console', x: 620, y: 420, w: 210, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
        settings: { tuned: 'no', setup: 'rest' },
        settingSpecs: { setup: button('Screen setup', [['run', 'Run screen setup']]) },
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      cc: { id: 'cc', kind: 'standard', a: { device: 'console', socket: 'out' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  legal: (s, a) => (a.type === 'installPart' && a.part === 'fastCable' && fast(s) ? 'It already has a Fast Cable.' : null),

  rules: (_before, a, s) => {
    const con = s.devices.console.settings;
    if (a.type === 'installPart' && a.part === 'fastCable') {
      s.cables.cc.kind = 'fast';
      con.tuned = 'no';
    }
    if (a.type === 'setting' && a.device === 'tv' && a.key === 'turbo') con.tuned = 'no';
    if (a.type === 'setting' && a.device === 'console' && a.value === 'run') con.tuned = fast(s) && turbo(s) ? 'yes' : 'no';
    return s;
  },

  goal: (s) => fast(s) && turbo(s) && tuned(s) && showing(s),

  view: (s) => {
    const l = line(s);
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        cc: { signal: 'picture', state: l },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : !showing(s)
            ? { text: 'Cable TV', tone: 'neutral' }
            : l === 'failed'
              ? { text: 'Black! It keeps blinking out', tone: 'bad' }
              : l === 'unstable'
                ? { text: 'Blinks black every few minutes', tone: 'bad' }
                : l === 'weak'
                  ? { text: 'Steady, but not at full speed', tone: 'neutral' }
                  : { text: 'Super smooth! 🎮', tone: 'good' },
        cablebox: s.devices.cablebox.powered ? { text: 'On Input 1', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
        console: !s.devices.console.powered
          ? { text: 'Off', tone: 'neutral' }
          : { text: `${fast(s) ? '🥇 Fast Cable' : 'Old Cable'} · ${tuned(s) ? 'Screen set up ✓' : 'Screen not set up'}`, tone: tuned(s) ? 'good' : 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'installPart', part: 'fastCable' }, hint: 'The cable says “Old Cable.” Swap in a Fast Cable (gold label).' },
    { pattern: { type: 'setting', device: 'tv', key: 'turbo', value: 'on', when: fast }, hint: 'Now turn on Turbo Mode for Input 2 on the TV.' },
    { pattern: { type: 'setting', device: 'console', key: 'setup', value: 'run', when: (s) => fast(s) && turbo(s) }, hint: 'Last, run the console’s screen setup so it uses the new speed.' },
  ],

  harmful: [
    {
      pattern: { type: 'setting', device: 'tv', key: 'turbo', value: 'on', when: (s) => !fast(s) },
      effect: (s) => s,
      message: 'Turbo Mode on an old cable: now it blinks out constantly!',
    },
  ],

  inspect: {
    cc: 'The label on this cable says “Old Cable.” It can’t carry the console’s super-fast picture.',
    tv: 'Input 2 has a Turbo Mode setting. It’s off.',
    console: 'A brand-new console that sends a super-fast picture. Its screen setup was never run.',
  },

  ask: [
    { id: 'cable', question: 'Which cable did you use?', answer: 'Liam: “The one from the old console. A cable’s a cable.” (It is not.)' },
    { id: 'when', question: 'When does it blink?', answer: 'Every few minutes. Always in the middle of a boss fight, Liam says.' },
  ],

  thanks: 'Liam actually said thank you. Out loud. Merry Christmas to me!',
  tipCard: 'Fast games need fast cables.',
};
