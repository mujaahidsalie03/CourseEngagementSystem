import { Link } from 'react-router-dom';
import { useAuthCtx } from '../../auth/AuthContext';

export default function PageShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthCtx();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="text-indigo-600 font-semibold">CES</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.role}</span>
          <button onClick={logout} className="px-3 py-1 rounded border">Logout</button>
        </div>
      </div>
      {children}
    </div>
  );
}
