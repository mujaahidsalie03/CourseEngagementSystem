import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import { pickVisual, visualKeyFromCourse } from "../utils/visual";
import { getMyCourses } from "../api/studentApi";

/* ---------- Safe field helpers across mixed backends ---------- */
const titleOf = (c) => c?.courseName || c?.title || "Untitled course";
const codeOf  = (c) => c?.courseCode || c?.code || "";

/**
 * Prefer lecturerId.name (your DB schema) or lecturer.name.
 * Then try string fallbacks. Avoid falling back to createdBy/owner
 * unless absolutely nothing else exists, because that’s how a student’s
 * name was showing up.
 */
function instructorOf(c) {
  if (!c) return "";

  // 1) Object refs (populated)
  if (c.lecturerId?.name) return c.lecturerId.name;
  if (c.lecturer?.name)   return c.lecturer.name;

  // 2) String fields
  if (typeof c.lecturer === "string")      return c.lecturer;
  if (typeof c.lecturerName === "string")  return c.lecturerName;
  if (typeof c.lecturer_name === "string") return c.lecturer_name;
  if (typeof c.instructor === "string")    return c.instructor;
  if (typeof c.teacher === "string")       return c.teacher;

  // 3) Arrays
  if (Array.isArray(c.lecturers)  && c.lecturers[0]?.name)  return c.lecturers[0].name;
  if (Array.isArray(c.instructors) && c.instructors[0]?.name) return c.instructors[0].name;
  if (Array.isArray(c.teachers)   && c.teachers[0]?.name)   return c.teachers[0].name;

  // 4) As a *last* resort only
  if (c.instructorName) return c.instructorName;
  if (c.teacherName)    return c.teacherName;

  return "";
}

export default function StudentCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const nav = useNavigate();

  const vis = useMemo(() => ({ a: "#B8C6FF", b: "#A78BFA" }), []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await getMyCourses();
        setCourses(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        setError("Could not load your courses.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <Header />
      <div className="container" style={{ "--accent": vis.a, "--accent2": vis.b }}>
        {/* Hero */}
        <section className="course-hero colored" style={{ marginBottom: 18 }}>
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>🎓</div>
            <div>
              <h1 className="course-title" style={{ margin: 0 }}>My Courses</h1>
              <div className="meta">
                <span className="chip">Enrolled: <b>{courses.length}</b></span>
              </div>
            </div>
          </div>
        </section>

        {loading && <div className="card"><Spinner /></div>}
        {!loading && error && (
          <div className="card" style={{ color: "#b91c1c" }}>{error}</div>
        )}
        {!loading && !error && courses.length === 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>No courses yet</h3>
            <div className="small muted">
              If you think this is a mistake, please contact your instructor.
            </div>
          </div>
        )}

        {!loading && !error && courses.length > 0 && (
          <div className="courses-grid">
            {courses.map((course) => {
              const seedKey = visualKeyFromCourse(course);
              const v = pickVisual(seedKey);
              const bg = `linear-gradient(135deg, ${v.a}, ${v.b})`;
              const id = course._id || course.id;
              const teacher = instructorOf(course) || "—";

              const go = () =>
                nav(`/s/courses/${id}`, {
                  state: { visual: v, seedKey },
                });

              return (
                <div
                  key={id}
                  className="gcard course-card"
                  style={{ background: bg, cursor: "pointer" }}
                  title={titleOf(course)}
                  role="button"
                  tabIndex={0}
                  onClick={go}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go()}
                >
                  <div className="gcard-top">
                    <div className="g-emoji">{v.emoji}</div>
                    {!!codeOf(course) && (
                      <span className="g-code">Code: {codeOf(course)}</span>
                    )}
                  </div>

                  <div className="g-title">{titleOf(course)}</div>
                  <div className="g-sub">Lecturer: {teacher}</div>

                  <div className="g-bottom">
                    <span
                      className="g-chip btn secondary"
                      onClick={(e) => { e.stopPropagation(); go(); }}
                    >
                      Open
                    </span>
                    <span className="g-arrow">↗</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
