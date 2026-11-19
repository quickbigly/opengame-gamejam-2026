// Fault #3 "The Edges Are Cut Off" — see docs/fault-library.md.

import type { DeviceStatus, Fault } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const SIZE_STATUS: Record<string, DeviceStatus> = {
  zoom: { text: 'Hockey! (edges cut off)', tone: 'bad' },
  wide: { text: 'Hockey! (stretched wide)', tone: 'bad' },
  fit: { text: 'Hockey! Score and all', tone: 'good' },
};

export const f03PictureSize: Fault = {
  id: 'f03',
  number: 3,
  tier: 1,
  title: 'The Edges Are Cut Off',
  caller: 'harmon',
  call: { text: "I can't see the score in the corner. It's like the picture is too big." },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 50, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in1', size: 'zoom', mode: 'sports' },
        settingSpecs: {
          input: inputSpec(2),
          mode: spec('Picture Mode', [['standard', 'Standard'], ['sports', 'Sports'], ['movie', 'Movie']]),
          size: spec('Picture Size', [['zoom', 'Zoom'], ['wide', 'Wide'], ['fit', 'Fit Screen']]),
        },
      }),
      cablebox: dev({
        id: 'cablebox', name: 'Cable Box', kind: 'box', x: 250, y: 410, w: 180, h: 64,
        sockets: [sock('out', 'Picture Out', 'top')],
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
    },
    installedParts: [],
    flags: {},
  }),

  goal: (s) => allOn(s, 'tv', 'cablebox') && inputSource(s) === 'cablebox' && s.devices.tv.settings.size === 'fit',

  view: (s) => ({
    lines: { c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' } },
    status: {
      tv: !s.devices.tv.powered
        ? { text: 'Off', tone: 'neutral' }
        : inputSource(s) !== 'cablebox' || !s.devices.cablebox.powered
          ? { text: 'No Signal', tone: 'bad' }
          : SIZE_STATUS[s.devices.tv.settings.size],
      cablebox: s.devices.cablebox.powered ? { text: 'Sending a picture', tone: 'good' } : { text: 'Off', tone: 'neutral' },
    },
  }),

  optimal: [{ pattern: { type: 'setting', device: 'tv', key: 'size', value: 'fit' }, hint: 'Open the TV’s settings and set Picture Size to Fit Screen.' }],

  inspect: {
    tv: 'The picture spills past the TV’s edges. Picture Size says Zoom.',
    cablebox: 'It’s sending the whole picture. The problem is on the TV’s end.',
    c1: 'A picture cable. It looks fine.',
  },

  ask: [
    { id: 'game', question: 'What are you watching?', answer: 'The Hollow Hawks! Third period. And I can’t see the score!' },
    { id: 'when', question: 'When did it start?', answer: 'My grandson “fixed the colors” for me yesterday.' },
  ],

  thanks: 'THERE’s the score! We’re up by two! Grab a seat, you’ve earned it.',
  tipCard: 'If the picture is cut off, check Picture Size.',
};
