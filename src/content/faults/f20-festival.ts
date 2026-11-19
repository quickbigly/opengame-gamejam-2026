// Fault #20, the finale: "The Festival Screen Looks Blurry" — see docs/fault-library.md.

import type { Fault, RoomState } from '../../engine/types';
import { allOn, dev, sock, spec } from '../helpers';

/** What the Festival Player agreed on with the Splitter when it last started. */
type Got = 'low' | 'bigOnly' | 'both';
const sp = (s: RoomState) => s.devices.splitter.settings;
const got = (s: RoomState) => s.devices.player.settings.got as Got;
const forced = (s: RoomState) => s.devices.player.settings.quality === 'max';
const setRight = (s: RoomState) => sp(s).match === 'screen1' && sp(s).shrink === 'on';
const appliedRight = (s: RoomState) => sp(s).appliedMatch === 'screen1' && sp(s).appliedShrink === 'on';
const chain = (s: RoomState) => allOn(s, 'player', 'splitter');

export const f20Festival: Fault = {
  id: 'f20',
  number: 20,
  tier: 4,
  title: 'The Festival Screen Looks Blurry',
  caller: 'mayor',
  call: { text: 'The town hall’s big new TV looks blurry for the festival broadcast! The old projector’s hooked up too.' },

  setup: () => ({
    devices: {
      bigtv: dev({ id: 'bigtv', name: 'Big Screen (Screen 1)', kind: 'tv', x: 300, y: 30, w: 400, h: 200, sockets: [sock('in', 'Input', 'bottom')] }),
      projector: dev({ id: 'projector', name: 'Old Projector (Screen 2)', kind: 'other', x: 730, y: 430, w: 240, h: 60, sockets: [sock('in', 'In', 'left')] }),
      splitter: dev({
        id: 'splitter', name: 'Splitter', kind: 'box', x: 380, y: 430, w: 240, h: 60,
        sockets: [sock('in', 'In', 'left'), sock('s1', 'Screen 1', 'top'), sock('s2', 'Screen 2', 'right')],
        // applied*: what it was set to when it last started. Changes need a restart.
        settings: { match: 'oldest', shrink: 'off', appliedMatch: 'oldest', appliedShrink: 'off' },
        settingSpecs: {
          match: spec('Match', [['oldest', 'Oldest Screen'], ['screen1', 'Screen 1']]),
          shrink: spec('Shrink for Screen 2', [['off', 'Off'], ['on', 'On']]),
        },
      }),
      player: dev({
        id: 'player', name: 'Festival Player', kind: 'box', x: 40, y: 430, w: 210, h: 60,
        sockets: [sock('out', 'Picture Out', 'right')],
        settings: { got: 'low', quality: 'auto' },
        settingSpecs: { quality: spec('Quality', [['auto', 'Auto'], ['max', 'Max (force it)']]) },
      }),
    },
    cables: {
      pin: { id: 'pin', kind: 'standard', a: { device: 'player', socket: 'out' }, b: { device: 'splitter', socket: 'in' } },
      s1: { id: 's1', kind: 'standard', a: { device: 'splitter', socket: 's1' }, b: { device: 'bigtv', socket: 'in' } },
      s2: { id: 's2', kind: 'standard', a: { device: 'splitter', socket: 's2' }, b: { device: 'projector', socket: 'in' } },
    },
    installedParts: [],
    flags: {},
  }),

  rules: (_before, a, s) => {
    const split = sp(s);
    if (a.type === 'power' && a.device === 'splitter' && a.on) {
      split.appliedMatch = split.match;
      split.appliedShrink = split.shrink;
    }
    // The player asks the splitter what the screens can show only when it starts up.
    if (a.type === 'power' && a.device === 'player' && a.on) {
      s.devices.player.settings.got = !s.devices.splitter.powered || split.appliedMatch !== 'screen1' ? 'low' : split.appliedShrink === 'on' ? 'both' : 'bigOnly';
    }
    return s;
  },

  gates: [{ device: 'splitter', key: 'shrink', option: 'on', requires: (s) => sp(s).match === 'screen1' }],

  goal: (s) => got(s) === 'both' && !forced(s) && allOn(s, 'player', 'splitter', 'bigtv', 'projector'),

  view: (s) => {
    const live = chain(s);
    const g = got(s);
    const bigSharp = live && (g !== 'low' || forced(s));
    const projOk = live && !forced(s) && g !== 'bigOnly';
    return {
      lines: {
        pin: { signal: 'picture', state: live ? (bigSharp ? 'ok' : 'weak') : 'idle' },
        s1: { signal: 'picture', state: !live ? 'idle' : bigSharp ? 'ok' : 'weak' },
        s2: { signal: 'picture', state: !live ? 'idle' : projOk ? 'ok' : 'failed' },
      },
      status: {
        bigtv: !s.devices.bigtv.powered
          ? { text: 'Off', tone: 'neutral' }
          : !live
            ? { text: 'No Signal', tone: 'bad' }
            : bigSharp
              ? { text: projOk ? 'Crystal clear! 🎄' : 'Sharp (but listen to the crowd…)', tone: projOk ? 'good' : 'neutral' }
              : { text: 'Blurry: matched to the old projector', tone: 'bad' },
        projector: !s.devices.projector.powered
          ? { text: 'Off', tone: 'neutral' }
          : !live
            ? { text: 'No picture', tone: 'neutral' }
            : projOk
              ? { text: 'Showing the festival', tone: 'good' }
              : { text: 'Black. The crowd groans.', tone: 'bad' },
        splitter: !s.devices.splitter.powered
          ? { text: 'Off', tone: 'neutral' }
          : {
              text: `Match: ${sp(s).appliedMatch === 'screen1' ? 'Screen 1' : 'Oldest Screen'}${sp(s).appliedShrink === 'on' ? ' · Shrink' : ''}${setRight(s) && !appliedRight(s) ? ' (restart to apply)' : ''}`,
              tone: appliedRight(s) ? 'good' : 'neutral',
            },
        player: !s.devices.player.powered
          ? { text: 'Off', tone: 'neutral' }
          : { text: forced(s) ? 'Quality: forced to Max' : g === 'low' ? 'Sending: old-projector quality' : 'Sending: full quality', tone: g === 'both' && !forced(s) ? 'good' : 'neutral' },
      },
    };
  },

  optimal: [
    { pattern: { type: 'setting', device: 'splitter', key: 'match', value: 'screen1' }, hint: 'The Splitter matches the oldest screen. Set it to Match: Screen 1, the big one.' },
    { pattern: { type: 'setting', device: 'splitter', key: 'shrink', value: 'on' }, hint: 'Turn on “Shrink for Screen 2” so the old projector still gets a picture it can show.' },
    { pattern: { type: 'power', device: 'splitter', on: false, when: setRight }, hint: 'Restart the Splitter so the new settings take: turn it off…' },
    { pattern: { type: 'power', device: 'splitter', on: true, when: setRight }, hint: '…and back on.' },
    { pattern: { type: 'power', device: 'player', on: false, when: setRight }, hint: 'Now restart the Festival Player so it asks the Splitter again: turn it off…' },
    { pattern: { type: 'power', device: 'player', on: true, when: (s) => s.devices.splitter.powered && appliedRight(s) }, hint: '…and back on.' },
  ],

  harmful: [
    {
      pattern: { type: 'setting', device: 'player', key: 'quality', value: 'max' },
      effect: (s) => s,
      message: 'The big screen sharpens… and the old projector goes black. The crowd groans.',
    },
  ],

  inspect: {
    splitter: 'Its setting says “Match: Oldest Screen.” It makes both screens use the old projector’s lower quality.',
    player: 'It asks the Splitter what the screens can show, but only when it starts up.',
    projector: 'An old projector for the overflow crowd in the hallway. It can’t show anything fancy.',
    s1: 'The Big Screen could show much more than it’s getting.',
  },

  ask: [
    { id: 'when', question: 'When does the broadcast start?', answer: 'Eleven-thirty sharp! The whole town will be here. No pressure. Well. Some pressure.' },
    { id: 'projector', question: 'Do we need the old projector?', answer: 'Absolutely. Half the town watches from the hallway. Nobody gets left out at the festival.' },
  ],

  thanks: 'Look at that picture! Pinecrest Hollow, we are LIVE!',
  tipCard: 'A splitter can only please both screens if you tell it which one leads.',
};
