import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import { useAuthCtx } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuthCtx();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
      nav('/');
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Login failed');
    }
  }

  return (
    <PageShell>
      <Card title="Login">
        <form onSubmit={onSubmit} className="max-w-md">
          <TextInput label="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <TextInput label="Password" type="password" value={password} onChange={e => setPw(e.target.value)} />
          {err && <div className="text-red-600 my-2">{err}</div>}
          <Button type="submit">Login</Button>
        </form>
      </Card>
    </PageShell>
  );
}
