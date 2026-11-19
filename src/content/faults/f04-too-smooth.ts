// Fault #4 "Movies Look Weird and Too Smooth" — see docs/fault-library.md.

import type { Fault } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

export const f04TooSmooth: Fault = {
  id: 'f04',
  number: 4,
  tier: 1,
  title: 'Movies Look Weird and Too Smooth',
  caller: 'patterson',
  call: { text: 'Our new TV makes movies look like a cheap home video. Hubby hates it.' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 50, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in1', mode: 'vivid', smooth: 'on' },
        settingSpecs: {
          input: inputSpec(2),
          mode: spec('Picture Mode', [['vivid', 'Vivid'], ['standard', 'Standard'], ['movie', 'Movie'], ['game', 'Game']]),
          smooth: spec('Super Smooth', [['on', 'On'], ['off', 'Off']]),
        },
      }),
      player: dev({
        id: 'player', name: 'Movie Player', kind: 'box', x: 640, y: 410, w: 180, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'player', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
    },
    installedParts: [],
    flags: {},
  }),

  // Every Picture Mode preset turns Super Smooth back on.
  rules: (before, a, s) => {
    if (a.type === 'setting' && a.device === 'tv' && a.key === 'mode' && before.devices.tv.settings.mode !== a.value) {
      s.devices.tv.settings.smooth = 'on';
    }
    return s;
  },

  goal: (s) =>
    allOn(s, 'tv', 'player') && inputSource(s) === 'player' && s.devices.tv.settings.mode === 'movie' && s.devices.tv.settings.smooth === 'off',

  view: (s) => {
    const { mode, smooth } = s.devices.tv.settings;
    const playing = allOn(s, 'tv', 'player') && inputSource(s) === 'player';
    return {
      lines: { c1: { signal: 'picture', state: s.devices.player.powered ? 'ok' : 'idle' } },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : !playing
            ? { text: 'No Signal', tone: 'bad' }
            : smooth === 'on'
              ? { text: 'Movie looks like home video', tone: 'bad' }
              : mode === 'movie'
                ? { text: 'Looks like the cinema!', tone: 'good' }
                : { text: 'Better… but the colors glare', tone: 'bad' },
        player: s.devices.player.powered ? { text: 'Playing a movie', tone: 'good' } : { text: 'Off', tone: 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'tv', key: 'mode', value: 'movie' }, hint: 'Set the TV’s Picture Mode to Movie first. That resets the small settings.' },
    {
      pattern: { type: 'setting', device: 'tv', key: 'smooth', value: 'off', when: (s) => s.devices.tv.settings.mode === 'movie' },
      hint: 'Now turn Super Smooth off.',
    },
  ],

  inspect: {
    tv: 'Super Smooth is on. Each Picture Mode is a preset that comes with its own Super Smooth setting.',
    player: 'A movie player. It’s fine.',
    c1: 'A picture cable. It looks fine.',
  },

  ask: [
    { id: 'hubby', question: 'What does your husband say?', answer: '“It looks like a soap opera, Marjorie.” Every. Single. Night.' },
    { id: 'tried', question: 'Have you tried anything?', answer: 'I switched that Super Smooth thing off once, then picked a nicer mode, and it came right back!' },
  ],

  thanks: 'Oh, that’s the movie I remember. Harold! Come look! …He says it’s acceptable. High praise.',
  tipCard: 'Change the big setting first, then the small ones.',
};
