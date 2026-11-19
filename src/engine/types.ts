// Core data model for the Hookup View puzzles. See docs/design.md §6 and §11.

export type SignalKind = 'picture' | 'sound' | 'internet' | 'control';
export type LineState = 'ok' | 'weak' | 'unstable' | 'failed' | 'hum';

export type DeviceId = string;
export type SocketId = string;

export interface Socket {
  id: SocketId;
  label: string;
  /** Friendly badges shown to the player, e.g. 'sound' (speaker icon) or 'handshake'. */
  badges?: string[];
}

export interface Device {
  id: DeviceId;
  name: string; // friendly name, e.g. "Sound Bar"
  powered: boolean;
  sockets: Socket[];
  settings: Record<string, string>;
}

export interface Cable {
  id: string;
  kind: 'standard' | 'fast' | 'coax' | 'speaker' | 'power';
  from: { device: DeviceId; socket: SocketId };
  to: { device: DeviceId; socket: SocketId } | null; // null = unplugged end
}

export interface RoomState {
  devices: Record<DeviceId, Device>;
  cables: Record<string, Cable>;
  installedParts: string[];
  flags: Record<string, boolean>;
  minutesSpent: number;
}

export type Action =
  | { type: 'inspect'; target: string }
  | { type: 'moveCable'; cable: string; to: { device: DeviceId; socket: SocketId } | null }
  | { type: 'power'; device: DeviceId; on: boolean }
  | { type: 'setting'; device: DeviceId; key: string; value: string }
  | { type: 'installPart'; part: string }
  | { type: 'wait'; minutes: number }
  | { type: 'ask'; topic: string };

export type ActionClass = 'optimal' | 'wasted' | 'harmful';
