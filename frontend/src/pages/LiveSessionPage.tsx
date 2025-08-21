import { useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getSocket } from '../realtime/socket';
import { EVENTS } from '../realtime/events';
import { stopSession } from '../services/sessionService';
import Scoreboard from '../components/quiz/Scoreboard';
import { useLive } from '../store/sessionStore';

export default function LiveSessionPage() {
  const { sessionId } = useParams();
  const { state } = useLocation() as any;
  const sessionCode = state?.sessionCode;
  const { phase, index, bins, top, set, reset } = useLive();
  const [qCount, setQCount] = useState<number | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.emit(EVENTS.JOIN_ROOM, sessionId);
    s.on(EVENTS.LIVE, (p: { bins: { option: number; count: number }[]; index: number }) => {
      set({ bins: p.bins, phase: 'question', index: p.index });
    });
    s.on(EVENTS.SCOREBOARD, ({ top }: any) => set({ top }));
    s.on(EVENTS.END, () => set({ phase: 'finished' }));
    return () => {
      s.emit(EVENTS.LEAVE_ROOM, sessionId);
      s.off(EVENTS.LIVE);
      s.off(EVENTS.SCOREBOARD);
      s.off(EVENTS.END);
      reset();
    };
  }, [sessionId, set, reset]);

  function next() {
    const s = getSocket();
    s.emit(EVENTS.NEXT, { sessionId, index: index + 1 });
    set({ bins: [], phase: 'question', index: index + 1 });
  }

  function showTop3() {
    getSocket().emit(EVENTS.SHOW_SCOREBOARD, { sessionId, limit: 3 });
  }

  async function end() {
    await stopSession(sessionId!);
    getSocket().emit(EVENTS.END, { sessionId });
  }

  return (
    <PageShell>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card title={`Live responses – Q${index + 1}${qCount ? ` / ${qCount}` : ''}`}>
            <div className="space-y-2">
              {bins.map(b => (
                <div key={b.option} className="flex items-center gap-2">
                  <div className="w-10 font-mono">#{b.option + 1}</div>
                  <div className="h-3 bg-gray-200 rounded flex-1">
                    <div
                      className="h-3 bg-indigo-500 rounded"
                      style={{ width: `${Math.min(100, b.count * 10)}%` }}
                    />
                  </div>
                  <div className="w-8 text-right">{b.count}</div>
                </div>
              ))}
              {bins.length === 0 && <div className="text-sm text-gray-500">No answers yet.</div>}
            </div>
          </Card>
        </div>
        <div>
          <Card title="Controls">
            {sessionCode && <div className="mb-2">Code: <b className="font-mono">{sessionCode}</b></div>}
            <div className="space-y-2">
              <Button onClick={showTop3}>Show leaderboard</Button>
              <Button onClick={next}>Next Question</Button>
              <Button onClick={end}>End Quiz</Button>
            </div>
          </Card>
          <Card title="Top-3">
            <Scoreboard top={top} />
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
