import { useRef, useState, type PointerEvent } from 'react';
import type { Cable, Device, Plug, RoomState, RoomView, SignalKind } from '../engine/types';
import { VIEW_H, VIEW_W, cablePath, danglePos, socketPos, type Pt } from './geometry';

export interface Carrying {
  cable: string;
  end: 'a' | 'b';
}

interface Props {
  room: RoomState;
  view: RoomView;
  goalMet: boolean;
  selected: string | null;
  carrying: Carrying | null;
  onSelect: (id: string | null) => void;
  onPick: (c: Carrying) => void;
  onDrop: (to: Plug) => void;
  onCancelCarry: () => void;
  onPower: (device: string) => void;
}

const SIGNAL_GLYPH: Record<SignalKind, string> = { picture: '▣', sound: '♪', internet: '◉', control: '◌' };
const SIGNAL_NAME: Record<SignalKind, string> = { picture: 'Picture', sound: 'Sound', internet: 'Internet', control: 'Remote' };

export function HookupView(p: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const downAt = useRef<Pt | null>(null);

  const toSvg = (e: PointerEvent): Pt => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };

  const plugPos = (plug: Plug) => socketPos(p.room.devices[plug.device], plug.socket);
  const occupied = new Set(
    Object.values(p.room.cables).flatMap((c) => [c.a, c.b].filter(Boolean).map((x) => `${x!.device}.${x!.socket}`)),
  );

  const dropOn = (plug: Plug, e: PointerEvent) => {
    if (!p.carrying) return;
    const origin = p.room.cables[p.carrying.cable][p.carrying.end];
    const moved = downAt.current ? Math.hypot(toSvg(e).x - downAt.current.x, toSvg(e).y - downAt.current.y) > 6 : true;
    downAt.current = null;
    if (origin && origin.device === plug.device && origin.socket === plug.socket) {
      if (moved) p.onCancelCarry(); // dragged back home
      return; // a plain click on the plug: keep carrying until a socket is clicked
    }
    p.onDrop(plug);
  };

  return (
    <svg
      ref={svgRef}
      className={`hookup ${p.carrying ? 'is-carrying' : ''} ${p.goalMet ? 'is-fixed' : ''}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      onPointerMove={(e) => p.carrying && setCursor(toSvg(e))}
      onPointerUp={() => {
        downAt.current = null;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as Element).classList.contains('room-bg')) {
          if (p.carrying) p.onCancelCarry();
          else p.onSelect(null);
        }
      }}
      role="img"
      aria-label="Hookup view: how the devices in this room are connected"
    >
      <RoomBackdrop />

      {Object.values(p.room.devices).map((d) => (
        <DeviceCard
          key={d.id}
          d={d}
          status={p.view.status[d.id]}
          selected={p.selected === d.id}
          onSelect={() => p.onSelect(d.id)}
          onPower={() => p.onPower(d.id)}
        />
      ))}

      {/* Sockets sit under the cables: plugs are grabbed on top, and the carried plug ignores the pointer so free sockets catch the drop. */}
      {Object.values(p.room.devices).flatMap((d) =>
        d.sockets.map((s) => {
          const pos = socketPos(d, s.id);
          const key = `${d.id}.${s.id}`;
          const free = !occupied.has(key);
          const listening = d.settings.input === s.id;
          const top = s.side === 'top';
          const labelX = top ? pos.x + 14 : pos.x;
          const labelY = top ? pos.y - 6 : s.side === 'bottom' ? pos.y - 14 : pos.y + 4;
          return (
            <g key={key} className={`socket ${free ? 'free' : 'used'} ${listening ? 'listening' : ''}`}>
              {listening && <circle className="listen-ring" cx={pos.x} cy={pos.y} r={15} />}
              <circle
                className="socket-hole"
                data-socket={key}
                cx={pos.x}
                cy={pos.y}
                r={9}
                onPointerUp={(e) => dropOn({ device: d.id, socket: s.id }, e)}
              >
                <title>{`${d.name}: ${s.label}${s.badges?.includes('sound') ? ' (sound socket)' : ''}${listening ? ' — the TV is listening here' : ''}`}</title>
              </circle>
              <text className="socket-label" x={labelX} y={labelY} textAnchor={top ? 'start' : 'middle'}>
                {s.badges?.includes('sound') ? '🔊 ' : ''}
                {s.label}
              </text>
              {listening && (
                <text className="listen-label" x={pos.x} y={pos.y + (s.side === 'bottom' ? 30 : -22)} textAnchor="middle">
                  👂 listening
                </text>
              )}
            </g>
          );
        }),
      )}

      {Object.values(p.room.cables).map((c) => (
        <CableLine
          key={c.id}
          c={c}
          room={p.room}
          view={p.view}
          selected={p.selected === c.id}
          carriedEnd={p.carrying?.cable === c.id ? p.carrying.end : null}
          cursor={cursor}
          plugPos={plugPos}
          onSelect={() => p.onSelect(c.id)}
          onPick={(end, e) => {
            downAt.current = toSvg(e);
            setCursor(toSvg(e));
            p.onPick({ cable: c.id, end });
          }}
        />
      ))}

      {p.carrying && cursor && (
        <circle className="plug carried" cx={cursor.x} cy={cursor.y} r={9} pointerEvents="none" />
      )}
    </svg>
  );
}

function DeviceCard({
  d,
  status,
  selected,
  onSelect,
  onPower,
}: {
  d: Device;
  status?: { text: string; tone: string };
  selected: boolean;
  onSelect: () => void;
  onPower: () => void;
}) {
  const isTv = d.kind === 'tv';
  return (
    <g className={`device kind-${d.kind} ${selected ? 'selected' : ''} ${d.powered ? 'on' : 'off'}`}>
      <rect className="device-body" x={d.x} y={d.y} width={d.w} height={d.h} rx={isTv ? 8 : 12} onClick={onSelect}>
        <title>{`${d.name}${status ? ` — ${status.text}` : ''}. Click for details.`}</title>
      </rect>
      {isTv ? (
        <>
          <rect
            className={`tv-screen tone-${status?.tone ?? 'neutral'}`}
            x={d.x + 12}
            y={d.y + 12}
            width={d.w - 24}
            height={d.h - 44}
            rx={4}
            pointerEvents="none"
          />
          <text className="tv-screen-text" x={d.x + d.w / 2} y={d.y + (d.h - 32) / 2 + 12} textAnchor="middle" pointerEvents="none">
            {status?.text}
          </text>
          <text className="device-name" x={d.x + 14} y={d.y + d.h - 12} pointerEvents="none">
            {d.name}
          </text>
        </>
      ) : (
        <>
          <text className="device-name" x={d.x + 14} y={d.y + d.h / 2 - (status ? 4 : -5)} pointerEvents="none">
            {d.name}
          </text>
          {status && (
            <text className={`device-status tone-${status.tone}`} x={d.x + 14} y={d.y + d.h / 2 + 14} pointerEvents="none">
              {status.text}
            </text>
          )}
        </>
      )}
      <g
        className="power-btn"
        onClick={(e) => {
          e.stopPropagation();
          onPower();
        }}
        role="button"
        aria-label={`Turn ${d.name} ${d.powered ? 'off' : 'on'} (1 min)`}
      >
        <circle cx={d.x + d.w - 16} cy={isTv ? d.y + d.h - 16 : d.y + 16} r={10} />
        <text x={d.x + d.w - 16} y={(isTv ? d.y + d.h - 16 : d.y + 16) + 4} textAnchor="middle" pointerEvents="none">
          ⏻
        </text>
        <title>{`Turn ${d.name} ${d.powered ? 'off' : 'on'} (1 min)`}</title>
      </g>
    </g>
  );
}

function CableLine({
  c,
  view,
  selected,
  carriedEnd,
  cursor,
  plugPos,
  onSelect,
  onPick,
}: {
  c: Cable;
  room: RoomState;
  view: RoomView;
  selected: boolean;
  carriedEnd: 'a' | 'b' | null;
  cursor: Pt | null;
  plugPos: (p: Plug) => Pt & { side: 'top' | 'bottom' | 'left' | 'right' };
  onSelect: () => void;
  onPick: (end: 'a' | 'b', e: PointerEvent) => void;
}) {
  const line = view.lines[c.id] ?? { signal: 'picture', state: 'idle' };
  const a = c.a ? plugPos(c.a) : null;
  const b = c.b ? plugPos(c.b) : null;
  if (!a && !b) return null;

  // Resolve each end's drawn position: plugged, carried (follows the cursor), or dangling.
  const endPos = (end: 'a' | 'b'): Pt => {
    if (carriedEnd === end && cursor) return cursor;
    const own = end === 'a' ? a : b;
    if (own) return own;
    return danglePos((end === 'a' ? b : a)!);
  };
  const pa = endPos('a');
  const pb = endPos('b');
  const sa = a && carriedEnd !== 'a' ? a.side : null;
  const sb = b && carriedEnd !== 'b' ? b.side : null;
  const { d, mid } = sa ? cablePath(pa, sa, pb, sb) : cablePath(pb, sb ?? 'top', pa, null);
  const live = !carriedEnd && !!a && !!b;
  const state = live ? line.state : 'idle';

  return (
    <g className={`cable signal-${line.signal} state-${state} ${selected ? 'selected' : ''}`}>
      <path className="cable-hit" d={d} onClick={onSelect}>
        <title>{`${SIGNAL_NAME[line.signal]} line${state === 'failed' ? ' — broken' : state === 'weak' ? ' — weak' : ''}. Click for details.`}</title>
      </path>
      <path className="cable-line" d={d} pointerEvents="none" />
      <g className="cable-mid" transform={`translate(${mid.x},${mid.y})`} pointerEvents="none">
        <circle r={11} />
        <text y={4} textAnchor="middle">
          {state === 'failed' ? '✗' : SIGNAL_GLYPH[line.signal]}
        </text>
      </g>
      {(['a', 'b'] as const).map((end) =>
        carriedEnd === end ? null : (
          <circle
            key={end}
            className={`plug ${(end === 'a' ? a : b) ? 'in' : 'loose'}`}
            cx={endPos(end).x}
            cy={endPos(end).y}
            r={7}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPick(end, e);
            }}
          >
            <title>Grab this cable end to move it (2 min)</title>
          </circle>
        ),
      )}
    </g>
  );
}

function RoomBackdrop() {
  return (
    <g className="room" pointerEvents="none">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3550" />
          <stop offset="1" stopColor="#3a3a52" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(244,184,96,0.35)" />
          <stop offset="1" stopColor="rgba(244,184,96,0)" />
        </radialGradient>
      </defs>
      <rect className="room-bg" x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#wall)" pointerEvents="all" />
      <rect x={0} y={370} width={VIEW_W} height={190} fill="#4a3a36" />
      <rect x={0} y={366} width={VIEW_W} height={6} fill="#5c4842" />
      <ellipse cx={500} cy={505} rx={380} ry={40} fill="#7a4b45" opacity={0.6} />
      {/* Window with snow */}
      <rect x={60} y={60} width={160} height={190} rx={6} fill="#13213b" stroke="#6d5a4a" strokeWidth={8} />
      <line x1={140} y1={60} x2={140} y2={250} stroke="#6d5a4a" strokeWidth={5} />
      <line x1={60} y1={155} x2={220} y2={155} stroke="#6d5a4a" strokeWidth={5} />
      {[
        [82, 90], [120, 130], [170, 100], [200, 180], [96, 200], [150, 220], [186, 140], [108, 170],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill="#eef3fb" opacity={0.85} />
      ))}
      <rect x={56} y={244} width={168} height={14} rx={4} fill="#eef3fb" opacity={0.9} />
      {/* Lamp glow */}
      <circle cx={900} cy={200} r={140} fill="url(#lamp)" />
      <rect x={895} y={210} width={10} height={160} fill="#6d5a4a" />
      <path d="M865,210 L935,210 L915,160 L885,160 Z" fill="#f4b860" opacity={0.9} />
      {/* TV stand */}
      <rect x={330} y={360} width={340} height={20} rx={4} fill="#5c4842" />
    </g>
  );
}
