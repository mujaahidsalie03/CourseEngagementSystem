import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import { joinSession } from '../services/sessionService';

export default function JoinSessionPage() {
  const { id: courseId } = useParams();
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  async function join() {
    setErr('');
    try {
      const { sessionId, quiz } = await joinSession(code);
      nav(`/student/session/${sessionId}`, { state: { quiz } });
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Join failed');
    }
  }

  return (
    <PageShell>
      <Card title={`Join live session for course ${courseId}`}>
        <TextInput label="Enter session code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
        {err && <div className="text-red-600 mb-2">{err}</div>}
        <Button onClick={join}>Join</Button>
      </Card>
    </PageShell>
  );
}
