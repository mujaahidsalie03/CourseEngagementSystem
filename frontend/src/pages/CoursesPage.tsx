import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

import { listMyCourses } from '../services/courseService';
import type { Course } from '../domain/types';
import { useAuthCtx } from '../auth/AuthContext';

export default function CoursesPage() {
  const { user, logout } = useAuthCtx();
  const [courses, setCourses] = useState<Course[]>([]);
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await listMyCourses(); // GET /api/courses
        if (!alive) return;
        setCourses(data || []);
        setErr('');
      } catch (e: any) {
        setErr('Failed to load courses');
        setCourses([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function goToCourse(c: Course) {
    if (user?.role === 'lecturer') {
      nav(`/lecturer/course/${c._id}`);
    } else {
      nav(`/student/join?courseId=${c._id}`);
    }
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="text-xl font-semibold">CES</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-70">{user?.role}</span>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>

      <h1 className="text-4xl font-bold mb-4">My Courses</h1>

      {loading && <div>Loading…</div>}
      {!loading && err && <div className="text-red-600 mb-3">{err}</div>}

      {!loading && !err && courses.length === 0 && (
        <div>No courses yet.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => (
          <button
            key={c._id}
            onClick={() => goToCourse(c)}
            className="text-left"
          >
            <Card hover title={c.courseName}>
              <div className="text-sm opacity-70">{c.courseCode || '—'}</div>
              <div className="mt-3">
                <span className="underline">
                  {user?.role === 'lecturer' ? 'Open course' : 'Join a session'}
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </PageShell>
  );
}
