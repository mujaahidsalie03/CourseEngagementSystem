import type { LeaderboardRow } from '../../domain/types';
export default function Scoreboard({ top }: { top: LeaderboardRow[] }) {
  return (
    <div>
      <div className="font-semibold mb-2">Top performers</div>
      <ol className="list-decimal pl-6">
        {top.map((r, i) => (
          <li key={i} className="py-1">{r.name} — {r.total}</li>
        ))}
        {top.length === 0 && <li className="list-none text-sm text-gray-500">No scores yet.</li>}
      </ol>
    </div>
  );
}
