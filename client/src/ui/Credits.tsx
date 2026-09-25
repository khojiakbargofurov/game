import { CREDITS } from '../credits';

/** Mualliflar: o'yindagi modellar va ularning litsenziyalari */
export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel credits" onClick={(e) => e.stopPropagation()}>
        <h2>Mualliflar</h2>
        <ul>
          {CREDITS.map((c) => (
            <li key={c.title}>
              <strong>{c.title}</strong>
              {c.author && <span> — {c.author}</span>}
              {c.license && <em> ({c.license})</em>}
              <small>{c.what}</small>
              {c.url && <small className="credit-url">{c.url}</small>}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Yopish</button>
      </div>
    </div>
  );
}
