// Fault #10 "Laptop Won't Show Up on the TV" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, spec, tvInputs } from '../helpers';

const screen = (s: RoomState) => s.devices.laptop.settings.screen;
const tvShowsLaptop = (s: RoomState) => allOn(s, 'tv', 'laptop') && inputSource(s) === 'laptop' && screen(s) !== 'only';

export const f10Laptop: Fault = {
  id: 'f10',
  number: 10,
  tier: 2,
  title: "Laptop Won't Show Up on the TV",
  caller: 'june',
  call: { text: 'I want to show my holiday photos on the TV, but my laptop won’t show up!' },

  setup: () => ({
    devices: {
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 360, y: 50, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in2' },
        settingSpecs: { input: inputSpec(2) },
      }),
      cablebox: dev({ id: 'cablebox', name: 'Cable Box', kind: 'box', x: 130, y: 410, w: 180, h: 64, sockets: [sock('out', 'Picture Out', 'top')] }),
      laptop: dev({
        id: 'laptop', name: 'Laptop', kind: 'laptop', x: 640, y: 400, w: 220, h: 72,
        sockets: [sock('hdmi', 'Picture Out', 'top')],
        settings: { screen: 'only', sound: 'laptop' },
        settingSpecs: {
          screen: spec('Screen', [['only', 'This Screen Only'], ['both', 'Show on Both'], ['second', 'TV Only']]),
          sound: spec('Sound', [['laptop', 'Laptop Speakers'], ['tv', 'TV']]),
        },
      }),
    },
    cables: {
      c1: { id: 'c1', kind: 'standard', a: { device: 'cablebox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
      lap: { id: 'lap', kind: 'standard', a: { device: 'laptop', socket: 'hdmi' }, b: { device: 'tv', socket: 'in2' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (_b, a, s) => {
    // Pulling the picture back to the laptop also pulls the sound back.
    if (a.type === 'setting' && a.device === 'laptop' && a.key === 'screen' && a.value === 'only') s.devices.laptop.settings.sound = 'laptop';
    return s;
  },

  gates: [{ device: 'laptop', key: 'sound', option: 'tv', requires: tvShowsLaptop }],

  goal: (s) => tvShowsLaptop(s) && screen(s) === 'both' && s.devices.laptop.settings.sound === 'tv',

  view: (s) => {
    const sound = s.devices.laptop.settings.sound === 'tv';
    return {
      lines: {
        c1: { signal: 'picture', state: s.devices.cablebox.powered ? 'ok' : 'idle' },
        lap: { signal: 'picture', state: !s.devices.laptop.powered || screen(s) === 'only' ? 'idle' : 'ok' },
      },
      status: {
        tv: !s.devices.tv.powered
          ? { text: 'Off', tone: 'neutral' }
          : inputSource(s) === 'cablebox'
            ? { text: 'Cable TV', tone: 'neutral' }
            : tvShowsLaptop(s)
              ? { text: sound ? 'Holiday photos! 🎄 ♪' : 'Holiday photos! (silent)', tone: sound ? 'good' : 'bad' }
              : { text: 'No Signal', tone: 'bad' },
        laptop: !s.devices.laptop.powered
          ? { text: 'Off', tone: 'neutral' }
          : screen(s) === 'second'
            ? { text: 'Its own screen went dark!', tone: 'bad' }
            : { text: screen(s) === 'both' ? 'Sharing its screen' : 'Showing photos to itself', tone: screen(s) === 'both' ? 'good' : 'neutral' },
        cablebox: { text: 'Sending a picture', tone: 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'laptop', key: 'screen', value: 'both' }, hint: 'Open the Laptop and set Screen to Show on Both.' },
    { pattern: { type: 'setting', device: 'laptop', key: 'sound', value: 'tv' }, hint: 'Now set the Laptop’s Sound to TV.' },
  ],

  inspect: {
    laptop: 'Its Screen setting says This Screen Only. It isn’t sending anything down the cable.',
    lap: 'The cable is plugged in at both ends, but the line is dark.',
    tv: 'The TV is listening to Input 2, where the laptop is. Nothing is coming in.',
  },

  ask: [
    { id: 'photos', question: 'Which photos are we showing?', answer: 'All of them! Well. The best 400.' },
    { id: 'see', question: 'Do you need to see the laptop too?', answer: 'Oh yes, I click through them myself. I’m very particular about the order.' },
  ],

  thanks: 'There’s Cousin Pat at the lake! And there’s the lake! Sit, sit, this will only take an hour.',
  tipCard: 'Laptops have to be told to share their screen.',
};
