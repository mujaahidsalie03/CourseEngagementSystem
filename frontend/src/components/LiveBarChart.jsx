import { useMemo } from "react";


 //Compact horizontal results with long-label support.
 
 // props:
 //  labels: string[]                // option order
 //  counts: Record<label, number>   // keyed by label
 //  total: number
 
export default function LiveBarChart({ labels = [], counts = {}, total = 0 }) {
  const rows = useMemo(() => {
    return labels.map((label, i) => {
      const value = Number(counts[label] || 0);
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return { id: `${i}`, idx: i + 1, label, value, pct };
    });
  }, [labels, counts, total]);

  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.id} title={r.label}>
          <div className="bar-label">
            <span className="badge index">{r.idx}</span>
            <span className="label-ellipsis">{r.label}</span>
          </div>

          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${r.pct}%` }} />
          </div>

          <div className="bar-count" aria-label={`Count ${r.value}, ${r.pct}%`}>
            <b>{r.value}</b>
            <span className="muted"> {r.pct}%</span>
          </div>
        </div>
      ))}

      <div className="small muted" style={{ textAlign: "right", marginTop: 6 }}>
        Bars update live as answers arrive.
      </div>
    </div>
  );
}
