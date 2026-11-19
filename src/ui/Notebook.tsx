import { BASE_PAY } from '../engine/scoring';
import { UPGRADES, type Upgrades } from '../engine/upgrades';
import { FESTIVAL_BONUS } from '../game/run';

export function Notebook({ tips, upgrades, onClose }: { tips: string[]; upgrades: Upgrades; onClose: () => void }) {
  const owned = UPGRADES.filter((u) => upgrades[u.id]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Notebook" onClick={onClose}>
      <div className="notebook" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <h2>📓 Notebook</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <section>
          <h3>Tip Cards</h3>
          {tips.length === 0 ? (
            <p className="muted">Fix something to earn your first Tip Card.</p>
          ) : (
            <ul className="tips">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>How tips are paid</h3>
          <pre className="formula">Tip = Base × Clean × (1 + OnTime) × (1 + Streak) + Bonus</pre>
          <ul className="small">
            <li>
              <strong>Base:</strong> {Object.entries(BASE_PAY).map(([t, v]) => `★${t} ${v}`).join(' · ')}
            </li>
            <li>
              <strong>Clean:</strong> ×1.5 with no wasted moves · ×1.0 for 1–2 · ×0.8 otherwise · then ×0.5 if you called a friend
            </li>
            <li>
              <strong>OnTime:</strong> up to +0.5, scaled by how early you finish
            </li>
            <li>
              <strong>Streak:</strong> +0.1 per clean fix in a row, up to +0.5
            </li>
            <li>
              <strong>Bonus:</strong> a flat tip for the extra “do the right thing” fix
            </li>
          </ul>
          <p className="small muted">Looking closer and asking questions cost time, but never spoil a clean fix. Undo costs the time again.</p>
          <p className="small muted">
            Callbacks are free: if you skip a fix that prevents trouble, that neighbor calls back on Night 3 and you fix it for nothing.
            Fix the festival screen before midnight on Night 3 for a 🪙 {FESTIVAL_BONUS} festival bonus.
          </p>
        </section>
        {owned.length > 0 && (
          <section>
            <h3>Your upgrades</h3>
            <ul className="small">
              {owned.map((u) => (
                <li key={u.id}>
                  {u.icon} <strong>{u.name}:</strong> {u.blurb}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="small muted">
          Press <kbd>Tab</kbd> or <kbd>Esc</kbd> to close.
        </p>
      </div>
    </div>
  );
}
