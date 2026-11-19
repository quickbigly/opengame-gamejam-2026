import { BASE_PAY, cleanMult, isClean, onTimeBonus, streakBonus } from '../engine/scoring';
import type { ParResult } from '../engine/solver';
import type { Call } from '../engine/night';
import { UPGRADES, nightEnd, type UpgradeId } from '../engine/upgrades';
import { NEIGHBORS } from '../content/neighbors';
import { FAULTS_BY_ID } from '../content/faults';
import { NIGHTS } from '../content/nights';
import { TOWN } from '../content/town';
import {
  FESTIVAL_BONUS, callText, canBuy, isLastNight, runScore, summarize, totalStars, type JobOutcome, type RunState,
} from '../game/run';
import { clock, stars } from './format';
import { Snowfall } from './Snowfall';

const callerOf = (c: Call) => NEIGHBORS[FAULTS_BY_ID[c.fault].caller];

export function TitleScreen({
  saved,
  best,
  onNew,
  onContinue,
}: {
  saved: RunState | null;
  best: number | null;
  onNew: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="title-screen">
      <Snowfall />
      <div className="title-card">
        <h1>Snowbound Signal</h1>
        <p>The town is snowed in. The festival is in three nights. You're the only one who can fix the TVs.</p>
        {saved && (
          <button type="button" onClick={onContinue} autoFocus>
            Continue · Night {saved.night.number}
          </button>
        )}
        <button type="button" onClick={onNew} autoFocus={!saved}>
          New Game
        </button>
        {best !== null && <p className="small muted">Personal best: 🪙 {best}</p>}
      </div>
    </main>
  );
}

const NIGHT_INTRO: Record<number, string> = {
  1: 'The first big snow of the year. The phone’s been ringing since supper.',
  2: 'It snowed all day. The plows are out, and so is everyone’s internet.',
  3: 'A real blizzard, and the festival broadcast is tonight. The Mayor called first.',
};

export function DispatchScreen({ run, onNext }: { run: RunState; onNext: () => void }) {
  const known = run.night.calls.filter((c) => c.calledAt <= run.clock);
  const later = run.night.calls.length - known.length;
  return (
    <main className="board-screen">
      <Snowfall count={50} />
      <div className="board">
        <header className="board-head">
          <h2>
            Night {run.night.number} of {NIGHTS.length} · Dispatch Board
          </h2>
          <p className="muted">
            6:00 PM. {NIGHT_INTRO[run.night.number] ?? ''} {later > 0 && `More calls will come in tonight.`}
          </p>
        </header>
        <div className="board-cards">
          {known.map((c, i) => {
            const fault = FAULTS_BY_ID[c.fault];
            const n = callerOf(c);
            return (
              <article
                key={c.id}
                className={`call-card mini ${c.finale ? 'finale' : ''} ${c.callbackOf ? 'callback' : ''}`}
                style={{ transform: `rotate(${(i % 3) - 1}deg)` }}
              >
                <div className="call-pin" />
                {c.finale && <div className="call-ribbon">🎄 The festival</div>}
                {c.callbackOf && <div className="call-ribbon">📞 Callback</div>}
                <div className="call-head">
                  <span className="portrait" style={{ background: n.color }}>
                    {n.name[0]}
                  </span>
                  <div>
                    <div className="call-name">{n.name}</div>
                    <div className="muted small">{TOWN.places[c.place].name}</div>
                  </div>
                </div>
                <p className="quote">“{callText(c)}”</p>
                <div className="call-meta small">
                  <span className="stars" title={`Difficulty: tier ${fault.tier}`}>
                    {stars(fault.tier)}
                  </span>
                  <span>{c.callbackOf ? 'On the house' : `🪙 ${BASE_PAY[fault.tier]}`}</span>
                  <span>due {clock(c.deadline)}</span>
                </div>
              </article>
            );
          })}
        </div>
        <div className="row spread">
          <span className="muted">🪙 {run.coins} in the till</span>
          <button type="button" className="btn primary" onClick={onNext} autoFocus>
            Head out →
          </button>
        </div>
      </div>
    </main>
  );
}

export function ResultScreen({ o, call, coins, onNext }: { o: JobOutcome; call: Call; coins: number; onNext: () => void }) {
  const r = o.result;
  const n = NEIGHBORS[o.fault.caller];
  const clean = isClean(r);
  const rows: [string, string, string][] = [
    ['Base pay', `🪙 ${BASE_PAY[r.tier]}`, `Tier ${r.tier}`],
    [
      'Clean fix',
      `× ${cleanMult(r).toFixed(2)}`,
      clean
        ? 'No wasted moves'
        : `${r.wastedActions} not needed, ${r.harmfulActions} made it worse${r.usedHint ? ', called a friend' : ''}`,
    ],
    ['On time', `× ${(1 + onTimeBonus(r)).toFixed(2)}`, r.minutesEarly > 0 ? `${r.minutesEarly} min early` : r.minutesEarly === 0 ? 'Just in time' : `${-r.minutesEarly} min late`],
    ['Streak', `× ${(1 + streakBonus(r.streak)).toFixed(2)}`, `${r.streak} clean in a row before this`],
    ['Bonus fix', `+ ${r.bonusFix}`, r.bonusFix ? (o.fault.bonus?.message ?? '') : '—'],
  ];
  return (
    <main className="title-screen">
      <Snowfall count={60} />
      <div className="result-card">
        <div className="muted small">
          {n.name} · finished {clock(o.finishedAt)}
        </div>
        <h2>{call.finale ? (o.finishedAt <= 360 ? 'The festival is ON! 🎄' : 'Fixed… after midnight') : clean ? 'Clean fix! ✨' : 'Fixed!'}</h2>
        {o.free ? (
          <p>
            A callback is on the house: you fix your own leftovers for free. {clean ? 'It still counts toward your clean streak.' : ''}
          </p>
        ) : (
          <table className="payout">
            <tbody>
              {rows.map(([k, v, why]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td className="num">{v}</td>
                  <td className="muted small">{why}</td>
                </tr>
              ))}
              <tr className="total">
                <th>Tip</th>
                <td className="num">🪙 {o.pay}</td>
                <td className="muted small">rounded</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="small">
          Time in the house: <strong>{o.minutes} min</strong> · Par: <strong>{o.par} min</strong>
        </p>
        {o.newTip && (
          <div className="tip-card">
            <div className="card-title">📓 New Tip Card</div>
            <p>{o.fault.tipCard}</p>
          </div>
        )}
        <div className="row spread">
          <span>🪙 {coins} total</span>
          <button type="button" className="btn primary" onClick={onNext} autoFocus>
            Back to the map →
          </button>
        </div>
      </div>
    </main>
  );
}

export function NightReport({ run, par, onNext }: { run: RunState; par: ParResult; onNext: () => void }) {
  const sum = summarize(run, par.score);
  const pct = par.score ? Math.round((100 * sum.tips) / par.score) : 0;
  const starText = ['Every call answered', '70% of Par', '95% of Par'];
  const last = isLastNight(run);
  const finale = run.night.calls.find((c) => c.finale);
  const newCallbacks = run.night.calls.filter((c) => run.callbacks.includes(c.id));
  return (
    <main className="title-screen">
      <Snowfall />
      <div className="result-card wide">
        <div className="muted small">
          {run.clock >= nightEnd(run.upgrades) ? clock(nightEnd(run.upgrades)) : clock(run.clock)} · Night {run.night.number} of {NIGHTS.length}
        </div>
        <h2>Night Report</h2>
        <div className="report-stars" aria-label={`${sum.stars.filter(Boolean).length} of 3 stars`}>
          {sum.stars.map((s, i) => (
            <div key={i} className={`report-star ${s ? 'got' : ''}`}>
              <span>{s ? '★' : '☆'}</span>
              <small>{starText[i]}</small>
            </div>
          ))}
        </div>
        <table className="payout">
          <tbody>
            {run.night.calls.map((c) => {
              const o = run.outcomes[c.id];
              const fault = FAULTS_BY_ID[c.fault];
              return (
                <tr key={c.id}>
                  <th>
                    {callerOf(c).name}
                    {c.callbackOf ? ' 📞' : c.finale ? ' 🎄' : ''}
                  </th>
                  <td className="muted small">{fault.title}</td>
                  <td className="num">{o ? (o.free ? 'free' : `🪙 ${o.pay}`) : '—'}</td>
                  <td className="small">{o ? (isClean(o.result) ? 'clean ✨' : 'fixed') : c.calledAt > run.clock ? 'never called' : 'missed'}</td>
                </tr>
              );
            })}
            <tr className="total">
              <th>Tips</th>
              <td />
              <td className="num">🪙 {sum.tips}</td>
              <td className="small">{pct}% of Par</td>
            </tr>
          </tbody>
        </table>
        <p className="small">
          Par (a perfect night): <strong>🪙 {par.score}</strong> · In the till: <strong>🪙 {run.coins}</strong>
        </p>
        {finale && (
          <p className={`small ${run.festival ? 'festival-note' : 'callback-note'}`}>
            {run.festival
              ? `🎄 The festival broadcast went live! Festival bonus: 🪙 ${FESTIVAL_BONUS}.`
              : '🎄 The festival screen wasn’t fixed in time. The town watched it blurry, and cheered anyway.'}
          </p>
        )}
        {!last && newCallbacks.length > 0 && (
          <p className="small callback-note">
            📞 {newCallbacks.map((c) => callerOf(c).name).join(', ')} might call back before the festival.
          </p>
        )}
        <div className="row spread">
          <span className="muted small">Par route: {par.stops.map((s) => callerOf(run.night.calls.find((c) => c.id === s.call)!).name.split(' ').pop()).join(' → ')}</span>
          <button type="button" className="btn primary" onClick={onNext} autoFocus>
            {last ? 'The festival →' : 'To the shop →'}
          </button>
        </div>
      </div>
    </main>
  );
}

export function ShopScreen({ run, onBuy, onNext }: { run: RunState; onBuy: (id: UpgradeId) => void; onNext: () => void }) {
  return (
    <main className="title-screen">
      <Snowfall count={40} />
      <div className="result-card wide">
        <div className="muted small">Between nights · the hardware store stays open late</div>
        <h2>The Shop</h2>
        <p className="small">Parts are always free. Tips buy upgrades that last the whole run.</p>
        <div className="shop-grid">
          {UPGRADES.map((u) => {
            const owned = !!run.upgrades[u.id];
            return (
              <article key={u.id} className={`shop-item ${owned ? 'owned' : ''}`}>
                <div className="shop-icon">{u.icon}</div>
                <div>
                  <div className="call-name">{u.name}</div>
                  <p className="small">{u.blurb}</p>
                </div>
                <button type="button" className="btn primary" disabled={!canBuy(run, u.id)} onClick={() => onBuy(u.id)}>
                  {owned ? 'Owned ✓' : `🪙 ${u.cost}`}
                </button>
              </article>
            );
          })}
        </div>
        <div className="row spread">
          <span>🪙 {run.coins} in the till</span>
          <button type="button" className="btn primary" onClick={onNext} autoFocus>
            Night {run.night.number + 1} →
          </button>
        </div>
      </div>
    </main>
  );
}

const CREDITS = [
  'Made for the OpenGame Game Jam 2026.',
  'Design, code and words: the Snowbound Signal team.',
  'Every fault is based on a real-world problem. No TVs were harmed.',
];

export function EndingScreen({ run, newBest, onAgain }: { run: RunState; newBest: boolean; onAgain: () => void }) {
  const score = runScore(run);
  const fixed = run.nights.reduce((n, r) => n + r.done, 0);
  const calls = run.nights.reduce((n, r) => n + r.total, 0);
  const crowd = Object.keys(NEIGHBORS).filter((id) => id !== 'mayor');
  return (
    <main className="title-screen ending">
      <Snowfall />
      <div className="result-card wide">
        <div className={`festival-screen ${run.festival ? 'live' : 'blurry'}`} aria-hidden="true">
          <span>{run.festival ? '🎄 LIVE · Pinecrest Hollow Winter Festival 🎄' : 'Pinecrest Hollow Winter Festival'}</span>
        </div>
        <div className="crowd" aria-label="The neighbors gather">
          {crowd.map((id) => (
            <span key={id} className="portrait sm" style={{ background: NEIGHBORS[id].color }} title={NEIGHBORS[id].name}>
              {NEIGHBORS[id].name[0]}
            </span>
          ))}
        </div>
        <h2>{run.festival ? 'The festival goes live!' : 'The festival goes on'}</h2>
        <p>
          {run.festival
            ? 'The big screen glows crystal clear, the old projector hums along in the hallway, and the whole town counts down together. Mayor Pell only cries a little.'
            : 'The big screen is a bit blurry, but the cocoa is hot and the whole town is here. Next year, they say, you’ll get it.'}
        </p>
        <table className="payout">
          <tbody>
            {run.nights.map((r) => (
              <tr key={r.number}>
                <th>Night {r.number}</th>
                <td className="small">
                  {r.done}/{r.total} calls
                </td>
                <td className="stars">{r.stars.map((s) => (s ? '★' : '☆')).join('')}</td>
                <td className="num">🪙 {r.tips}</td>
              </tr>
            ))}
            {run.festival && (
              <tr>
                <th>Festival bonus</th>
                <td />
                <td />
                <td className="num">🪙 {FESTIVAL_BONUS}</td>
              </tr>
            )}
            <tr className="total">
              <th>Run score</th>
              <td className="small">
                {fixed}/{calls} fixed
              </td>
              <td className="stars">{totalStars(run)} ★</td>
              <td className="num">🪙 {score}</td>
            </tr>
          </tbody>
        </table>
        {newBest && <p className="festival-note small">A new personal best!</p>}
        <div className="credits small muted">
          {CREDITS.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </div>
        <div className="row spread">
          <span className="muted small">{run.tips.length} Tip Cards collected</span>
          <button type="button" className="btn primary" onClick={onAgain} autoFocus>
            Back to the title
          </button>
        </div>
      </div>
    </main>
  );
}
