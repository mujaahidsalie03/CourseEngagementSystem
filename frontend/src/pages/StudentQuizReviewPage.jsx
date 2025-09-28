import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import Card from "../components/Card.jsx";
import { getCourse } from "../api/appApi.js";
import { getMyQuizReview } from "../api/appApi.js";
import { pickVisual, visualKeyFromCourse } from "../utils/visual.js";

// helpers to present types consistently
const titleize = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const qType = (q) => String(q?.questionType || q?.type || "").toLowerCase().replaceAll("-", "_");

// Build a readable prompt for FIB like Lecturer page
const fibPrompt = (q) => {
  const tmpl = q?.template || q?.sentence || null;
  if (tmpl) {
    return String(tmpl)
      .replace(/\{\}/g, "____")
      .replace(/\{\{\d+\}\}/g, "____")
      .replace(/\{([^}]+)\}/g, "____");
  }
  return q?.questionText || q?.prompt || "Question";
};

export default function StudentQuizReviewPage() {
  const { courseId, quizId } = useParams();
  const { state } = useLocation();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [data, setData] = useState(null); // { quiz, review: [...] }

  useEffect(() => {
    (async () => {
      try {
        const [c, r] = await Promise.all([
          getCourse(courseId),
          getMyQuizReview(quizId),
        ]);
        setCourse(c || null);
        setData(r || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId, quizId]);

  const vis = useMemo(() => {
    if (state?.visual) return state.visual;
    return pickVisual(visualKeyFromCourse(course || { _id: courseId }));
  }, [courseId, course, state?.visual]);

  const cssVars = { "--accent": vis.a, "--accent2": vis.b };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container"><div className="card"><Spinner /></div></div>
      </>
    );
  }

  if (!data?.quiz) {
    return (
      <>
        <Header />
        <div className="container">
          <div className="card">Review not available.</div>
        </div>
      </>
    );
  }

  const { quiz, review = [] } = data;

  return (
    <>
      <Header />
      <div className="container" style={cssVars}>
        <div className="crumbs">
          <Link to="/s/courses">Courses</Link>
          <span>›</span>
          <Link to={`/s/courses/${courseId}`}>Course Quizzes Page</Link>
          <span>›</span>
          <span>{quiz.title || "Quiz"}</span>
        </div>

        <section className="course-hero colored" style={{ marginBottom: 18 }}>
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>{vis.emoji}</div>
            <div>
              <h1 className="course-title" style={{ margin: 0 }}>
                {quiz.title || "Quiz Review"}
              </h1>
              <div className="meta">
                <span className="chip accent">Your Answers</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid--one">
          {review.map((row, i) => {
            const t = qType(row.question);
            const prompt = t === "fill_in_the_blank" || t === "fill_blank"
              ? fibPrompt(row.question)
              : (row.question?.questionText || row.question?.prompt || "Question");

            const showAnswerList = t === "mcq" || t === "poll";
            const correctLabels =
              t === "mcq"
                ? (row.question.answers || [])
                    .filter(a => a.isCorrect)
                    .map(a => a.answerText)
                : [];

            // student answer as display string
            let myAnswerDisplay = "";
            if (Array.isArray(row.myAnswer)) {
              myAnswerDisplay = row.myAnswer.join(" | ");
            } else {
              myAnswerDisplay = String(row.myAnswer ?? "");
            }

            return (
              <Card key={i} title={`Q${i + 1} • ${titleize(t.replaceAll("_"," "))}`}>
                <h3 className="q-prompt" style={{ marginTop: 0 }}>{prompt}</h3>

                {/* MCQ/Poll options (read-only, highlight selected & correct) */}
                {showAnswerList && (
                  <div style={{ marginTop: 8 }}>
                    {(row.question.answers || []).map((opt, idx) => {
                      const label = String(opt.answerText || "");
                      const isSel = label === myAnswerDisplay;
                      const isOk = !!opt.isCorrect;
                      return (
                        <div
                          key={idx}
                          className="row"
                          style={{
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid var(--ring)",
                            background: isSel
                              ? (isOk ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)")
                              : "#fff",
                            marginBottom: 6,
                          }}
                        >
                          <span
                            className="small chip"
                            style={{
                              background: isOk ? "rgba(34,197,94,0.15)" : "rgba(0,0,0,0.05)",
                              border: "none"
                            }}
                          >
                            {isOk ? "Correct" : "Option"}
                          </span>
                          <span>{label}</span>
                          {isSel && <span className="chip" style={{ marginLeft: "auto" }}>You chose</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Your answer (all typdesss) */}
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <span className="chip">Your answer</span>
                  <span className="small">
                    {myAnswerDisplay ? myAnswerDisplay : <i className="muted">No response</i>}
                  </span>
                </div>

                {/* Correct answers for MCQ & FIB */}
                {(t === "mcq" || t === "fill_in_the_blank" || t === "fill_blank") && (
                  <div className="row" style={{ gap: 10, marginTop: 8 }}>
                    <span className="chip accent">Correct</span>
                    <div className="small">
                      {t === "mcq" ? (
                        correctLabels.length
                          ? correctLabels.join(" | ")
                          : <i className="muted">—</i>
                      ) : (
                        <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
                          {(row.expectedBlanks || []).map((alts, bi) => (
                            <li key={bi}>Blank {bi + 1}: {(alts || []).join(" or ")}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}

                {/* Points */}
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <span className="chip">Points</span>
                  <b className="small">{row.pointsEarned ?? 0}</b>
                  <span className="small muted">/ {row.maxPointsPossible ?? row.question?.points ?? 0}</span>
                  {row.isCorrect != null && (
                    <span className={`chip ${row.isCorrect ? "" : "secondary"}`} style={{ marginLeft: 8 }}>
                      {row.isCorrect ? "Correct ✅" : "Incorrect ❌"}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
