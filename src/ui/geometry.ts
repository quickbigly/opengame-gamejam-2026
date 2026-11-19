// Layout math for the Hookup View's 1000×560 diagram space.

import type { Device, Side } from '../engine/types';

export const VIEW_W = 1000;
export const VIEW_H = 560;

export interface Pt {
  x: number;
  y: number;
}

export function socketPos(d: Device, socketId: string): Pt & { side: Side } {
  const sock = d.sockets.find((s) => s.id === socketId)!;
  const same = d.sockets.filter((s) => s.side === sock.side);
  const along = (same.indexOf(sock) + 1) / (same.length + 1);
  switch (sock.side) {
    case 'top':
      return { x: d.x + d.w * along, y: d.y, side: 'top' };
    case 'bottom':
      return { x: d.x + d.w * along, y: d.y + d.h, side: 'bottom' };
    case 'left':
      return { x: d.x, y: d.y + d.h * along, side: 'left' };
    case 'right':
      return { x: d.x + d.w, y: d.y + d.h * along, side: 'right' };
  }
}

export function outward(side: Side): Pt {
  return { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[side];
}

/** A cubic curve leaving each socket straight outward, plus its midpoint (for icons and ✗ marks). */
export function cablePath(p: Pt, ps: Side, q: Pt, qs: Side | null): { d: string; mid: Pt } {
  const dist = Math.hypot(q.x - p.x, q.y - p.y);
  const k = Math.max(40, Math.min(150, dist * 0.45));
  const np = outward(ps);
  const nq = qs ? outward(qs) : { x: 0, y: 0 };
  const c1 = { x: p.x + np.x * k, y: p.y + np.y * k };
  const c2 = { x: q.x + nq.x * k, y: q.y + nq.y * k };
  const mid = { x: (p.x + 3 * c1.x + 3 * c2.x + q.x) / 8, y: (p.y + 3 * c1.y + 3 * c2.y + q.y) / 8 };
  return { d: `M${p.x},${p.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${q.x},${q.y}`, mid };
}

/** Where an unplugged end rests: hanging just outside the plugged end. */
export function danglePos(from: Pt & { side: Side }): Pt {
  const n = outward(from.side);
  return { x: from.x + n.x * 60 + 36, y: from.y + n.y * 60 + 24 };
}
