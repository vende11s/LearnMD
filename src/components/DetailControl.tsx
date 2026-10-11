import type { DetailLevel as Detail } from '../reader/context';

export function DetailControl({
  detail,
  setDetail,
}: {
  detail: Detail;
  setDetail: (d: Detail) => void;
}) {
  return (
    <div
      className="segmented detail-control"
      role="group"
      aria-label="Level of detail"
    >
      {(['concise', 'standard', 'detailed'] as const).map((d) => (
        <button
          key={d}
          className={d === detail ? 'selected' : ''}
          aria-pressed={d === detail}
          onClick={() => setDetail(d)}
        >
          {d[0].toUpperCase() + d.slice(1)}
        </button>
      ))}
    </div>
  );
}
