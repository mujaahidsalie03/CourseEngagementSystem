import { useEffect, useState } from 'react';
import PageShell from '../components/ui/PageShell';
import { listMyCourses } from '../services/courseService';
import type { Course } from '../domain/types';
import { Link } from 'react-router-dom';

export default function StudentHome() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setCourses(await listMyCourses());
      } catch {
        setErr('Failed to load courses');
      }
    })();
  }, []);

  return (
    <PageShell>
      <h1 className="text-4xl font-bold mb-4">My Courses</h1>
      {err && <div className="text-red-600 mb-3">{err}</div>}
      {courses.length === 0 ? (
        <div>No courses yet.</div>
      ) : (
        <ul className="space-y-2">
          {courses.map(c => (
            <li key={c._id} className="border rounded p-3">
              <div className="font-semibold">{c.courseName} {c.courseCode ? `(${c.courseCode})` : ''}</div>
              <Link to={`/student/course/${c._id}/join`} className="underline text-sm">Join live session</Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
