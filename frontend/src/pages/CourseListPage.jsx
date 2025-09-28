import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { listMyCourses } from "../api/appApi";
import CourseCard from "../components/CourseCard.jsx";

import { pickVisual, visualKeyFromCourse } from "../utils/visual";

export default function CourseListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // UI/data state
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [visualMap, setVisualMap] = useState({}); // stable color/emoji per course key
  const [query, setQuery] = useState("");

  // Fetch the current user's courses (lecturer: mine; student: enrolled)
  useEffect(() => {
    (async () => {
      try {
        const list = await listMyCourses();
        setCourses(Array.isArray(list) ? list : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build a stable palette/emoji per course key
  // Seed and cache visuals per course so colors/emoji don't flicker across renders.
  useEffect(() => {
    if (!courses?.length) return;
    setVisualMap((prev) => {
      const next = { ...prev };
      for (const c of courses) {
        const key = visualKeyFromCourse(c);
        if (!next[key]) next[key] = pickVisual(key);
      }
      return next;
    });
  }, [courses]);

  // Client-side filter by name/code, case-insensitive
  const filtered = useMemo(() => {
    if (!query.trim()) return courses;
    const s = query.toLowerCase();
    return courses.filter(
      (c) =>
        (c.courseName || "").toLowerCase().includes(s) ||
        (c.courseCode || "").toLowerCase().includes(s)
    );
  }, [courses, query]);

  // Loading placeholder
  if (loading) {
    return (
      <>
        <Header />
        <div className="container">
          <div className="card"><Spinner /></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="container">
        <section className="hero">
          <span className="hero-pill">Lecturer</span>
          <h1 className="hero-title">Your Courses</h1>
          <p className="hero-sub">
            Kick off live sessions, build quizzes, and see engagement at a glance.
          </p>
          <div className="hero-controls">
            <input
              className="input"
              placeholder="Search by name or code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </section>

        <div className="courses-grid">
          {filtered.map((c) => {
            const key = visualKeyFromCourse(c);
            const v = visualMap[key] || pickVisual(key);
            return (
              <CourseCard
                key={key}
                course={c}
                visual={v}
                lecturerName={user?.name}
                onOpen={() =>
                  navigate(`/courses/${c._id || c.id}`, {
                    state: { visual: v, seedKey: key },
                  })
                }
              />
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card empty">
            <span className="muted">No courses match “{query}”.</span>
          </div>
        )}
      </div>
    </>
  );
}
