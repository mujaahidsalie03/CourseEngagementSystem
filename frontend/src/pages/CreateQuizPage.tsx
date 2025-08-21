import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import { useState } from 'react';
import { createQuiz } from '../services/quizService';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function CreateQuizPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const courseId = sp.get('courseId') || '';

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState([
    {
      questionText: '',
      answers: [
        { answerText: 'A', isCorrect: true },
        { answerText: 'B', isCorrect: false }
      ],
      points: 1
    }
  ]);
  const [err, setErr] = useState('');

  function addQ() {
    setQuestions((q) => [
      ...q,
      {
        questionText: '',
        answers: [
          { answerText: 'A', isCorrect: true },
          { answerText: 'B', isCorrect: false }
        ],
        points: 1
      }
    ]);
  }
  function setQ(i: number, patch: any) {
    setQuestions((q) => q.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function setAns(i: number, ai: number, patch: any) {
    setQuestions((q) =>
      q.map((x, idx) =>
        idx === i ? { ...x, answers: x.answers.map((a, j) => (j === ai ? { ...a, ...patch } : a)) } : x
      )
    );
  }

  async function save() {
    try {
      if (!courseId) {
        setErr('courseId is required (open this page from a course)');
        return;
      }
      const quiz = await createQuiz(courseId, title, questions);
      nav(`/lecturer/course/${courseId}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || 'Failed');
    }
  }

  return (
    <PageShell>
      <Card title="Create Quiz">
        {/* Read-only; no prompt */}
        <TextInput label="Course ID" value={courseId} readOnly />

        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />

        {questions.map((q: any, i: number) => (
          <div key={i} className="border rounded p-3 mb-3">
            <TextInput
              label={`Q${i + 1} text`}
              value={q.questionText}
              onChange={(e) => setQ(i, { questionText: e.target.value })}
            />
            <div className="text-sm mb-1">Answers</div>
            {q.answers.map((a: any, ai: number) => (
              <div key={ai} className="flex items-center gap-2 mb-2">
                <input
                  className="border rounded px-2 py-1 flex-1"
                  value={a.answerText}
                  onChange={(e) => setAns(i, ai, { answerText: e.target.value })}
                />
                <label className="text-sm flex items-center gap-1">
                  <input
                    type="radio"
                    name={`correct-${i}`}
                    checked={a.isCorrect}
                    onChange={() =>
                      setQ(i, {
                        answers: q.answers.map((x: any, j: number) => ({ ...x, isCorrect: j === ai }))
                      })
                    }
                  />
                  correct
                </label>
              </div>
            ))}
            <button
              className="text-sm"
              onClick={() => setQ(i, { answers: [...q.answers, { answerText: 'New', isCorrect: false }] })}
            >
              + add answer
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-gray-100" onClick={addQ}>
            + Add Question
          </button>
          <Button disabled={!courseId} onClick={save}>
            Save
          </Button>
        </div>

        {err && <div className="text-red-600 mt-2">{err}</div>}
        {!courseId && (
          <div className="text-sm mt-2">
            Tip: open this from the course page (the “+ Create Quiz” link adds <code>?courseId=…</code>).
          </div>
        )}
      </Card>
    </PageShell>
  );
}
