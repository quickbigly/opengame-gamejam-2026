// Core data model for the Hookup View puzzles. See docs/design.md §6 and §11.

export type SignalKind = 'picture' | 'sound' | 'internet' | 'control';
/** 'idle' = carries nothing right now (drawn gray). */
export type LineState = 'ok' | 'weak' | 'unstable' | 'failed' | 'hum' | 'idle';

export type DeviceId = string;
export type SocketId = string;
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type DeviceKind = 'tv' | 'box' | 'soundbar' | 'console' | 'router' | 'other';

export interface Socket {
  id: SocketId;
  label: string;
  /** Friendly badges shown to the player, e.g. 'sound' (speaker icon) or 'handshake'. */
  badges?: string[];
  side: Side;
}

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingSpec {
  label: string;
  options: SettingOption[];
}

export interface Device {
  id: DeviceId;
  name: string; // friendly name, e.g. "Sound Bar"
  kind: DeviceKind;
  powered: boolean;
  sockets: Socket[];
  settings: Record<string, string>;
  settingSpecs: Record<string, SettingSpec>;
  /** Layout in the Hookup View's 1000×560 diagram space (top-left corner + size). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Plug {
  device: DeviceId;
  socket: SocketId;
}

export interface Cable {
  id: string;
  kind: 'standard' | 'fast' | 'coax' | 'speaker' | 'power';
  /** Either end may be unplugged (null). */
  a: Plug | null;
  b: Plug | null;
}

export interface RoomState {
  devices: Record<DeviceId, Device>;
  cables: Record<string, Cable>;
  installedParts: string[];
  flags: Record<string, boolean>;
}

export type Action =
  | { type: 'inspect'; target: string }
  | { type: 'moveCable'; cable: string; end: 'a' | 'b'; to: Plug | null }
  | { type: 'power'; device: DeviceId; on: boolean }
  | { type: 'setting'; device: DeviceId; key: string; value: string }
  | { type: 'installPart'; part: string }
  | { type: 'wait'; minutes: number }
  | { type: 'ask'; topic: string };

/** 'info' (inspect/ask) costs time but never breaks a clean fix; 'bonus' is the fault's optional extra fix. */
export type ActionClass = 'optimal' | 'wasted' | 'harmful' | 'info' | 'bonus';

/**
 * Matches an action when every listed field deep-equals the action's field,
 * and `when` (evaluated on the room state *before* the action) is true.
 */
export type ActionPattern = Partial<Record<string, unknown>> & {
  type: Action['type'];
  when?: (s: RoomState) => boolean;
};

export interface OptimalStep {
  pattern: ActionPattern;
  /** Shown by "Call a Friend". */
  hint: string;
}

export interface HarmfulRule {
  pattern: ActionPattern;
  /** Applied after the action itself. */
  effect: (s: RoomState) => RoomState;
  message: string;
}

export interface Gate {
  device: DeviceId;
  key: string;
  option: string;
  requires: (s: RoomState) => boolean;
}

export interface LineView {
  signal: SignalKind;
  state: LineState;
}

export interface DeviceStatus {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface RoomView {
  /** Keyed by cable id. Cables not listed are drawn idle. */
  lines: Record<string, LineView>;
  status: Record<DeviceId, DeviceStatus>;
}

export interface AskTopic {
  id: string;
  question: string;
  answer: string;
}

export interface Fault {
  id: string;
  number: number; // index in docs/fault-library.md
  tier: 1 | 2 | 3 | 4;
  title: string;
  caller: string; // neighbor id, see src/content/neighbors.ts
  call: { text: string; voice?: string };
  setup: () => RoomState;
  goal: (s: RoomState) => boolean;
  view: (s: RoomState) => RoomView;
  optimal: OptimalStep[];
  harmful?: HarmfulRule[];
  gates?: Gate[];
  bonus?: { pattern: ActionPattern; reward: number; message: string };
  /** Overrides a setting option's display label (e.g. renamed inputs). */
  optionLabel?: (s: RoomState, device: DeviceId, key: string, value: string) => string | undefined;
  /** Hidden details revealed by inspecting a device or cable (keyed by id). */
  inspect: Record<string, string>;
  ask: AskTopic[];
  /** What the neighbor says when it's fixed. */
  thanks: string;
  tipCard: string;
}
