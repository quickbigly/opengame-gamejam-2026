import { BASE_PAY, cleanMult, isClean, onTimeBonus, streakBonus, type JobResult } from '../engine/scoring';
import type { Fault } from '../engine/types';
import { NEIGHBORS } from '../content/neighbors';
import type { ScheduledJob } from '../content/slice';
import { clock, stars } from './format';
import { Snowfall } from './Snowfall';

export interface JobOutcome {
  fault: Fault;
  result: JobResult;
  pay: number;
  finishedAt: number;
  minutes: number;
  par: number;
  newTip: boolean;
}

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="title-screen">
      <Snowfall />
      <div className="title-card">
        <h1>Snowbound Signal</h1>
        <p>The town is snowed in. The festival is tomorrow. You're the only one who can fix the TVs.</p>
        <button type="button" onClick={onStart} autoFocus>
          New Game
        </button>
        <p className="small muted">Preview build · two house calls</p>
      </div>
    </main>
  );
}

export function CallScreen({ sj, now, onGo }: { sj: ScheduledJob; now: number; onGo: () => void }) {
  const n = NEIGHBORS[sj.fault.caller];
  return (
    <main className="title-screen">
      <Snowfall count={70} />
      <div className="call-card">
        <div className="call-pin" />
        <div className="call-head">
          <span className="portrait lg" style={{ background: n.color }}>
            {n.name[0]}
          </span>
          <div>
            <div className="call-name">{n.name}</div>
            <div className="muted small">{n.address}</div>
            <div className="stars" title={`Difficulty: tier ${sj.fault.tier}`}>
              {stars(sj.fault.tier)}
            </div>
          </div>
        </div>
        <p className="quote big">“{sj.fault.call.text}”</p>
        <dl className="call-facts">
          <dt>Now</dt>
          <dd>{clock(now)}</dd>
          <dt>Fix it by</dt>
          <dd>{clock(sj.deadline)}</dd>
          <dt>Base pay</dt>
          <dd>🪙 {BASE_PAY[sj.fault.tier]}</dd>
          <dt>Drive</dt>
          <dd>{sj.travel} min</dd>
        </dl>
        <button type="button" className="btn primary" onClick={onGo} autoFocus>
          🚐 Drive over
        </button>
      </div>
    </main>
  );
}

export function ResultScreen({ o, coins, last, onNext }: { o: JobOutcome; coins: number; last: boolean; onNext: () => void }) {
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
        <h2>{clean ? 'Clean fix! ✨' : 'Fixed!'}</h2>
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
            {last ? 'End of the night →' : 'Next call →'}
          </button>
        </div>
      </div>
    </main>
  );
}

export function EndScreen({ outcomes, coins, onAgain }: { outcomes: JobOutcome[]; coins: number; onAgain: () => void }) {
  const cleanCount = outcomes.filter((o) => isClean(o.result)).length;
  return (
    <main className="title-screen">
      <Snowfall />
      <div className="result-card">
        <h2>That's the preview!</h2>
        <p>
          {outcomes.length} jobs, {cleanCount} clean, 🪙 <strong>{coins}</strong> in tips.
        </p>
        <p className="muted">Coming next: the town map, the van, the snowplow, and three full nights before the festival.</p>
        <button type="button" className="btn primary" onClick={onAgain} autoFocus>
          Play again
        </button>
      </div>
    </main>
  );
}
