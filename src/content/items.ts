// Parts and tools you always carry (design §9), plus things neighbors lend you.

export interface Item {
  id: string;
  name: string;
  icon: string;
  kind: 'part' | 'tool' | 'house';
  blurb: string;
}

export const ITEMS: Record<string, Item> = {
  remoteBooster: { id: 'remoteBooster', name: 'Remote Booster', icon: '📡', kind: 'part', blurb: 'Repeats the remote’s signal around obstacles.' },
  dishCover: { id: 'dishCover', name: 'Dish Cover', icon: '☂️', kind: 'part', blurb: 'Keeps snow off a satellite dish for good.' },
  humStopper: { id: 'humStopper', name: 'Hum Stopper', icon: '🔇', kind: 'part', blurb: 'Clips onto a wall cable to block hum.' },
  setupMic: { id: 'setupMic', name: 'Setup Mic', icon: '🎙️', kind: 'part', blurb: 'Lets a Speaker Hub tune itself to the room.' },
  extensionCable: { id: 'extensionCable', name: 'Extension Cable', icon: '➰', kind: 'part', blurb: 'Lets a plug-in gadget sit out in the open, away from the TV.' },
  surgeProtector: { id: 'surgeProtector', name: 'Surge Protector', icon: '⚡', kind: 'part', blurb: 'Shields gadgets from storm power spikes.' },
  fastCable: { id: 'fastCable', name: 'Fast Cable', icon: '🥇', kind: 'part', blurb: 'Gold label. Carries the fastest pictures.' },
  softBroom: { id: 'softBroom', name: 'Soft Broom', icon: '🧹', kind: 'tool', blurb: 'Brushes snow off gently. Yours to keep.' },
  kettle: { id: 'kettle', name: 'Hot Water', icon: '🫖', kind: 'house', blurb: 'From the neighbor’s stove.' },
  kitchenBroom: { id: 'kitchenBroom', name: 'Kitchen Broom', icon: '🪣', kind: 'house', blurb: 'Stiff and slow, but it works.' },
};

/** Everything in your kit. You always have all of it, so there's nothing to prepare. */
export const KIT = [...['softBroom'], ...['remoteBooster', 'dishCover', 'humStopper', 'setupMic', 'extensionCable', 'surgeProtector', 'fastCable']];
