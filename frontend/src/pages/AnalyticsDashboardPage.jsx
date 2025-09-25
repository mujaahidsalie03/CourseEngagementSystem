// src/pages/AnalyticsDashboardPage.jsx
import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import Card from "../components/Card.jsx";
import LiveBarChart from "../components/LiveBarChart.jsx";
import {
  listMyCourses,
  getCourseAnalytics,
  getCourseTrend,
  getQuizAnalytics,
  getStudentCourseAnalytics,
} from "../api/appApi.js";

/* ---------- helpers ---------- */
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x || 0)));
const pctTxt = (x) => `${Math.round(clamp01(x) * 100)}%`;

/* ---------- tiny SVG widgets (kept dependency-free) ---------- */
function Donut({ value = 0, size = 120, label = "", stroke = 12, color = "var(--accent)" }) {
  const v = clamp01(value);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${c * v} ${c * (1 - v)}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef2ff" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={dash} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="48%" textAnchor="middle" className="donut__value">{pctTxt(v)}</text>
      <text x="50%" y="66%" textAnchor="middle" className="donut__label">{label}</text>
    </svg>
  );
}

// REPLACE the whole BucketBar component with this
function BucketBar({ hist = [] }) {
  const max = Math.max(1, ...hist);
  return (
    <div className="hist">
      {hist.map((v, i) => {
        const low = i * 10;
        const high = i === 9 ? 100 : i * 10 + 10;
        const label = `${low}–${high}%`;
        const h = (v / max) * 86 + 4; // bar height: 4–90px
        return (
          <div key={i} className="hist__col" title={label}>
            <div className="hist__bar">
              {v > 0 && <div className="hist__count">{v}</div>}
              <div className="hist__fill" style={{ height: `${h}px` }} />
            </div>
            <div className="hist__label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- page ---------- */
export default function AnalyticsDashboardPage() {
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");

  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [quizDetails, setQuizDetails] = useState({});   // quizId -> quiz summary
  const [studentDetails, setStudentDetails] = useState({}); // studentId -> student course summary
  const [userQuery, setUserQuery] = useState("");

  const toggleStudentDetails = async (studentId) => {
    if (studentDetails[studentId]) {
      // hide
      setStudentDetails((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    } else {
      // load & show
      const d = await getStudentCourseAnalytics(studentId, courseId);
      setStudentDetails((prev) => ({ ...prev, [studentId]: d || {} }));
    }
  };

  /* load courses, preselect first */
  useEffect(() => {
    (async () => {
      try {
        const cs = await listMyCourses();
        setCourses(Array.isArray(cs) ? cs : []);
        if (Array.isArray(cs) && cs.length) setCourseId(String(cs[0]._id || cs[0].id));
      } finally {
        setLoadingCourses(false);
      }
    })();
  }, []);

  /* load analytics when course changes */
  useEffect(() => {
    (async () => {
      if (!courseId) return;
      setSummary(null); setTrend([]); setQuizDetails({}); setStudentDetails({});
      const s = await getCourseAnalytics(courseId);
      setSummary(s || {});
      const t = await getCourseTrend(courseId);
      setTrend(Array.isArray(t?.trend) ? t.trend : []);
    })();
  }, [courseId]);

  /* derived */
  const course = useMemo(
    () => courses.find(c => String(c._id || c.id) === String(courseId)) || null,
    [courses, courseId]
  );
  const perQuiz = useMemo(() => summary?.perQuiz ?? [], [summary]);
  const registeredCount = summary?.registeredCount || 0;

  const students = useMemo(() => {
    const arr = summary?.students ?? [];
    const q = userQuery.trim().toLowerCase();
    return q ? arr.filter(s => (s.name || "").toLowerCase().includes(q)) : arr;
  }, [summary, userQuery]);

  // quiz details: toggle show/hide
  const toggleQuizDetails = async (quizId) => {
    if (quizDetails[quizId]) {
      setQuizDetails(prev => {
        const copy = { ...prev };
        delete copy[quizId];
        return copy;
      });
      return;
    }
    const q = await getQuizAnalytics(quizId);
    setQuizDetails(prev => ({ ...prev, [quizId]: q || {} }));
  };

  const loadStudent = async (studentId) => {
    if (studentDetails[studentId]) return;
    const d = await getStudentCourseAnalytics(studentId, courseId);
    setStudentDetails(prev => ({ ...prev, [studentId]: d || {} }));
  };

  return (
    <>
      <Header />
      <div className="ana" style={{ "--accent": "#8b5cf6", "--accent2": "#60a5fa" }}>
        {/* ---------- HERO ---------- */}
        <section className="ana-hero">
          <div className="ana-hero__inner">
            <div className="ana-hero__left">
              <span className="hero-icon" aria-hidden>📊</span>
              <div className="hero-texts">
                <h1 className="hero-title">Analytics&nbsp;Dashboard</h1>
                <div className="hero-sub">Lecturer Dashboard</div>
              </div>
            </div>
            {course && <span className="hero-code">{course.courseCode || ""}</span>}
          </div>
        </section>

        {/* ---------- SELECTOR BAR ---------- */}
        <section className="ana-select">
          <div className="select-label">Select a course</div>
          {loadingCourses ? (
            <Spinner />
          ) : (
            <select
              className="select-input"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.courseName || c.name || "Course"}
                </option>
              ))}
            </select>
          )}
        </section>

        {!summary ? (
          <div className="card"><Spinner /></div>
        ) : (
          <>
            {/* ===========================================================
                 OVERALL COURSE ANALYTICS
                 =========================================================== */}
            <section className="sheet">
              <div className="toolbar">
                <h3 className="toolbar-title">Overall Course Analytics</h3>
                <span className="muted small">Registered students: {registeredCount}</span>
              </div>

              <div className="kpi-grid">
                <Card title="Sessions Held">
                  <div className="kpi" title="Number of sessions held for this course">
                    <span className="kpi__icon">🗓️</span>
                    <span className="kpi__num">{summary.sessionsHeld || 0}</span>
                  </div>
                </Card>

                <Card title="Active Students">
                  <div className="kpi" title="Unique students seen in sessions or responses">
                    <span className="kpi__icon">👥</span>
                    <span className="kpi__num">{summary.activeStudents || 0}</span>
                  </div>
                </Card>

                <Card title="Average Mark">
                  <div title="Average of per-student quiz averages (missing quizzes count as 0)">
                    <Donut value={summary.avgMark} label="Avg Mark" color="var(--accent)" />
                  </div>
                </Card>

                <Card title="Average Participation Rate">
                  <div title="Average of (responders ÷ registered) across all quiz sessions">
                    <Donut value={summary.avgParticipation} label="Avg Rate" color="var(--accent2)" />
                  </div>
                </Card>
              </div>

              <div className="grid">
                <Card title="Top Students (≥ 80%)">
                  {(summary.topStudents || []).length === 0 ? (
                    <div className="small muted">None yet</div>
                  ) : (
                    <table className="table small">
                      <thead>
                        <tr><th>Name</th><th>Quiz Avg</th><th>Quizzes Done</th></tr>
                      </thead>
                      <tbody>
                        {summary.topStudents.map((s) => (
                          <tr key={s.studentId}>
                            <td className="ellipsis">{s.name}</td>
                            <td><b>{pctTxt(s.avg)}</b></td>
                            <td>{s.quizzesDone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card title="At-Risk (≤ 50%)">
                  {(summary.atRiskStudents || []).length === 0 ? (
                    <div className="small muted">No one flagged</div>
                  ) : (
                    <table className="table small">
                      <thead>
                        <tr><th>Name</th><th>Quiz Avg</th><th>Quizzes Done</th></tr>
                      </thead>
                      <tbody>
                        {summary.atRiskStudents.map((s) => (
                          <tr key={s.studentId}>
                            <td className="ellipsis">{s.name}</td>
                            <td><b>{pctTxt(s.avg)}</b></td>
                            <td>{s.quizzesDone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            </section>

            {/* ===========================================================
                 PER-QUIZ ANALYTICS
                 =========================================================== */}
            <section className="sheet">
              <div className="toolbar">
                <h3 className="toolbar-title">Per-Quiz Analytics</h3>
                <span className="muted small">{perQuiz.length} total</span>
              </div>

              {perQuiz.length === 0 ? (
                <div className="empty muted">No quizzes yet.</div>
              ) : (
                perQuiz.map((qz) => {
                  const qKey = qz.quizId;
                  const details = quizDetails[qKey] || null;

                  const labels = (qz.questions || []).map((q) => `Q${q.index + 1}`);
                  const counts = Object.fromEntries(
                    (qz.questions || []).map((q) => [
                      `Q${q.index + 1}`,
                      Math.round(clamp01(q.difficulty) * 100),
                    ])
                  );

                  return (
                    <div key={qKey} className="card panel-lg quiz-panel">
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div className="quiz-title">{qz.title || "Untitled quiz"}</div>
                          <div className="small muted">{qz.participants || 0} participants (summed across sessions)</div>
                        </div>
                        <button className="btn secondary" onClick={() => toggleQuizDetails(qKey)}>
                          {details ? "Hide details" : "View details"}
                        </button>
                      </div>

                      {/* Question difficulty bars */}
                      <div style={{ marginTop: 10 }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>
                          Difficulty per question (higher = easier)
                        </div>
                        <LiveBarChart labels={labels} counts={counts} total={100} />
                      </div>

                      {details && (
                        <div className="panel" style={{ marginTop: 12 }}>
                          <div className="panel-title">Quiz Details</div>

                          <div className="mini-kpis">
                            <div className="mini tooltip"
                              data-tip="Participation = average (per session) of responders ÷ attendees. A responder is a student who answered at least one question in that session.">
                              <Donut value={details.participation} size={110} label="Participation" color="var(--accent2)" />
                            </div>
                            <div className="mini tooltip"
                              data-tip="Completion = % of students who answered ALL questions in this quiz. Missing answers count as 0.">
                              <Donut value={details.completion} size={110} label="Completion" color="var(--accent)" />
                            </div>

                            <div className="mini">
                              <div className="mini__box hist-box">
                                <div className="muted small">Students per score bucket</div>
                                <BucketBar hist={details.scoreHistogram || []} />
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>

            {/* ===========================================================
                 PER-USER ANALYTICS
                 =========================================================== */}
            <section className="sheet">
              <div className="toolbar">
                <h3 className="toolbar-title">Per-User Analytics</h3>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="input" placeholder="Search by name…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} style={{ width: 260 }} />
                  <span className="muted small">{students.length} shown</span>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="empty muted">No students registered.</div>
              ) : (
                <div className="user-list">

                  {students.map((u) => {
                    const d = studentDetails[u._id] || null;
                    const badge = d && clamp01(d.participationRate) >= 0.8 ? <span className="badge">High participation</span> : null;

                    return (
                      <div key={u._id} className="card user-row">
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div className="quiz-title">{u.name}</div>
                            <div className="small muted">ID: {String(u._id).slice(-6)}</div>
                          </div>
                          <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            {badge}
                            <button className="btn secondary" onClick={() => toggleStudentDetails(u._id)}>
                              {d ? "Hide details" : "View details"}
                            </button>

                          </div>
                        </div>

                        {d && (
                          <div className="panel" style={{ marginTop: 10 }}>
                            <div className="panel-title">Summary</div>
                            <div className="mini-kpis">
                              <div className="mini">
                                <Donut value={d.avgMark} size={110} label="Avg Mark" color="var(--accent)" />
                              </div>
                              <div className="mini">
                                <Donut value={d.participationRate} size={110} label="Participation" color="var(--accent2)" />
                              </div>
                              <div className="mini">
                                <div className="mini__box">
                                  <div className="muted small">Progress</div>
                                  <div className="progress">
                                    <div className="progress__bar">
                                      <div className="progress__fill" style={{ width: `${clamp01(d.participationRate) * 100}%` }} />
                                    </div>
                                    <div className="small">{d.doneCount}/{d.totalQuizzes} quizzes</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="panel" style={{ marginTop: 10 }}>
                              <div className="panel-title">Marks per Quiz</div>
                              {(d.perQuiz || []).length === 0 ? (
                                <div className="small muted">No attempts yet</div>
                              ) : (
                                <table className="table small">
                                  <thead>
                                    <tr>
                                      <th>Quiz</th>
                                      <th className="center">Mark</th>
                                      <th className="center">Correct</th>
                                      <th className="center">Answered</th>
                                      <th className="center">Questions</th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {d.perQuiz.map((q) => (
                                      <tr key={q.quizId}>
                                        <td className="ellipsis">{q.title}</td>
                                        <td className="center"><b>{pctTxt(q.percent)}</b></td>
                                        <td className="center">{q.correct}</td>
                                        <td className="center">{q.answered ?? q.total}</td> {/* fallback if API doesn't send answered */}
                                        <td className="center">{q.total}</td>
                                      </tr>
                                    ))}
                                  </tbody>

                                </table>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
