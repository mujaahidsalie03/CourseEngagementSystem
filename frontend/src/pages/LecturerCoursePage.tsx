import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { listQuizzesByCourse } from '../services/quizService';
import { useEffect, useState } from 'react';
import { startSession } from '../services/sessionService';

export default function LecturerCoursePage() {
  const { id: courseId } = useParams();
  const nav = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        if (!courseId) return;
        const list = await listQuizzesByCourse(courseId);
        setQuizzes(list || []);
      } catch (e: any) {
        setErr(e?.response?.data?.message || 'Failed to load quizzes');
        setQuizzes([]);
      }
    })();
  }, [courseId]);

  async function begin(quizId: string) {
    try {
      const { sessionId, sessionCode } = await startSession(quizId);
      nav(`/lecturer/session/${sessionId}`, { state: { sessionCode } });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not start session');
    }
  }

  return (
    <PageShell>
      <Card title={`Course ${courseId}`}>
        <div className="mb-3">
          {/* ✅ pass the courseId so Create knows which course to attach to */}
          <Link to={`/lecturer/create?courseId=${courseId}`} className="underline">
            + Create Quiz
          </Link>
        </div>

        {err && <div className="text-red-600 mb-2">{err}</div>}

        <div className="space-y-2">
          {quizzes.map((q) => (
            <div key={q._id} className="flex items-center justify-between border rounded p-2">
              <div>{q.title}</div>
              <Button onClick={() => begin(q._id)}>Start Session</Button>
            </div>
          ))}
          {quizzes.length === 0 && <div>No quizzes yet.</div>}
        </div>
      </Card>
    </PageShell>
  );
}
