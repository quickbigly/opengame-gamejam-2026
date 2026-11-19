// Fault #5 "Satellite Says Searching..." — see docs/fault-library.md.

import type { Fault, LineState, RoomState } from '../../engine/types';
import { allOn, dev, inputSource, inputSpec, sock, tvInputs } from '../helpers';

type Snow = 'cap' | 'patchy' | 'ice' | 'clear';
const snow = (s: RoomState) => s.devices.dish.settings.snow as Snow;

const SNOW_LINE: Record<Snow, LineState> = { clear: 'ok', patchy: 'weak', cap: 'unstable', ice: 'failed' };
const SNOW_TEXT: Record<Snow, string> = { cap: 'Big snow cap', patchy: 'Patchy snow', ice: 'Frozen solid!', clear: 'Clear' };

export const f05Satellite: Fault = {
  id: 'f05',
  number: 5,
  tier: 1,
  title: 'Satellite Says Searching...',
  caller: 'ingrid',
  call: { text: "The satellite's been 'searching for signal' since lunch." },
  houseItems: ['kettle', 'kitchenBroom'],

  setup: () => ({
    devices: {
      dish: dev({
        id: 'dish', name: 'Dish (outside)', kind: 'outdoor', x: 70, y: 84, w: 150, h: 64, noPower: true,
        sockets: [sock('out', 'Cable', 'bottom')],
        settings: { snow: 'cap' },
      }),
      satbox: dev({
        id: 'satbox', name: 'Satellite Box', kind: 'box', x: 160, y: 410, w: 190, h: 64,
        sockets: [sock('dish', 'Dish', 'left'), sock('out', 'Picture Out', 'top')],
      }),
      tv: dev({
        id: 'tv', name: 'TV', kind: 'tv', x: 400, y: 50, w: 280, h: 170,
        sockets: tvInputs(2),
        settings: { input: 'in1' },
        settingSpecs: { input: inputSpec(2) },
      }),
    },
    cables: {
      coax: { id: 'coax', kind: 'coax', a: { device: 'dish', socket: 'out' }, b: { device: 'satbox', socket: 'dish' } },
      c1: { id: 'c1', kind: 'standard', a: { device: 'satbox', socket: 'out' }, b: { device: 'tv', socket: 'in1' } },
    },
    installedParts: [],
    flags: {},
  }),

  legal: (s, a) => (a.type === 'installPart' && a.part === 'dishCover' && snow(s) !== 'clear' ? 'Clear the dish before fitting a cover.' : null),

  rules: (before, a, s) => {
    if (a.type !== 'installPart') return s;
    const was = snow(before);
    const set = (v: Snow) => (s.devices.dish.settings.snow = v);
    if (a.part === 'softBroom') set(was === 'ice' ? 'patchy' : 'clear');
    if (a.part === 'kitchenBroom' && was !== 'ice') set(was === 'cap' ? 'patchy' : 'clear');
    if (a.part === 'kettle') set('ice');
    return s;
  },

  goal: (s) => snow(s) === 'clear' && allOn(s, 'satbox', 'tv') && inputSource(s) === 'satbox',

  view: (s) => {
    const sig = SNOW_LINE[snow(s)];
    const picture = sig === 'ok' && allOn(s, 'satbox', 'tv') && inputSource(s) === 'satbox';
    const covered = s.installedParts.includes('dishCover');
    return {
      lines: {
        coax: { signal: 'picture', state: sig },
        c1: { signal: 'picture', state: !s.devices.satbox.powered ? 'idle' : sig === 'ok' ? 'ok' : sig === 'failed' ? 'failed' : 'weak' },
      },
      status: {
        dish: { text: SNOW_TEXT[snow(s)] + (covered ? ' · ☂️ covered' : ''), tone: snow(s) === 'clear' ? 'good' : 'bad' },
        satbox: !s.devices.satbox.powered ? { text: 'Off', tone: 'neutral' } : sig === 'ok' ? { text: 'Signal locked', tone: 'good' } : { text: 'Searching…', tone: 'bad' },
        tv: !s.devices.tv.powered ? { text: 'Off', tone: 'neutral' } : picture ? { text: 'Farm report is on!', tone: 'good' } : { text: 'Searching for signal…', tone: 'bad' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'installPart', part: 'softBroom', when: (s) => snow(s) === 'cap' }, hint: 'Brush the snow off the dish with your Soft Broom.' },
  ],
  alternatives: [
    [
      { pattern: { type: 'installPart', part: 'kitchenBroom', when: (s) => snow(s) === 'cap' }, hint: 'Borrow Ingrid’s kitchen broom and sweep the dish.' },
      { pattern: { type: 'installPart', part: 'kitchenBroom', when: (s) => snow(s) === 'patchy' }, hint: 'Sweep the rest of the snow off.' },
    ],
  ],

  harmful: [
    {
      pattern: { type: 'installPart', part: 'kettle' },
      effect: (s) => s,
      message: 'It melted… for a minute. Then it froze solid on the dish!',
    },
  ],

  bonus: {
    pattern: { type: 'installPart', part: 'dishCover', when: (s) => snow(s) === 'clear' },
    reward: 20,
    message: 'With a Dish Cover, Ingrid won’t lose the signal next storm.',
    preventsCallback: true,
  },

  inspect: {
    dish: 'A big cap of snow sits in the dish’s bowl. The signal from space can’t get through.',
    satbox: 'It’s on and searching. The cable from the dish is crackly.',
    coax: 'The line from the dish. It flickers with every gust of snow.',
    tv: 'The TV is fine. It just shows what the Satellite Box sends.',
  },

  ask: [
    { id: 'tools', question: 'Got anything I could clear the dish with?', answer: 'There’s a kettle on the stove, and the old kitchen broom by the door. Help yourself!' },
    { id: 'when', question: 'When did it stop?', answer: 'Right after lunch, when the big flakes started. The goats noticed first.' },
  ],

  thanks: 'There’s the farm report! The goats thank you. I thank you more.',
  tipCard: 'Brush, don’t melt.',
};
