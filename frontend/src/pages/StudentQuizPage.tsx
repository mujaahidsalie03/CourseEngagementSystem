import { useLocation, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { submitAnswer } from '../services/sessionService';
import { getSocket } from '../realtime/socket';
import { EVENTS } from '../realtime/events';
import Scoreboard from '../components/quiz/Scoreboard';
import { useLive } from '../store/sessionStore';

export default function StudentQuizPage() {
  const { sessionId } = useParams();
  const { state } = useLocation() as any;
  const quiz = state?.quiz;
  const { phase, top, index, set } = useLive();
  const [answerIdx, setAnswerIdx] = useState(-1);
  const q = quiz?.questions?.[index];

  useEffect(() => {
    const s = getSocket();
    s.emit(EVENTS.JOIN_ROOM, sessionId);
    s.on(EVENTS.START, () => { set({ phase: 'question', index: 0 }); setAnswerIdx(-1); });
    s.on(EVENTS.NEXT, (p: any) => { set({ phase: 'question', index: p.index }); setAnswerIdx(-1); });
    s.on(EVENTS.PHASE, (p: any) => set({ phase: p.value, index: typeof p.index === 'number' ? p.index : index }));
    s.on(EVENTS.SCOREBOARD, ({ top }) => set({ top }));
    s.on(EVENTS.END, () => set({ phase: 'finished' }));
    return () => {
      s.emit(EVENTS.LEAVE_ROOM, sessionId);
      s.off(EVENTS.START); s.off(EVENTS.NEXT); s.off(EVENTS.PHASE); s.off(EVENTS.SCOREBOARD); s.off(EVENTS.END);
    };
  }, [sessionId, set, index]);

  async function submit() {
    if (answerIdx < 0) return;
    await submitAnswer(sessionId!, index, answerIdx);
  }

  if (!quiz) {
    return <PageShell><Card>Open via “Join session”.</Card></PageShell>;
  }
  if (phase === 'scoreboard') {
    return <PageShell><Scoreboard top={top} /></PageShell>;
  }
  if (phase === 'finished') {
    return <PageShell><Card>Session finished.</Card></PageShell>;
  }
  if (!q) {
    return <PageShell><Card>Waiting for quiz to start…</Card></PageShell>;
  }

  return (
    <PageShell>
      <Card title={`Q${index + 1} / ${quiz.questions.length}`}>
        <div className="mb-3 text-lg">{q.questionText}</div>
        <div className="space-y-2">
          {q.answers.map((a: any, i: number) => (
            <label key={i} className="flex items-center gap-2">
              <input type="radio" name="ans" checked={answerIdx === i} onChange={() => setAnswerIdx(i)} />
              <span>{a.answerText}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit}>Submit</Button>
        </div>
      </Card>
    </PageShell>
  );
}
