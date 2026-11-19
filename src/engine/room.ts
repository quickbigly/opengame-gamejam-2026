// Pure room-state rules: action costs, legality, gated menus and state transitions.

import type { Action, ActionPattern, Fault, Plug, RoomState, SettingOption } from './types';

export const ACTION_COST: Record<Action['type'], number> = {
  inspect: 1,
  moveCable: 2,
  power: 1,
  setting: 1,
  installPart: 3,
  wait: 0, // uses the action's own minutes
  ask: 2,
};

export function actionCost(a: Action): number {
  return a.type === 'wait' ? a.minutes : ACTION_COST[a.type];
}

export function samePlug(p: Plug | null, q: Plug | null): boolean {
  return !!p && !!q && p.device === q.device && p.socket === q.socket;
}

/** The cable plugged into a socket, if any. */
export function cableAt(s: RoomState, plug: Plug): string | undefined {
  return Object.values(s.cables).find((c) => samePlug(c.a, plug) || samePlug(c.b, plug))?.id;
}

/** The plug at the other end of whatever cable is in `plug`, if both ends are plugged in. */
export function otherEnd(s: RoomState, plug: Plug): Plug | null {
  for (const c of Object.values(s.cables)) {
    if (samePlug(c.a, plug)) return c.b;
    if (samePlug(c.b, plug)) return c.a;
  }
  return null;
}

/** True when some cable connects the two plugs. */
export function linked(s: RoomState, p: Plug, q: Plug): boolean {
  return samePlug(otherEnd(s, p), q);
}

/** Menu options currently visible, after gates are applied. */
export function visibleOptions(fault: Fault, s: RoomState, device: string, key: string): SettingOption[] {
  const spec = s.devices[device]?.settingSpecs[key];
  if (!spec) return [];
  return spec.options
    .filter((o) => {
      const gate = fault.gates?.find((g) => g.device === device && g.key === key && g.option === o.value);
      return !gate || gate.requires(s);
    })
    .map((o) => ({ value: o.value, label: fault.optionLabel?.(s, device, key, o.value) ?? o.label }));
}

/** Returns a reason the action can't be taken, or null if it's legal. */
export function illegalReason(fault: Fault, s: RoomState, a: Action): string | null {
  switch (a.type) {
    case 'moveCable': {
      const c = s.cables[a.cable];
      if (!c) return 'No such cable.';
      if (a.to) {
        if (!s.devices[a.to.device]?.sockets.some((k) => k.id === a.to!.socket)) return 'No such socket.';
        const other = a.end === 'a' ? c.b : c.a;
        if (other?.device === a.to.device) return "A cable can't loop back into the same device.";
        if (cableAt(s, a.to)) return 'That socket is already in use.';
      }
      if (samePlug(c[a.end], a.to)) return 'The cable is already there.';
      return null;
    }
    case 'power':
      if (!s.devices[a.device]) return 'No such device.';
      return s.devices[a.device].powered === a.on ? `It's already ${a.on ? 'on' : 'off'}.` : null;
    case 'setting': {
      const d = s.devices[a.device];
      if (!d?.settingSpecs[a.key]) return 'No such setting.';
      if (!d.powered) return 'Turn it on first.';
      if (!visibleOptions(fault, s, a.device, a.key).some((o) => o.value === a.value)) return 'That option isn’t available.';
      return null;
    }
    case 'wait':
      return a.minutes > 0 ? null : 'Wait for how long?';
    case 'ask':
      return fault.ask.some((t) => t.id === a.topic) ? null : 'No such question.';
    default:
      return null;
  }
}

/** Applies an action's direct effect. Never mutates its input. */
export function applyAction(s: RoomState, a: Action): RoomState {
  const next = structuredClone(s);
  switch (a.type) {
    case 'moveCable':
      next.cables[a.cable][a.end] = a.to ? { ...a.to } : null;
      break;
    case 'power':
      next.devices[a.device].powered = a.on;
      break;
    case 'setting':
      next.devices[a.device].settings[a.key] = a.value;
      break;
    case 'installPart':
      next.installedParts.push(a.part);
      break;
    case 'inspect':
      next.flags[`inspected:${a.target}`] = true;
      break;
    case 'ask':
      next.flags[`asked:${a.topic}`] = true;
      break;
    case 'wait':
      break;
  }
  return next;
}

function deepEqual(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (typeof x !== 'object' || typeof y !== 'object' || !x || !y) return false;
  const kx = Object.keys(x);
  const ky = Object.keys(y);
  return kx.length === ky.length && kx.every((k) => deepEqual((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]));
}

export function matches(p: ActionPattern, a: Action, before: RoomState): boolean {
  for (const [k, v] of Object.entries(p)) {
    if (k === 'when') continue;
    if (!deepEqual((a as Record<string, unknown>)[k], v)) return false;
  }
  return !p.when || p.when(before);
}
