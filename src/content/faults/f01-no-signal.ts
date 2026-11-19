// Fault #1 "It Says No Signal" — see docs/fault-library.md.

import type { Fault } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, pluggedName, sock, spec, tvInputs } from '../helpers';

export const f01NoSignal: Fault = {
  id: 'f01',
  number: 1,
  tier: 1,
  title: 'It Says No Signal',
  caller: 'rosa',
  call: { text: "The TV just says No Signal! I didn't touch anything." },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 50, w: 280, h: 170,
        sockets: tvInputs(3),
        settings: { input: 'in2', names: 'numbers' },
        settingSpecs: { input: inputSpec(3), names: spec('Input Names', [['numbers', 'Numbers'], ['easy', 'Easy Names']]) },
      }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 170, y: 400, w: 180, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
      console: dev({
        id: 'console', name: 'Game Console', kind: 'console', x: 650, y: 400, w: 180, h: 64, powered: false,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      c2: { id: 'c2', kind: 'standard', a: { device: 'console', socket: 'out' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  goal: (s) => allOn(s, 'tv', 'cablebox') && inputSource(s) === 'cablebox',

  view: (s) => {
    const src = inputSource(s);
    const showing = src && s.devices[src].powered && s.devices.tv.powered ? src : null;
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        c2: { signal: 'picture', state: s.devices.console.powered ? 'ok' : 'idle' },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : showing === 'cablebox'
            ? { text: 'Weather channel is on!', tone: 'good' }
            : showing === 'console'
              ? { text: 'Game menu: "Press Start"', tone: 'neutral' }
              : { text: 'No Signal', tone: 'bad' },
        cablebox: s.devices.cablebox.powered ? { text: 'Sending a picture', tone: 'good' } : { text: 'Off', tone: 'neutral' },
        console: s.devices.console.powered ? { text: 'Sending a picture', tone: 'good' } : { text: 'Off', tone: 'neutral' },
      },
    };
  },

  optimal: [
    {
      pattern: { type: 'setting', device: 'tv', key: 'input', value: 'in1' },
      hint: "The TV is listening to Input 2, but the Cable Box's blue line goes into Input 1. Open the TV's settings and set Input to Input 1.",
    },
  ],

  bonus: {
    pattern: { type: 'setting', device: 'tv', key: 'names', value: 'easy' },
    reward: 10,
    message: 'Grandma Rosa can read the input names now. Bonus tip!',
  },

  optionLabel: (s, device, key, value) =>
    device === 'tv' && key === 'input' && s.devices.tv.settings.names === 'easy' ? pluggedName(s, 'tv', value) : undefined,

  inspect: {
    tv: 'The ear on Input 2 means the TV is listening there. The Cable Box’s blue line goes into Input 1.',
    cablebox: 'It’s on and sending a picture down its blue line.',
    console: 'It’s off. Someone must have left the TV on the game console’s input.',
    c1: 'A picture cable from the Cable Box to Input 1. It looks fine.',
    c2: 'A picture cable from the Game Console to Input 2. It looks fine.',
  },

  ask: [
    { id: 'who', question: 'Has anyone else used the TV lately?', answer: 'Only the grandkids, on Sunday. They had their game thing going all afternoon.' },
    { id: 'watch', question: 'What are you trying to watch?', answer: 'The weather channel, dear. On the cable box, like always.' },
  ],

  thanks: "Oh, there's my weatherman! You're an angel. Take a cookie for the road.",
  tipCard: 'No Signal usually means the TV is looking at the wrong socket.',
};
