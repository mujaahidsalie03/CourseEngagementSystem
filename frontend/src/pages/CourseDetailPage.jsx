import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { getCourse, listQuizzesByCourse } from "../api/appApi";
import { useAuth } from "../auth/AuthContext.jsx";
import { pickVisual, visualKeyFromCourse } from "../utils/visual";
import { createSession } from "../api/appApi";

export default function CourseDetailPage() {
  const { courseId } = useParams(); // course id from route
  const navigate = useNavigate(); // programmatic navigation
  const location = useLocation(); // read route state (for visuals)
  const { user } = useAuth(); // current user (for role gating)

  // Local state for data + UI
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("alpha");

  // Fetch course + quizzes when courseId changes.
  useEffect(() => {
    (async () => {
      try {
        const c = await getCourse(courseId);
        const qz = await listQuizzesByCourse(courseId);
        setCourse(c || null);
        setQuizzes(Array.isArray(qz) ? qz : []);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  // Computed, filtered/sorted list (stable until deps change)
  const filtered = useMemo(() => {
    let list = quizzes;
    if (query.trim()) {
      const s = query.toLowerCase();
      list = list.filter((q) => (q.title || "").toLowerCase().includes(s));
    }
    if (sort === "alpha") {
      // clone before sort to avoid mutating state
      list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else {
      const count = (x) => x.questionCount ?? (x.questions?.length || 0);
      list = [...list].sort((a, b) => count(b) - count(a));
    }
    return list;
  }, [quizzes, query, sort]);

  // Loading state: header + centered spinner card
  if (loading) {
    return (
      <>
        <Header />
        <div className="container"><div className="card"><Spinner /></div></div>
      </>
    );
  }

  // Not found state
  if (!course) {
    return (
      <>
        <Header />
        <div className="container"><div className="card">Course not found.</div></div>
      </>
    );
  }

  // Visual theming for this page (seeded so color/emoji are stable on refresh)
  const routed = location.state?.visual;
  const seedKey = location.state?.seedKey ?? visualKeyFromCourse(course);
  const vis = routed ?? pickVisual(seedKey);
  const cssVars = { "--accent": vis.a, "--accent2": vis.b };

  // Visual theming for this page (seeded so color/emoji are stable on refresh)
  async function handleStartSession(qz) {
    try {
      // dev auth: backend reads userId from body/headers
      const created = await createSession({ quizId: qz._id, courseId: course._id, userId: user?._id });
      // Carry visual + course bread crumb context to the session page
      navigate(`/sessions/${created.sessionId}`, {
        state: { visual: vis, course: { id: course._id, name: course.courseName } }
      });
    } catch (e) {
      alert("Could not start session.");
      console.error(e);
    }
  }

  const isLecturer = user?.role === "lecturer";

  return (
    <>
      <Header />
      <div className="container" style={cssVars}>
        <div className="crumbs">
          <Link to="/courses">Courses</Link>
          <span>›</span>
          <span>{course.courseName}</span>
        </div>

        <section className="course-hero colored">
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>{vis.emoji}</div>
            <div>
              <h1 className="course-title">{course.courseName}</h1>
              <div className="meta">
                <span className="chip accent">{course.courseCode}</span>{" "}
                <span>{isLecturer ? (user?.name || "Lecturer") : "Course"}</span>
              </div>
            </div>
          </div>

          {/* Only lecturers can create new quizzes */}
          {isLecturer && (
            <button
              type="button"
              className="btn accent"
              onClick={() => navigate(`/courses/${courseId}/quizzes/new`)}
            >
              Create New Quiz
            </button>
          )}
        </section>

        <section className="sheet">
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>
              Quizzes <span className="muted">({filtered.length})</span>
            </h3>
            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder="Search quizzes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="input"
                style={{ maxWidth: 120 }}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="alpha">A → Z</option>
                <option value="count">Most questions</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty muted">No quizzes yet.</div>
          ) : (
            filtered.map((qz) => {
              const count = qz.questionCount ?? (qz.questions?.length || 0);
              return (
                <div key={qz._id} className="quiz-row row-hover">
                  <div className="quiz-row-left">
                    <span className="accent-dot" aria-hidden />
                    <div>
                      <div className="quiz-title">{qz.title}</div>
                      <div className="small">{count} {count === 1 ? "question" : "questions"}</div>
                    </div>
                  </div>

                  {/* Only lecturers can start sessions or edit */}
                  {isLecturer && (
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn accent"
                        onClick={() => handleStartSession(qz)}
                      >
                        Start Session
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() =>
                          navigate(`/courses/${courseId}/quizzes/${qz._id}/edit`)
                        }
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
