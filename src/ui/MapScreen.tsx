import { useMemo, useState } from 'react';
import { bestDeparture, fastestRoute, nextEvent, roadMinutes, snowAt, type Route, type Snow } from '../engine/night';
import { nightEnd } from '../engine/upgrades';
import { FAULTS_BY_ID } from '../content/faults';
import { NEIGHBORS } from '../content/neighbors';
import { TOWN } from '../content/town';
import { callAt, callText, type RunState } from '../game/run';
import { clock } from './format';

const SNOW_LABEL: Record<Snow, string> = { plowed: 'Plowed', snowy: 'Snowy', deep: 'Deep snow', blocked: 'Blocked' };
const WAIT_STEP = 15;

interface Props {
  run: RunState;
  toast: string | null;
  onDrive: (route: Route) => void;
  onWait: (minutes: number) => void;
  onEnter: () => void;
  onEndNight: () => void;
  onNotebook: () => void;
}

export function MapScreen({ run, toast, onDrive, onWait, onEnter, onEndNight, onNotebook }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const events = run.night.snow;
  const up = run.upgrades;
  const end = nightEnd(up);
  const known = run.night.calls.filter((c) => c.calledAt <= run.clock);
  const here = callAt(run, run.location);

  const plan = useMemo(() => {
    if (!selected || selected === run.location) return null;
    const now = fastestRoute(TOWN, events, run.location, selected, run.clock, up);
    const best = bestDeparture(TOWN, events, run.location, selected, run.clock, up);
    return { now, best: best && now && best.route.arrive < now.arrive ? best : null };
  }, [selected, run.location, run.clock, events, up]);

  const highlight = new Set(plan?.now?.roads ?? []);
  const upcoming = events.filter((e) => e.at > run.clock);
  const nextSnow = nextEvent(events, run.clock);

  return (
    <main className="house map-screen">
      <header className="hud">
        <div className="hud-where">
          <span className="portrait sm" style={{ background: '#f4b860' }}>
            🚐
          </span>
          <div>
            <strong>Night {run.night.number}</strong>
            <span className="muted"> · at {TOWN.places[run.location].name}</span>
          </div>
        </div>
        <div className={`hud-clock ${run.clock > end - 60 ? 'late' : ''}`}>
          <span className="clock-face">{clock(run.clock)}</span>
          <span className="small muted">the night ends at {clock(end)}</span>
        </div>
        <div className="hud-coins">🪙 {run.coins}</div>
      </header>

      <section className="stage">
        <svg className="town" viewBox="0 0 1000 600" role="img" aria-label="Town map">
          <rect x={0} y={0} width={1000} height={600} fill="#e9eff8" onClick={() => setSelected(null)} />
          {Object.values(TOWN.roads).map((r) => {
            const a = TOWN.places[r.a];
            const b = TOWN.places[r.b];
            const snow = snowAt(r, events, run.clock);
            const mins = roadMinutes(r, snow, up);
            return (
              <g key={r.id} className={`road snow-${snow} ${highlight.has(r.id) ? 'on-route' : ''}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="road-base" />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="road-top" />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" className="road-label">
                  {snow === 'blocked' ? '✗' : `${mins}m`}
                </text>
                <title>{`${r.name}: ${SNOW_LABEL[snow]}${snow === 'blocked' ? '' : `, ${mins} min`}`}</title>
              </g>
            );
          })}
          {Object.values(TOWN.places).map((p) => {
            const call = known.find((c) => c.place === p.id);
            const done = call && run.outcomes[call.id];
            const started = call && run.jobs[call.id] && !done;
            const late = call && !done && run.clock > call.deadline;
            return (
              <g
                key={p.id}
                className={`place kind-${p.kind} ${selected === p.id ? 'selected' : ''} ${call ? 'has-call' : ''}`}
                transform={`translate(${p.x},${p.y})`}
                onClick={() => setSelected(p.id)}
              >
                {p.kind === 'house' ? (
                  <path className="house-shape" d="M-16,6 L-16,-8 L0,-20 L16,-8 L16,6 Z" />
                ) : (
                  <rect className="house-shape" x={-22} y={-18} width={44} height={30} rx={4} />
                )}
                <rect className={`window ${done ? 'warm' : ''}`} x={-5} y={-6} width={10} height={9} />
                <text className="place-name" y={26} textAnchor="middle">
                  {p.kind === 'house' && p.neighbor ? NEIGHBORS[p.neighbor].name : p.name}
                </text>
                {call && (
                  <g className={`pin ${done ? 'done' : late ? 'late' : started ? 'started' : ''}`} transform="translate(14,-30)">
                    <circle r={13} />
                    <text y={5} textAnchor="middle">
                      {done ? '✓' : '!'}
                    </text>
                  </g>
                )}
                <title>{p.name}</title>
              </g>
            );
          })}
          {(() => {
            const p = TOWN.places[run.location];
            return (
              <text className="van-marker" x={p.x - 30} y={p.y - 22} pointerEvents="none">
                🚐
              </text>
            );
          })()}
        </svg>
        {toast && <div className="toast">{toast}</div>}
      </section>

      <aside className="side">
        {selected && selected !== run.location ? (
          <PlaceCard run={run} place={selected} plan={plan} end={end} onDrive={onDrive} onClose={() => setSelected(null)} />
        ) : here ? (
          <div className="card carry">
            <div className="card-title">You're here</div>
            <p>{NEIGHBORS[FAULTS_BY_ID[here.fault].caller].name} is waiting.</p>
            <button type="button" className="btn primary" onClick={onEnter}>
              Go inside →
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="card-title">Where to?</div>
            <p className="muted small">Click a house with a pin. Snow makes roads slower; plows make them faster.</p>
          </div>
        )}

        <div className="card">
          <div className="card-title">Calls tonight</div>
          <ul className="call-list">
            {known.map((c) => {
              const f = FAULTS_BY_ID[c.fault];
              const o = run.outcomes[c.id];
              const late = !o && run.clock > c.deadline;
              return (
                <li key={c.id}>
                  <button type="button" className={`call-row ${selected === c.place ? 'sel' : ''}`} onClick={() => setSelected(c.place)}>
                    <span className="portrait sm" style={{ background: NEIGHBORS[f.caller].color }}>
                      {NEIGHBORS[f.caller].name[0]}
                    </span>
                    <span>
                      <span className="call-row-name">
                        {NEIGHBORS[f.caller].name}
                        {c.callbackOf ? ' 📞' : c.finale ? ' 🎄' : ''}
                      </span>
                      <span className="muted small">{f.title}</span>
                    </span>
                    <span className={`small ${o ? 'tone-good' : late ? 'tone-bad' : ''}`}>
                      {o ? (o.free ? '✓ free' : `✓ 🪙${o.pay}`) : run.jobs[c.id] ? 'started' : late ? 'late' : `by ${clock(c.deadline)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {known.length < run.night.calls.length && <p className="muted small">More calls may come in.</p>}
        </div>

        <div className="card">
          <div className="card-title">Snowplow & weather</div>
          {upcoming.length === 0 ? (
            <p className="muted small">Nothing more scheduled tonight.</p>
          ) : (
            <ul className="snow-list small">
              {upcoming.map((e) => (
                <li key={e.at}>
                  <strong>{clock(e.at)}</strong> {e.kind === 'plow' ? '🚜' : '🌨'} {e.label}
                </li>
              ))}
            </ul>
          )}
        </div>

      </aside>

      <footer className="toolbar">
        <button type="button" className="btn" onClick={() => onWait(WAIT_STEP)}>
          ⏳ Wait {WAIT_STEP} min <kbd>Space</kbd>
        </button>
        {nextSnow && (
          <button type="button" className="btn" onClick={() => onWait(nextSnow.at - run.clock)}>
            ⏳ Wait until {clock(nextSnow.at)}
          </button>
        )}
        <button type="button" className="btn" onClick={onNotebook}>
          📓 Notebook <kbd>Tab</kbd>
        </button>
        <span className="spacer" />
        <button type="button" className="btn" onClick={onEndNight}>
          🌙 Call it a night
        </button>
      </footer>
    </main>
  );
}

function PlaceCard({
  run,
  place,
  plan,
  end,
  onDrive,
  onClose,
}: {
  run: RunState;
  place: string;
  end: number;
  plan: { now: Route | null; best: { depart: number; route: Route } | null } | null;
  onDrive: (r: Route) => void;
  onClose: () => void;
}) {
  const p = TOWN.places[place];
  const call = run.night.calls.find((c) => c.place === place && c.calledAt <= run.clock && !run.outcomes[c.id]) ??
    run.night.calls.find((c) => c.place === place && c.calledAt <= run.clock);
  const fault = call && FAULTS_BY_ID[call.fault];
  const done = call && run.outcomes[call.id];
  const now = plan?.now;
  const tooLate = !now || now.arrive >= end;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{p.name}</div>
        <button type="button" className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {fault && call ? (
        <>
          <p>
            <strong>{NEIGHBORS[fault.caller].name}</strong>
          </p>
          <p className="quote small">“{callText(call)}”</p>
          <p className="small">
            {done ? `Fixed ✓ (${done.free ? 'free' : `🪙 ${done.pay}`})` : `${call.callbackOf ? 'Callback, on the house. ' : ''}Fix by ${clock(call.deadline)}`}
          </p>
        </>
      ) : (
        <p className="muted small">{p.kind === 'shop' ? 'Your workshop.' : p.kind === 'hall' ? 'Where the festival will be broadcast.' : 'No call from here tonight.'}</p>
      )}
      {now ? (
        <>
          <p className="small">
            Drive now: <strong>{now.minutes} min</strong>, arrive {clock(now.arrive)}
            <br />
            <span className="muted">via {[...new Set(now.roads.map((r) => TOWN.roads[r].name))].join(', ')}</span>
          </p>
          <button type="button" className="btn primary" disabled={tooLate} onClick={() => onDrive(now)}>
            🚐 {tooLate ? `Can’t make it before ${clock(end)}` : `Drive (${now.minutes} min)`}
          </button>
          {plan?.best && (
            <button type="button" className="btn ghost" onClick={() => onDrive(plan.best!.route)}>
              Wait for the plow: leave {clock(plan.best.depart)}, arrive {clock(plan.best.route.arrive)}
            </button>
          )}
        </>
      ) : (
        <p className="tone-bad small">No way through the snow right now.</p>
      )}
    </div>
  );
}
