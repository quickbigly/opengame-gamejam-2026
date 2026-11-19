import { useCallback, useEffect, useMemo, useState } from 'react';
import { act, takeHint, undo, type JobState } from '../engine/job';
import { actionCost, otherEnd, visibleOptions } from '../engine/room';
import type { Action, ActionClass, Plug, RoomState } from '../engine/types';
import type { Call } from '../engine/night';
import type { Upgrades } from '../engine/upgrades';
import { callText } from '../game/run';
import { ITEMS, type Item } from '../content/items';
import { NEIGHBORS } from '../content/neighbors';
import { clock } from './format';
import { HookupView, type Carrying } from './HookupView';

const HINT_AFTER_MS = 2 * 60 * 1000;
const WAIT_MINUTES = 5;

const CLASS_BADGE: Record<ActionClass, { icon: string; label: string }> = {
  optimal: { icon: '✓', label: 'Good move' },
  wasted: { icon: '·', label: 'Not needed' },
  harmful: { icon: '⚠', label: 'Made it worse' },
  info: { icon: '?', label: 'Learned something' },
  bonus: { icon: '★', label: 'Bonus' },
};

export interface ToolboxEntry {
  item: Item;
  source: 'kit' | 'house';
}

interface Props {
  call: Call;
  placeName: string;
  /** Night clock = startClock + job.minutes. */
  startClock: number;
  coins: number;
  upgrades: Upgrades;
  job: JobState;
  setJob: (j: JobState) => void;
  toolbox: ToolboxEntry[];
  onWrapUp: () => void;
  onLeave: () => void;
  onNotebook: () => void;
}

export function HouseScreen({ call, placeName, startClock, coins, upgrades, job, setJob, toolbox, onWrapUp, onLeave, onNotebook }: Props) {
  const fault = job.fault;
  const neighbor = NEIGHBORS[fault.caller];
  const [selected, setSelected] = useState<string | null>(null);
  const [carrying, setCarrying] = useState<Carrying | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [lastProgress, setLastProgress] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  const view = useMemo(() => fault.view(job.room), [fault, job.room]);
  const time = startClock + job.minutes;
  const late = time > call.deadline;
  const available = useMemo(() => toolbox.map((t) => t.item.id), [toolbox]);

  const doAction = useCallback(
    (a: Action) => {
      const r = act(job, a, { available, freeAsk: !!upgrades.friendlyFace });
      if (!r.ok) {
        if (r.reason !== 'already-known') setToast(r.reason);
        return;
      }
      setJob(r.job);
      if (r.entry.cls === 'optimal' || r.entry.cls === 'bonus') setLastProgress(Date.now());
      if (r.entry.message) setToast(r.entry.message);
    },
    [job, setJob, available, upgrades.friendlyFace],
  );

  const doUndo = useCallback(() => {
    const j = undo(job);
    if (j) setJob(j);
  }, [job, setJob]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        doAction({ type: 'wait', minutes: WAIT_MINUTES });
      } else if (e.key === 'z' || e.key === 'Z') {
        doUndo();
      } else if (e.key === 'Escape') {
        if (carrying) setCarrying(null);
        else setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doAction, doUndo, carrying]);

  const showHintButton = !job.goalMet && (job.usedHint || now - lastProgress >= HINT_AFTER_MS);

  const drop = (to: Plug | null) => {
    if (!carrying) return;
    doAction({ type: 'moveCable', cable: carrying.cable, end: carrying.end, to });
    setCarrying(null);
  };

  return (
    <main className="house">
      <header className="hud">
        <div className="hud-where">
          <span className="portrait sm" style={{ background: neighbor.color }}>
            {neighbor.name[0]}
          </span>
          <div>
            <strong>{neighbor.name}</strong>
            <span className="muted"> · {placeName}</span>
            <div className="muted small">“{fault.title}”</div>
          </div>
        </div>
        <div className={`hud-clock ${late ? 'late' : ''}`} title="The clock only moves when you act">
          <span className="clock-face">{clock(time)}</span>
          <span className="small muted">
            {call.callbackOf ? 'callback · on the house · ' : ''}due {clock(call.deadline)}
            {late ? ' · late' : ''}
          </span>
        </div>
        <div className="hud-coins" title="Coins">
          🪙 {coins}
        </div>
      </header>

      <section className="stage">
        <HookupView
          room={job.room}
          view={view}
          goalMet={job.goalMet}
          selected={selected}
          carrying={carrying}
          onSelect={(id) => setSelected(id)}
          onPick={(c) => {
            setCarrying(c);
            setSelected(c.cable);
          }}
          onDrop={drop}
          onCancelCarry={() => setCarrying(null)}
          onPower={(d) => doAction({ type: 'power', device: d, on: !job.room.devices[d].powered })}
        />
        {toast && <div className="toast">{toast}</div>}
        {job.goalMet && (
          <div className="fixed-banner">
            <div className="fixed-quote">
              <span className="portrait" style={{ background: neighbor.color }}>
                {neighbor.name[0]}
              </span>
              <p>“{fault.thanks}”</p>
            </div>
            <div className="fixed-actions">
              <span className="muted small">Anything else before you go?</span>
              <button type="button" className="btn primary" onClick={onWrapUp}>
                Wrap up job →
              </button>
            </div>
          </div>
        )}
      </section>

      <aside className="side">
        {carrying ? (
          <CarryPanel
            room={job.room}
            carrying={carrying}
            onUnplug={() => drop(null)}
            onCancel={() => setCarrying(null)}
          />
        ) : selected ? (
          <DetailPanel
            id={selected}
            job={job}
            lens={!!upgrades.signalLens}
            onAct={doAction}
            onPick={(c) => setCarrying(c)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <NeighborPanel job={job} text={callText(call)} freeAsk={!!upgrades.friendlyFace} onAct={doAction} />
        )}

        {hint && (
          <div className="card hint-card">
            <div className="card-title">📞 Your friend says</div>
            <p>{hint}</p>
          </div>
        )}

        <Toolbox entries={toolbox} onUse={(id) => doAction({ type: 'installPart', part: id })} />

        <ActionLog job={job} />
      </aside>

      <footer className="toolbar">
        <button type="button" className="btn" onClick={() => doAction({ type: 'wait', minutes: WAIT_MINUTES })}>
          ⏳ Wait {WAIT_MINUTES} min <kbd>Space</kbd>
        </button>
        <button type="button" className="btn" onClick={doUndo} disabled={!job.history.some((e) => !e.undone)}>
          ↶ Undo <kbd>Z</kbd>
        </button>
        <button type="button" className="btn" onClick={onNotebook}>
          📓 Notebook <kbd>Tab</kbd>
        </button>
        <button type="button" className="btn" onClick={onLeave} title="Your progress here is kept. Come back later.">
          🚐 Leave for now
        </button>
        <span className="spacer" />
        {showHintButton && (
          <button
            type="button"
            className="btn warn"
            onClick={() => {
              const r = takeHint(job);
              setJob(r.job);
              setHint(r.hint);
            }}
            title="Costs half of this job's tip"
          >
            📞 Call a Friend <span className="small">(−50% tip)</span>
          </button>
        )}
        <span className="muted small">Hover for free. Clicking things costs game minutes.</span>
      </footer>
    </main>
  );
}

function NeighborPanel({ job, text, freeAsk, onAct }: { job: JobState; text: string; freeAsk: boolean; onAct: (a: Action) => void }) {
  const fault = job.fault;
  const n = NEIGHBORS[fault.caller];
  return (
    <div className="card">
      <div className="card-title">The call</div>
      <p className="quote">“{text}”</p>
      <p className="muted small">Click a device or a line to look closer. Grab a cable's end to move it.</p>
      <div className="card-title">Ask {n.name}</div>
      <ul className="ask-list">
        {fault.ask.map((t) => {
          const asked = job.room.flags[`asked:${t.id}`];
          return (
            <li key={t.id}>
              {asked ? (
                <>
                  <div className="muted small">You: {t.question}</div>
                  <div className="answer">“{t.answer}”</div>
                </>
              ) : (
                <button type="button" className="btn ghost" onClick={() => onAct({ type: 'ask', topic: t.id })}>
                  {t.question} <span className="cost">{freeAsk ? 'free' : '2 min'}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailPanel({
  id,
  job,
  lens,
  onAct,
  onPick,
  onClose,
}: {
  id: string;
  job: JobState;
  /** Signal Lens: line details show without looking closer. */
  lens: boolean;
  onAct: (a: Action) => void;
  onPick: (c: Carrying) => void;
  onClose: () => void;
}) {
  const { room, fault } = job;
  const device = room.devices[id];
  const cable = room.cables[id];
  const link = fault.view(room).links?.find((l) => l.id === id);
  const inspected = room.flags[`inspected:${id}`];
  const hidden = fault.inspect[id];
  const status = device ? fault.view(room).status[id] : undefined;

  const isLine = !!cable || (!!link && !device);
  const inspectBlock = hidden ? (
    inspected || (lens && isLine) ? (
      <p className="revealed">🔍 {hidden}</p>
    ) : (
      <button type="button" className="btn ghost" onClick={() => onAct({ type: 'inspect', target: id })}>
        🔍 Look closer <span className="cost">1 min</span>
      </button>
    )
  ) : null;

  const plugName = (p: Plug | null) => {
    if (!p) return 'unplugged';
    const d = room.devices[p.device];
    return `${d.name} · ${d.sockets.find((s) => s.id === p.socket)?.label}`;
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{device ? device.name : link ? 'Wireless line' : 'Cable'}</div>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {device && (
        <>
          {status && <p className={`status tone-${status.tone}`}>{status.text}</p>}
          {!device.noPower && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => onAct({ type: 'power', device: id, on: !device.powered })}
            >
              ⏻ Turn {device.powered ? 'off' : 'on'} <span className="cost">1 min</span>
            </button>
          )}
          {inspectBlock}
          {Object.entries(device.settingSpecs).length > 0 && <div className="card-title">Settings</div>}
          {!device.powered && Object.keys(device.settingSpecs).length > 0 && (
            <p className="muted small">Turn it on to change settings.</p>
          )}
          {Object.entries(device.settingSpecs).map(([key, spec]) => (
            <div key={key} className="setting">
              <div className="setting-label">{spec.label}</div>
              <div className="setting-options">
                {visibleOptions(fault, room, id, key).map((o) => (
                  <button
                    type="button"
                    key={o.value}
                    className={`opt ${device.settings[key] === o.value ? 'current' : ''}`}
                    disabled={!device.powered || device.settings[key] === o.value}
                    onClick={() => onAct({ type: 'setting', device: id, key, value: o.value })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(device.settingSpecs).length > 0 && device.powered && (
            <p className="muted small">Each change costs {actionCost({ type: 'setting', device: id, key: '', value: '' })} min.</p>
          )}
        </>
      )}

      {link && !cable && !device && (
        <>
          <p className="small">
            <span className="muted">From</span> {room.devices[link.from].name} <span className="muted">to</span> {room.devices[link.to].name}
          </p>
          {inspectBlock}
        </>
      )}

      {cable && (
        <>
          <p className="small">
            <span className="muted">From</span> {plugName(cable.a)}
            <br />
            <span className="muted">To</span> {plugName(cable.b)}
          </p>
          {inspectBlock}
          <div className="row">
            {(['a', 'b'] as const).map((end) => (
              <button type="button" key={end} className="btn ghost" onClick={() => onPick({ cable: id, end })}>
                ✋ Move the {cable[end] ? room.devices[cable[end]!.device].name : 'loose'} end
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarryPanel({
  room,
  carrying,
  onUnplug,
  onCancel,
}: {
  room: RoomState;
  carrying: Carrying;
  onUnplug: () => void;
  onCancel: () => void;
}) {
  const c = room.cables[carrying.cable];
  const from = c[carrying.end];
  const far = otherEnd(room, from ?? { device: '', socket: '' });
  return (
    <div className="card carry">
      <div className="card-title">✋ Holding a cable end</div>
      <p>
        Click a free socket to plug it in <span className="cost">2 min</span>
      </p>
      {far && <p className="muted small">The other end stays in {room.devices[far.device].name}.</p>}
      <div className="row">
        {from && (
          <button type="button" className="btn ghost" onClick={onUnplug}>
            Leave it unplugged <span className="cost">2 min</span>
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onCancel}>
          Put it back <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}

function ActionLog({ job }: { job: JobState }) {
  if (job.history.length === 0) return null;
  return (
    <div className="card log">
      <div className="card-title">What you did</div>
      <ol>
        {[...job.history].reverse().map((e, i) => (
          <li key={job.history.length - i} className={`cls-${e.cls} ${e.undone ? 'undone' : ''}`}>
            <span className="badge" title={CLASS_BADGE[e.cls].label}>
              {CLASS_BADGE[e.cls].icon}
            </span>
            <span className="what">{describe(job.room, e.action)}</span>
            <span className="cost">{e.minutes}m</span>
          </li>
        ))}
      </ol>
      <div className="small muted">
        {job.wasted + job.harmful === 0 ? 'Clean so far ✨' : `${job.wasted} not needed · ${job.harmful} made it worse`}
      </div>
    </div>
  );
}

function describe(room: RoomState, a: Action): string {
  const name = (id: string) => room.devices[id]?.name ?? 'cable';
  switch (a.type) {
    case 'inspect':
      return `Looked at ${room.devices[a.target] ? name(a.target) : 'a cable'}`;
    case 'ask':
      return 'Asked a question';
    case 'moveCable':
      return a.to ? `Moved a cable to ${name(a.to.device)} · ${room.devices[a.to.device].sockets.find((s) => s.id === a.to!.socket)?.label}` : 'Unplugged a cable';
    case 'power':
      return `Turned ${name(a.device)} ${a.on ? 'on' : 'off'}`;
    case 'setting': {
      const spec = room.devices[a.device]?.settingSpecs[a.key];
      return `${name(a.device)}: ${spec?.label} → ${spec?.options.find((o) => o.value === a.value)?.label}`;
    }
    case 'installPart':
      return `Used ${ITEMS[a.part]?.name ?? a.part}`;
    case 'wait':
      return `Waited ${a.minutes} min`;
  }
}

function Toolbox({ entries, onUse }: { entries: ToolboxEntry[]; onUse: (id: string) => void }) {
  if (entries.length === 0) return null;
  return (
    <div className="card">
      <div className="card-title">Toolbox</div>
      <div className="toolbox">
        {entries.map(({ item, source }) => (
          <button
            type="button"
            key={item.id}
            className="tool"
            onClick={() => onUse(item.id)}
            title={`${item.blurb} Use it here: 3 min.`}
          >
            <span className="tool-icon">{item.icon}</span>
            <span className="tool-name">{item.name}</span>
            {source === 'house' && <span className="tool-count muted small">borrowed</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
