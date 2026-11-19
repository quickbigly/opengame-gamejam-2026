// Fault #6 "Sound Still Comes Out of the TV" — see docs/fault-library.md.

import { linked } from '../../engine/room';
import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const BAR = { device: 'soundbar', socket: 'tv' };
const SOUND_SOCKET = { device: 'tv', socket: 'in3' };

const barInSoundSocket = (s: RoomState) => linked(s, BAR, SOUND_SOCKET);
const autoOn = (s: RoomState) => s.devices.tv.settings.auto === 'on';
const soundToBar = (s: RoomState) =>
  allOn(s, 'tv', 'soundbar') && barInSoundSocket(s) && autoOn(s) && s.devices.tv.settings.soundOut === 'bar';

export const f06SoundSocket: Fault = {
  id: 'f06',
  number: 6,
  tier: 2,
  title: 'Sound Still Comes Out of the TV',
  caller: 'lindqvist',
  call: { text: 'We got a sound bar for Christmas, but the sound still comes from the TV.' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 40, w: 280, h: 170,
        sockets: tvInputs(3, ['in3']),
        settings: { input: 'in1', auto: 'off', soundOut: 'tv' },
        settingSpecs: {
          input: inputSpec(3),
          auto: spec('Auto-control', [['off', 'Off'], ['on', 'On']]),
          soundOut: spec('Sound Output', [['tv', 'TV Speakers'], ['bar', 'Sound Bar']]),
        },
      }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 110, y: 410, w: 180, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
      soundbar: dev({
        id: 'soundbar', name: 'Sound Bar', kind: 'soundbar', x: 560, y: 420, w: 300, h: 48,
        sockets: [sock('tv', 'TV', 'top')],
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      sb: { id: 'sb', kind: 'standard', a: { ...BAR }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  goal: (s) => soundToBar(s) && allOn(s, 'cablebox') && inputSource(s) === 'cablebox',

  view: (s) => {
    const picture = allOn(s, 'cablebox', 'tv') && inputSource(s) === 'cablebox';
    const c = s.cables.sb;
    const barPlugged = !!c.a && !!c.b;
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        sb: { signal: 'sound', state: soundToBar(s) ? 'ok' : barInSoundSocket(s) ? 'weak' : barPlugged ? 'failed' : 'idle' },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : !picture
            ? { text: 'No Signal', tone: 'bad' }
            : soundToBar(s)
              ? { text: 'Picture on, sound to the Sound Bar', tone: 'good' }
              : { text: 'Sound from the TV speakers', tone: 'bad' },
        cablebox: s.devices.cablebox.powered ? { text: 'Sending picture + sound', tone: 'good' } : { text: 'Off', tone: 'neutral' },
        soundbar: !s.devices.soundbar.powered
          ? { text: 'Off', tone: 'neutral' }
          : soundToBar(s) && picture
            ? { text: '♪ Playing', tone: 'good' }
            : { text: 'Silent', tone: 'bad' },
      },
    };
  },

  optimal: [
    {
      pattern: { type: 'moveCable', cable: 'sb', end: 'b', to: { ...SOUND_SOCKET } },
      hint: "Only Input 3 has the speaker icon. Move the Sound Bar's cable from Input 2 to Input 3.",
    },
    {
      pattern: { type: 'setting', device: 'tv', key: 'auto', value: 'on' },
      hint: "Turn on Auto-control in the TV's settings so the TV and Sound Bar can talk.",
    },
    {
      pattern: { type: 'setting', device: 'tv', key: 'soundOut', value: 'bar' },
      hint: "Now set the TV's Sound Output to Sound Bar.",
    },
  ],

  gates: [{ device: 'tv', key: 'soundOut', option: 'bar', requires: (s) => barInSoundSocket(s) && autoOn(s) }],

  inspect: {
    tv: 'Only Input 3 has the little speaker icon. That’s the sound socket: the only one that can send sound back out to a Sound Bar.',
    soundbar: 'It’s on, but it isn’t hearing anything from the TV.',
    cablebox: 'It’s on and sending picture and sound to Input 1.',
    sb: 'The Sound Bar’s cable goes into Input 2, a regular socket. Sound can’t travel back out of it.',
    c1: 'A picture cable from the Cable Box to Input 1. It looks fine.',
  },

  ask: [
    { id: 'who', question: 'Who hooked up the Sound Bar?', answer: 'Me! I just used the first free socket. Was that wrong?' },
    { id: 'remote', question: 'Does the TV remote change the Sound Bar volume?', answer: "No, we've been juggling two remotes. It's a whole thing." },
  ],

  thanks: 'Listen to that! The whole couch is rumbling. Merry Christmas to us!',
  tipCard: 'Sound bars need the socket with the speaker icon.',
};
