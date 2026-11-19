// Shared builders for fault content. Keeps fault files short and consistently worded.

import { otherEnd } from '../engine/room';
import type { Device, DeviceId, RoomState, SettingSpec, Side, Socket } from '../engine/types';

export function sock(id: string, label: string, side: Side, badges?: string[]): Socket {
  return { id, label, side, badges };
}

export function dev(
  d: Pick<Device, 'id' | 'name' | 'kind' | 'x' | 'y' | 'w' | 'h' | 'sockets'> & Partial<Device>,
): Device {
  return { powered: true, settings: {}, settingSpecs: {}, ...d };
}

export function spec(label: string, options: [value: string, label: string][]): SettingSpec {
  return { label, options: options.map(([value, l]) => ({ value, label: l })) };
}

/** A button in a settings menu (e.g. "Hold for 30 seconds"). It snaps back after every press; rules react to the action. */
export function button(label: string, presses: [value: string, label: string][]): SettingSpec {
  return { ...spec(label, [['rest', '—'], ...presses]), momentary: true };
}

/** Standard TV inputs along the bottom edge. Pass the socket ids that have the sound (speaker) badge. */
export function tvInputs(count: number, soundSockets: string[] = []): Socket[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `in${i + 1}`;
    return sock(id, `Input ${i + 1}`, 'bottom', soundSockets.includes(id) ? ['sound'] : undefined);
  });
}

export function inputSpec(count: number): SettingSpec {
  return spec('Input', Array.from({ length: count }, (_, i) => [`in${i + 1}`, `Input ${i + 1}`]));
}

/** The device feeding the TV's currently selected input, if any. */
export function inputSource(s: RoomState, tv: DeviceId = 'tv'): DeviceId | null {
  const input = s.devices[tv]?.settings.input;
  return input ? (otherEnd(s, { device: tv, socket: input })?.device ?? null) : null;
}

/** Which device is plugged into a socket, by friendly name, or "Empty". */
export function pluggedName(s: RoomState, device: DeviceId, socket: string): string {
  const o = otherEnd(s, { device, socket });
  return o ? s.devices[o.device].name : 'Empty';
}

export function allOn(s: RoomState, ...ids: DeviceId[]): boolean {
  return ids.every((id) => s.devices[id]?.powered);
}
