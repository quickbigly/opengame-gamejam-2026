// Fault #12 "The TV Keeps Switching by Itself", plus its callback — see docs/fault-library.md.

import { linked } from '../../engine/room';
import type { Action, Fault, LinkView, RoomState, RoomView } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const BAR = { device: 'soundbar', socket: 'tv' };
const SOUND_SOCKET = { device: 'tv', socket: 'in3' };
const AUTO = spec('Auto-control', [['off', 'Off'], ['on', 'On']]);

const tv = (s: RoomState) => s.devices.tv.settings;
const cbAuto = (s: RoomState) => s.devices.cablebox.settings.auto === 'on';
/** The Cable Box's Auto-control drags the TV back whenever the console is on. */
const tug = (s: RoomState) => allOn(s, 'tv', 'cablebox', 'console') && tv(s).auto === 'on' && cbAuto(s);
const barPlays = (s: RoomState) => allOn(s, 'tv', 'soundbar') && linked(s, BAR, SOUND_SOCKET) && tv(s).auto === 'on' && tv(s).soundOut === 'bar';
const gameOn = (s: RoomState) => allOn(s, 'tv', 'console', 'cablebox') && inputSource(s) === 'console';

function room(over: { tvAuto: 'on' | 'off'; soundOut: 'tv' | 'bar'; input: string }): RoomState {
  return {
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(3, ['in3']),
        settings: { input: over.input, auto: over.tvAuto, soundOut: over.soundOut },
        settingSpecs: {
          input: inputSpec(3),
          auto: AUTO,
          soundOut: spec('Sound Output', [['tv', 'TV Speakers'], ['bar', 'Sound Bar']]),
        },
      }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 60, y: 420, w: 190, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
        settings: { auto: 'on' },
        settingSpecs: { auto: AUTO },
      }),
      console: dev({
        id: 'console', name: 'Game Console', kind: 'console', x: 300, y: 420, w: 200, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
        settings: { auto: 'on' },
        settingSpecs: { auto: AUTO },
      }),
      soundbar: dev({ id: 'soundbar', name: 'Sound Bar', kind: 'soundbar', x: 590, y: 430, w: 290, h: 48, sockets: [sock('tv', 'TV', 'top')] }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      c2: { id: 'c2', kind: 'standard', a: { device: 'console', socket: 'out' }, b: { device: 'tv', socket: 'in2' } },
      sb: { id: 'sb', kind: 'standard', a: { ...BAR }, b: { ...SOUND_SOCKET } },
    },
    installedParts: [],
    flags: {},
  };
}

function rules(_before: RoomState, _a: Action, s: RoomState): RoomState {
  if (tug(s) && tv(s).input === 'in2') tv(s).input = 'in1';
  // The Sound Bar is run by the TV's Auto-control.
  if (tv(s).auto === 'off' && tv(s).soundOut === 'bar') tv(s).soundOut = 'tv';
  return s;
}

function view(s: RoomState): RoomView {
  const links: LinkView[] = [];
  const pull = (from: string) => {
    const on = s.devices[from].powered && s.devices[from].settings.auto === 'on' && tv(s).auto === 'on';
    if (on) links.push({ id: `${from}-ctl`, from, to: 'tv', signal: 'control', state: tug(s) ? 'unstable' : 'ok' });
  };
  pull('cablebox');
  pull('console');
  const src = inputSource(s);
  return {
    lines: {
      c1: { signal: 'picture', state: s.devices.cablebox.powered ? (src === 'cablebox' ? 'ok' : 'weak') : 'idle' },
      c2: { signal: 'picture', state: s.devices.console.powered ? (src === 'console' ? 'ok' : 'weak') : 'idle' },
      sb: { signal: 'sound', state: barPlays(s) ? 'ok' : 'failed' },
    },
    links,
    status: {
      tv: !s.devices.tv.powered
        ? { text: 'Off', tone: 'neutral' }
        : gameOn(s)
          ? { text: 'Hockey game is on! 🏒', tone: 'good' }
          : src === 'cablebox'
            ? { text: 'Back on the cable channel. Again.', tone: 'bad' }
            : { text: 'No Signal', tone: 'bad' },
      cablebox: s.devices.cablebox.powered ? { text: `Auto-control: ${cbAuto(s) ? 'On' : 'Off'}`, tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
      console: s.devices.console.powered ? { text: 'Hockey game ready', tone: 'neutral' } : { text: 'Off', tone: 'neutral' },
      soundbar: barPlays(s) ? { text: '♪ Playing', tone: 'good' } : { text: 'Silent', tone: 'bad' },
    },
  };
}

const ASK = [
  { id: 'when', question: 'When does it switch?', answer: 'The second the console starts. Every time. Like the Cable Box is jealous.' },
  { id: 'remote', question: 'Does the remote still run the Sound Bar?', answer: 'It does! That part we love. Please don’t break that part.' },
];

export const f12Switching: Fault = {
  id: 'f12',
  number: 12,
  tier: 3,
  title: 'The TV Keeps Switching by Itself',
  caller: 'harmon',
  call: { text: 'Every time I start the game console, the TV flips back to the cable channel!' },

  setup: () => room({ tvAuto: 'on', soundOut: 'bar', input: 'in1' }),
  rules,
  view,
  goal: (s) => gameOn(s) && !tug(s),
  callbackIf: (s) => tv(s).auto === 'off',

  gates: [{ device: 'tv', key: 'soundOut', option: 'bar', requires: (s) => tv(s).auto === 'on' && linked(s, BAR, SOUND_SOCKET) }],

  optimal: [
    { pattern: { type: 'setting', device: 'cablebox', key: 'auto', value: 'off' }, hint: 'The Cable Box is the bossy one. Turn off Auto-control on the Cable Box only.' },
    { pattern: { type: 'setting', device: 'tv', key: 'input', value: 'in2', when: (s) => !tug(s) }, hint: 'Now switch the TV to Input 2, the Game Console.' },
  ],
  alternatives: [
    [
      { pattern: { type: 'power', device: 'cablebox', on: false }, hint: 'Find the bossy one: turn the Cable Box off and see if the tugging stops.' },
      { pattern: { type: 'power', device: 'cablebox', on: true }, hint: 'The tugging stopped, so it was the Cable Box. Turn it back on.' },
      { pattern: { type: 'setting', device: 'cablebox', key: 'auto', value: 'off' }, hint: 'Turn off Auto-control on the Cable Box only.' },
      { pattern: { type: 'setting', device: 'tv', key: 'input', value: 'in2', when: (s) => !cbAuto(s) || !s.devices.cablebox.powered }, hint: 'Switch the TV to Input 2, the Game Console.' },
    ],
    [
      { pattern: { type: 'power', device: 'console', on: false }, hint: 'Find the bossy one: turn the Game Console off and see what happens.' },
      { pattern: { type: 'power', device: 'console', on: true }, hint: 'Turn the Game Console back on.' },
      { pattern: { type: 'setting', device: 'cablebox', key: 'auto', value: 'off' }, hint: 'The console only asks politely. The Cable Box is the bossy one: turn off its Auto-control.' },
      { pattern: { type: 'setting', device: 'tv', key: 'input', value: 'in2', when: (s) => !cbAuto(s) }, hint: 'Switch the TV to Input 2, the Game Console.' },
    ],
  ],

  harmful: [
    {
      pattern: { type: 'setting', device: 'tv', key: 'auto', value: 'off' },
      effect: (s) => s,
      message: 'The tugging stopped… and so did the Sound Bar. The TV’s Auto-control was running it.',
    },
  ],

  inspect: {
    tv: 'Two purple Auto-control lines pull at the TV: one from the Cable Box, one from the Game Console.',
    cablebox: 'Its Auto-control is on. It grabs the TV whenever anything else wakes up.',
    console: 'Its Auto-control is on too, but it only asks for the TV when it starts.',
    'cablebox-ctl': 'This line tugs hard. It flickers every time the console tries to take over.',
    'console-ctl': 'A polite tug: “Can I have the TV, please?”',
    sb: 'The Sound Bar is in the sound socket and works through the TV’s Auto-control.',
  },

  ask: ASK,
  thanks: 'Puck drop and the TV stays put! You’re on my team any day.',
  tipCard: 'Turn off the troublemaker, not the whole house.',
};

const fixedSetup = (s: RoomState) => {
  s.devices.cablebox.settings.auto = 'on';
  return s;
};

/** Night 3 callback if #12 was "fixed" by turning off the TV's Auto-control. */
export const cb12QuietBar: Fault = {
  id: 'cb12',
  number: 12,
  tier: 2,
  title: 'The Sound Bar Went Quiet',
  caller: 'harmon',
  call: { text: 'Since your visit the TV stays put, but the Sound Bar hasn’t made a peep. Can you take another look?' },

  setup: () => fixedSetup(room({ tvAuto: 'off', soundOut: 'tv', input: 'in2' })),
  rules,
  view,
  goal: (s) => gameOn(s) && barPlays(s),

  gates: f12Switching.gates,

  optimal: [
    { pattern: { type: 'setting', device: 'cablebox', key: 'auto', value: 'off' }, hint: 'First tame the bossy Cable Box: turn off its Auto-control.' },
    { pattern: { type: 'setting', device: 'tv', key: 'auto', value: 'on', when: (s) => !cbAuto(s) }, hint: 'Now turn the TV’s Auto-control back on. The Sound Bar needs it.' },
    { pattern: { type: 'setting', device: 'tv', key: 'soundOut', value: 'bar' }, hint: 'Set the TV’s Sound Output to Sound Bar.' },
  ],

  inspect: {
    tv: 'Auto-control is off on the TV, so the Sound Bar can’t hear it.',
    cablebox: 'Its Auto-control is still on. It’s the one that was tugging the TV.',
    console: 'Auto-control on, as usual.',
    sb: 'The Sound Bar is plugged into the sound socket, but nothing comes down the line.',
  },

  ask: ASK,
  thanks: 'Game on AND the Sound Bar rumbles. That’s a hat trick.',
  tipCard: 'Turn off the troublemaker, not the whole house.',
};
