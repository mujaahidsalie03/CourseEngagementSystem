import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { getCourse, listQuizzesByCourse } from "../api/appApi";
import { pickVisual, visualKeyFromCourse } from "../utils/visual";
import { useAuth } from "../auth/AuthContext.jsx";
import { joinSessionByCode } from "../api/appApi";

// instructor helper
function instructorOf(c) {
  if (!c) return "";
  if (c.lecturerId?.name) return c.lecturerId.name;
  if (c.lecturer?.name) return c.lecturer.name;
  if (typeof c.lecturer === "string") return c.lecturer;
  if (typeof c.lecturerName === "string") return c.lecturerName;
  if (typeof c.lecturer_name === "string") return c.lecturer_name;
  if (typeof c.instructor === "string") return c.instructor;
  if (typeof c.teacher === "string") return c.teacher;
  if (Array.isArray(c.lecturers) && c.lecturers[0]?.name) return c.lecturers[0].name;
  if (Array.isArray(c.instructors) && c.instructors[0]?.name) return c.instructors[0].name;
  if (Array.isArray(c.teachers) && c.teachers[0]?.name) return c.teachers[0].name;
  if (c.instructorName) return c.instructorName;
  if (c.teacherName) return c.teacherName;
  return "";
}

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(+dt) ? "" : dt.toLocaleDateString();
};

// total points helper
const totalPointsOf = (qz) => {
  if (typeof qz.totalPoints === "number") return qz.totalPoints;
  if (typeof qz.maxPoints === "number") return qz.maxPoints;
  if (Array.isArray(qz.questions)) {
    return qz.questions.reduce((sum, qq) => sum + (Number(qq.points) || 1), 0);
  }
  const cnt = Number(qz.questionCount ?? 0);
  return Number.isFinite(cnt) ? cnt : 0;
};

// recognize backend "myStatus"/"myScore" first, then heuristics
function completedForUser(q, me) {
  if (!q) return false;
  if (q.myStatus === "completed") return true;
  if (q.myCompleted === true) return true;
  if (q.myScore != null) return true;
  if (q.score != null) return true;
  if (q.stats?.myScore != null) return true;
  if (q.lastAttempt?.submitted === true) return true;
  if (Array.isArray(q.attempts)) {
    const uid = me?.id || me?._id || me?.userId;
    if (uid && q.attempts.some(a => (a.userId === uid || a.user === uid) && a.submitted)) return true;
  }
  return false;
}

export default function StudentCourseDetailPage() {
  const { courseId } = useParams();
  const { state } = useLocation();
  const { user: me } = useAuth();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState("all"); // all | done | todo

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

  const vis = useMemo(() => {
    if (state?.visual) return state.visual;
    return pickVisual(visualKeyFromCourse(course || { _id: courseId }));
  }, [courseId, course, state?.visual]);

  const cssVars = { "--accent": vis.a, "--accent2": vis.b };

  const onJoin = async (e) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) return;
    try {
      const join = await joinSessionByCode(code, courseId);
      window.location.assign(`/s/sessions/${join.sessionId}/waiting`);
    } catch (err) {
      alert("Invalid or inactive session code.");
      console.error(err);
    }
  };

  const done = quizzes.filter((q) => completedForUser(q, me));
  const todo = quizzes.filter((q) => !completedForUser(q, me));
  const list = tab === "done" ? done : tab === "todo" ? todo : quizzes;

  if (loading) {
    return (
      <>
        <Header />
        <div className="container"><div className="card"><Spinner /></div></div>
      </>
    );
  }

  if (!course) {
    return (
      <>
        <Header />
        <div className="container"><div className="card">Course not found.</div></div>
      </>
    );
  }

  const teacher = instructorOf(course);

  return (
    <>
      <Header />
      <div className="container" style={cssVars}>
        <div className="crumbs">
          <Link to="/s/courses">Courses</Link>
          <span>›</span>
          <span>{course.courseName || "Course"}</span>
        </div>

        <section className="course-hero colored" style={{ marginBottom: 18 }}>
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>{vis.emoji}</div>
            <div>
              <h1 className="course-title" style={{ margin: 0 }}>
                {course.courseName || "Course"}
              </h1>
              <div className="meta">
                {course.courseCode && <span className="chip accent">{course.courseCode}</span>}{" "}
                {teacher && <span>Lecturer: {teacher}</span>}
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Join a Live Session</h3>
          <form className="row" style={{ gap: 10 }} onSubmit={onJoin}>
            <input
              className="input"
              placeholder="ENTER SESSION CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              aria-label="Session code"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn">Join</button>
          </form>
        </section>

        <section className="sheet">
          <div className="toolbar" style={{ gap: 10, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>
              QUIZZES  <span className="muted">({quizzes.length})</span>
            </h3>
            <div className="seg" style={{ marginLeft: "auto" }}>
              <button type="button" className={`seg-btn ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All</button>
              <button type="button" className={`seg-btn ${tab === "done" ? "active" : ""}`} onClick={() => setTab("done")}>Completed ({done.length})</button>
              <button type="button" className={`seg-btn ${tab === "todo" ? "active" : ""}`} onClick={() => setTab("todo")}>Not completed ({todo.length})</button>
            </div>
          </div>

          {list.length === 0 ? (
            <div className="empty muted">
              {tab === "done" ? "No completed quizzes yet." : tab === "todo" ? "Nothing pending — nice!" : "No quizzes yet."}
            </div>
          ) : (
            list.map((qz) => {
              const count = qz.questionCount ?? (qz.questions?.length || 0);
              const when = fmtDate(qz.updatedAt || qz.createdAt);
              const score = qz.myScore ?? qz.score ?? qz.stats?.myScore ?? null;
              const total = totalPointsOf(qz);
              const isDone = completedForUser(qz, me);

              const content = (
                <>
                  <div className="quiz-row-left">
                    <span className={`accent-dot ${isDone ? "" : "muted"}`} aria-hidden />
                    <div>
                      <div className="quiz-title">
                        {qz.title}
                        {!isDone && <span className="chip" style={{ marginLeft: 8 }}></span>}
                      </div>
                      <div className="small">
                        {count} {count === 1 ? "question" : "questions"}
                      </div>
                    </div>
                  </div>
                  <div className="quiz-row-right small">
                    {when && <span className="muted" style={{ marginRight: 12 }}>{when}</span>}
                    {score != null && (
                      <span>
                        Score: <b>{score}</b>{total ? ` / ${total}` : ""}
                      </span>
                    )}
                  </div>
                </>
              );

              return isDone ? (
                <Link
                  key={qz._id}
                  className="quiz-row row-hover"
                  to={`/s/courses/${courseId}/quizzes/${qz._id}/review`}
                  style={{ textDecoration: "none", color: "inherit" }}
                  title="View your answers"
                >
                  {content}
                </Link>
              ) : (
                <div key={qz._id} className="quiz-row row-hover" title="Not completed">
                  {content}
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
