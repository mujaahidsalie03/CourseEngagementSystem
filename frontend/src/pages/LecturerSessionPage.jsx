import Header from "../components/Header.jsx";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import WordCloud from "../components/WordCloud.jsx";
import LiveBarChart from "../components/LiveBarChart.jsx";
import QuestionPlayer from "../components/QuestionPlayer.jsx";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import {
  getQuiz,
  getSession,
  nextQuestion as apiNextQuestion,
  pauseSession as apiPause,
  resumeSession as apiResume,
  endSession,
  getParticipants, // <-- presence snapshot
} from "../api/appApi";

import { connectSession } from "../realtime/sessionClient";

/* utils */
const titleize = (s = "") => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const getAnswerText = (a) => a?.text ?? a?.answerText ?? String(a ?? "");
const getPrompt = (q) => q?.prompt ?? q?.questionText ?? q?.text ?? "Question";
// Build a readable prompt for Fill-in-the-Blank
const fibPrompt = (q) => {
  const tmpl = q?.template || q?.sentence || null;
  if (tmpl) {
    return String(tmpl)
      .replace(/\{\}/g, "____")
      .replace(/\{\{\d+\}\}/g, "____")
      .replace(/\[blank\]/gi, "____");
  }

  const parts = q?.parts || q?.segments || q?.chunks || q?.textParts || q?.tokens || null;
  if (Array.isArray(parts)) {
    return parts.map((p) => (typeof p === "string" ? p : "____")).join("");
  }

  return getPrompt(q);
};

// normalize
const qType = (q) => String(q?.type ?? q?.questionType ?? "").toLowerCase();
const qIdOf = (q, quiz) =>
  String(q?.id ?? q?._id ?? (quiz?._id != null && q?.index != null ? `${quiz._id}:${q.index}` : ""));

// prefer server timing if present
const pickRemaining = (snap) => {
  const now = Date.now();
  if (typeof snap?.remainingSeconds === "number")
    return Math.max(0, Math.round(snap.remainingSeconds));
  if (typeof snap?.questionEndsAt === "number")
    return Math.max(0, Math.round((snap.questionEndsAt - now) / 1000));
  return null;
};

export default function LecturerSessionPage() {
  const { sessionId } = useParams();
  const { state } = useLocation(); // expects { visual?, course? } from navigate

  const [snap, setSnap] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [tab, setTab] = useState("waiting"); // waiting | live | student
  const [copied, setCopied] = useState(false);
  // Clears local distribution for a question (by id and by index key)
  const resetDistFor = (qi) => {
    setSnap(prev => {
      if (!quiz || qi == null || qi < 0) return prev;
      const q = quiz.questions[qi];
      const byId = String(q?._id ?? "");
      const byIdx = `idx:${qi}`;
      const answers = { ...(prev?.answers || {}) };
      answers[byId] = {};
      answers[byIdx] = {};
      return { ...(prev || {}), answers };
    });
  };
  useEffect(() => {
    if (quiz && typeof snap?.currentIndex === "number") {
      resetDistFor(snap.currentIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?._id, snap?.currentIndex]);
  // countdown
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef(null);
  const autoAdvanceFired = useRef(false);
  const [showModel, setShowModel] = useState(false);

  const vis = state?.visual ?? { a: "#B8C6FF", b: "#A78BFA", emoji: "⚙️" };
  const cssVars = { "--accent": vis.a, "--accent2": vis.b };

  /* === initial fetch === */
  useEffect(() => {
    (async () => {
      const s = await getSession(sessionId);
      setSnap(s);
      if (s?.quizId) setQuiz(await getQuiz(s.quizId));

      // initial presence snapshot
      try {
        const list = await getParticipants(sessionId);
        setSnap((prev) => ({
          ...(prev || {}),
          participants: Array.isArray(list) ? list : [],
        }));
      } catch {
        // ignore; will live-update via socket
      }
    })();
  }, [sessionId]);

  const stopTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const startTick = () => {
    stopTick();
    tickRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          stopTick();
          if (!autoAdvanceFired.current) {
            autoAdvanceFired.current = true;
            setTimeout(() => {            // slightly longer grace to let autosubmits land
              handleNextQuestion();
            }, 1500);
          }
          return 0;
        }
        return next;
      });
    }, 1000);
  };

  /* === live socket + presence (lecturer does NOT add self) === */
  useEffect(() => {
    // Turn [{_id,count}] or null into {key: count}
    const toObj = (dist) => {
      if (!dist) return {};
      if (Array.isArray(dist)) {
        const obj = {};
        for (const row of dist) {
          const k = row && row._id != null ? String(row._id) : "";
          const c = Number(row?.count || 0);
          if (k) obj[k] = (obj[k] || 0) + c;
        }
        return obj;
      }
      return dist; // already an object map
    };

    const off = connectSession(sessionId, (evt) => {
      const data = evt?.data || {};
      // If we just started or moved to a new question, clear local charts immediately.
      if (evt.type === "quiz_started" || evt.type === "next_question") {
        const qi = typeof data.questionIndex === "number"
          ? data.questionIndex
          : ((snap?.currentIndex ?? -1) + 1);
        resetDistFor(qi);
      }
      if (evt.type === "snapshot") {
        setSnap((prev) => ({ ...(prev || {}), ...(evt.data || {}) }));
        return;
      }
      setSnap((prev) => ({ ...(prev || {}), ...(evt.data || {}) }));

      // whenever timing fields arrive, seed local countdown
      if (
        typeof data.remainingSeconds === "number" ||
        typeof data.questionEndsAt === "number"
      ) {
        const remaining =
          typeof data.remainingSeconds === "number"
            ? Math.max(0, Math.round(data.remainingSeconds))
            : Math.max(0, Math.round((data.questionEndsAt - Date.now()) / 1000));
        setSecondsLeft(remaining);

        const status = data.status ?? (evt.type === "quiz_resumed" ? "active" : snap?.status);
        if (status === "active") {
          stopTick();
          startTick();
        }
      }

      if (evt?.data?.status === "active" || typeof evt?.data?.currentIndex === "number") {
        setTab("live");
      }
    });

    // LIVE answer distribution updates
    const onAnswersUpdate = ({ questionId, questionIndex, distribution }) => {
      setSnap(prev => {
        const prevAns = prev?.answers || {};
        const next = { ...prevAns };
        if (questionId) next[questionId] = distribution || {};
        if (typeof questionIndex === "number") next[`idx:${questionIndex}`] = distribution || {};
        return { ...(prev || {}), answers: next };
      });
    };

    const onNewResponse = ({ questionIndex, selected }) => {
      setSnap(prev => {
        if (prev?.currentIndex !== questionIndex) return prev;
        const cq = quiz?.questions?.[questionIndex];
        if (!cq) return prev;

        const qKeyById = String(cq._id ?? "");
        const qKeyByIdx = `idx:${questionIndex}`;
        const answersMap = { ...(prev?.answers || {}) };
        const current = answersMap[qKeyById] || answersMap[qKeyByIdx] || {};
        const nextDist = { ...current };

        const kind = qType(cq);

        if (kind === "mcq" || kind === "poll") {
          const labels = (cq.answers || []).map(a => String(a?.answerText ?? a?.text ?? ""));
          const ids = (cq.answers || []).map(a => String(a?._id ?? ""));
          if (Array.isArray(selected)) return prev;
          const sel = String(selected ?? "");
          if (!sel.trim()) return prev; // ✅ ignore empty
          const asNum = Number.isNaN(Number(sel)) ? null : Number(sel);

          let key = null;
          if (asNum != null && asNum >= 0 && asNum < labels.length) key = labels[asNum];
          else if (ids.includes(sel)) key = labels[ids.indexOf(sel)];
          else if (labels.includes(sel)) key = sel;

          if (!key) return prev;
          nextDist[key] = Number(nextDist[key] || 0) + 1;
        } else if (kind === "word_cloud" || kind === "pose_and_discuss") {
          const text = String(Array.isArray(selected) ? selected[0] : selected || "").trim();
          if (!text) return prev;
          nextDist[text] = Number(nextDist[text] || 0) + 1;
        } else {
          return prev;
        }

        answersMap[qKeyById] = nextDist;
        answersMap[qKeyByIdx] = nextDist;
        return { ...(prev || {}), answers: answersMap };
      });
    };

    if (window.socket) {
      window.socket.emit("joinSessionRoom", { sessionId });
      window.socket.on("answers_update", onAnswersUpdate);
      window.socket.on("new_response", onNewResponse);
      window.socket.on("participant_joined", (u) => {
        if (!u || !u.id) return;
        setSnap((prev) => {
          const prevList = prev?.participants || [];
          if (prevList.some((p) => p.id === u.id)) return prev;
          return { ...(prev || {}), participants: [...prevList, u] };
        });
      });

      window.socket.on("participant_left", (u) => {
        if (!u || !u.id) return;
        setSnap((prev) => {
          const prevList = prev?.participants || [];
          return { ...(prev || {}), participants: prevList.filter((p) => p.id !== u.id) };
        });
      });
    }
    window.socket.onAny((event, payload) => console.log("SOCKET_EVT", event, payload));

    return () => {
      if (window.socket) {
        window.socket.off("answers_update", onAnswersUpdate);
        window.socket.off("new_response", onNewResponse);
        window.socket.off("participant_joined");
        window.socket.off("participant_left");
      }
      off && off();
    };
  }, [sessionId, quiz]);

  // reload quiz if quizId changes
  useEffect(() => {
    (async () => {
      if (snap?.quizId) setQuiz(await getQuiz(snap.quizId));
    })();
  }, [snap?.quizId]);

  // computed question
  const currentQuestion = useMemo(() => {
    if (!quiz || (snap?.currentIndex ?? -1) < 0) return null;
    return quiz.questions[snap.currentIndex] || null;
  }, [quiz, snap?.currentIndex]);

  const previewQuestion = useMemo(() => {
    if (!quiz) return null;
    return snap?.status === "waiting" ? quiz.questions[0] : currentQuestion;
  }, [quiz, snap?.status, currentQuestion]);

  const headingText = useMemo(() => {
    if (!currentQuestion) return "";
    const t = qType(currentQuestion);
    if (t === "fill_blank" || t === "fill-in-the-blank" || t === "fill_in_the_blank") {
      return fibPrompt(currentQuestion);
    }
    return getPrompt(currentQuestion);
  }, [currentQuestion]);

  //imer reaction to **question changes** (prefer server timing) 
  useEffect(() => {
    autoAdvanceFired.current = false;

    if (!currentQuestion) {
      stopTick();
      setSecondsLeft(0);
      return;
    }

    const rem = pickRemaining(snap);
    const initial = rem != null ? rem : Number(currentQuestion?.timeLimit ?? 30);
    setSecondsLeft(initial);

    if (snap?.status === "active") {
      stopTick();
      startTick();
    } else {
      stopTick();
    }

    return stopTick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.currentIndex]);

  // React to **status** changes (pause/resume) without resetting remaining time,
  // but still honor server timing via the socket handler above (which seeds secondsLeft)
  useEffect(() => {
    if (!currentQuestion) return;
    if (snap?.status === "active") {
      if (!tickRef.current) startTick();
    } else {
      stopTick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.status, currentQuestion]);

  if (!snap) return <div className="container">Loading session…</div>;

  const liveEnabled = snap.status !== "waiting";
  const totalQs = quiz?.questions.length ?? 0;
  const code = snap.code || snap.sessionCode || "";

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { }
  };

  /* === controls === */
  const handlePause = async () => {
    if (snap?.status !== "active") return;
    await apiPause(sessionId);
    stopTick();
  };

  const handleResume = async () => {
    if (snap?.status !== "paused") return;
    await apiResume(sessionId);
  };

  const handleNextQuestion = async () => {
    if (!quiz) return;
    const next = (snap.currentIndex ?? -1) + 1;
    if (next < totalQs) {
      await apiNextQuestion(sessionId);
    }
  };

  // data for charts 
  const qId = qIdOf(currentQuestion, quiz);
  const idxKey = (snap?.currentIndex != null) ? `idx:${snap.currentIndex}` : null;

  const distRaw =
    (snap?.answers && (snap.answers[qId] || (idxKey ? snap.answers[idxKey] : undefined))) || {};

  const optionLabels = (currentQuestion?.answers || []).map(
    (a) => a?.text ?? a?.answerText ?? String(a ?? "")
  );

  const alignedCounts = Object.fromEntries(
    optionLabels.map((label, i) => {
      const ans = (currentQuestion?.answers || [])[i] || {};
      const id = String(ans?._id ?? "");
      // Stable across shuffles; label as safe fallback
      const tryKeys = [id, label];
      let val = 0;
      for (const k of tryKeys) {
        if (k && Object.prototype.hasOwnProperty.call(distRaw || {}, k)) {
          const n = Number(distRaw[k]);
          if (!Number.isNaN(n)) { val = n; break; }
        }
      }
      return [label, val];
    })
  );

  const totalVotes = Object.values(alignedCounts).reduce((a, b) => a + b, 0);

  const fmt = (n) =>
    `${Math.floor(n / 60).toString().padStart(2, "0")}:${Math.floor(n % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <Header />
      <div className="container session-page" style={cssVars}>
        {/* ===== Hero ===== */}
        <section className="course-hero colored session-hero-pro">
          <div className="hero-split">
            <div className="hero-left tight">
              <div className="hero-emoji" aria-hidden>
                {vis.emoji}
              </div>
              <h1 className="hero-title" style={{ margin: 0 }}>
                Control Room
              </h1>
              <span
                className={`status-pill status-${snap.status}`}
                style={{ marginLeft: 10 }}
              >
                {titleize(snap.status)}
              </span>
              {currentQuestion && snap.status !== "waiting" && (
                <span className="timer-pill" title="Time remaining">
                  ⏱ {fmt(secondsLeft)}
                </span>
              )}
            </div>

            <div className="hero-right-right">
              <span className="code-chip">
                Code: <b>{code}</b>
                <button
                  type="button"
                  className={`copy-btn ${copied ? "copied" : ""}`}
                  aria-label="Copy session code"
                  title={copied ? "Copied!" : "Copy"}
                  onClick={doCopy}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </section>

        {/* ===== Tabs ===== */}
        <div className="seg" style={{ marginBottom: 12 }}>
          <button
            className={`seg-btn ${tab === "waiting" ? "active" : ""}`}
            onClick={() => setTab("waiting")}
            type="button"
          >
            Waiting Room
          </button>
          <button
            className={`seg-btn ${liveEnabled ? "" : "disabled"} ${tab === "live" ? "active" : ""}`}
            onClick={() => liveEnabled && setTab("live")}
            type="button"
            disabled={!liveEnabled}
          >
            Live View
          </button>
          <button
            className={`seg-btn ${tab === "student" ? "active" : ""}`}
            onClick={() => setTab("student")}
            type="button"
          >
            Student View
          </button>
        </div>

        {/* ===== Waiting ===== */}
        {tab === "waiting" && (
          <div className="grid">
            <Card title="Participants">
              <div className="small" style={{ marginBottom: 8 }}>
                {snap.participants?.length || 0} joined
              </div>
              <hr className="hr" />
              {(!snap.participants || snap.participants.length === 0) ? (
                <div className="small muted">
                  No one yet — share the session code.
                </div>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {snap.participants.map((p) => (
                    <span key={p.id} className="pill">
                      <span className="dot" aria-hidden /> {p.name || "Student"}
                    </span>
                  ))}
                </div>
              )}
              <div className="hr" />
              <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
                {snap.status === "waiting" && (
                  <Button
                    onClick={() =>
                      window?.socket?.emit?.("start_quiz", {
                        sessionId,
                        quizId: quiz?._id,
                      })
                    }
                  >
                    Start Quiz
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ===== Live ===== */}
        {tab === "live" && (
          <>
            <div className="row" style={{ gap: 10, marginBottom: 12 }}>
              <Button
                variant="secondary"
                onClick={handlePause}
                disabled={snap?.status !== "active"}
                title={snap?.status !== "active" ? "Only available while active" : ""}
              >
                Pause
              </Button>
              <Button
                variant="secondary"
                onClick={handleResume}
                disabled={snap?.status !== "paused"}
                title={snap?.status !== "paused" ? "Only available after pausing" : ""}
              >
                Resume
              </Button>
              <Button variant="secondary" onClick={handleNextQuestion}>
                Next Question
              </Button>
              <Button onClick={() => endSession(sessionId)}>End Session</Button>
            </div>

            <div className="live-grid">
              {/* Left: participants */}
              <Card title="Participants">
                <div className="small">
                  {(snap.participants || []).length} active
                </div>
                <div className="hr"></div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {(snap.participants || []).map((p) => (
                    <span key={p.id} className="pill">
                      <span className="dot" aria-hidden /> {p.name || "Student"}
                    </span>
                  ))}
                </div>
              </Card>

              {/* Right: question + results */}
              <Card
                title={
                  currentQuestion ? `Q${(snap.currentIndex ?? 0) + 1}` : "Session"
                }
              >
                {!currentQuestion && (
                  <div className="small">No question selected yet.</div>
                )}

                {currentQuestion && (
                  <>
                    <h2 className="q-prompt">{headingText}</h2>
                    {(() => {
                      const imgSrc =
                        currentQuestion?.image?.url || currentQuestion?.image?.dataUrl;
                      if (!imgSrc) return null;
                      return (
                        <div style={{ margin: "10px 0 14px" }}>
                          <img
                            src={imgSrc}
                            alt={currentQuestion?.imageAlt || "question image"}
                            style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid var(--ring)" }}
                          />
                          {currentQuestion?.imageAlt && (
                            <div className="small muted" style={{ marginTop: 6 }}>
                              {currentQuestion.imageAlt}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {["mcq", "poll", "multiple_choice", "multiple-choice", "single_choice"]
                      .includes(qType(currentQuestion)) && (
                        <LiveBarChart
                          labels={optionLabels}
                          counts={alignedCounts}
                          total={totalVotes}
                        />
                      )}

                    {qType(currentQuestion) === "word_cloud" && (
                      <div style={{ marginTop: 6 }}>
                        <WordCloud
                          height={380}
                          data={Object.entries(distRaw).map(([text, count]) => ({
                            text: String(text),
                            count: Number(count) || 0,
                          }))}
                        />
                      </div>
                    )}

                    {qType(currentQuestion) === "pose_and_discuss" && (
                      <div className="pad" style={{ marginTop: 6 }}>
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div className="small muted">
                            {Object.values(distRaw).reduce((a, b) => a + (Number(b) || 0), 0)} submissions
                          </div>
                          {currentQuestion?.modelAnswer && (
                            <Button
                              variant="secondary"
                              onClick={() => setShowModel((v) => !v)}
                            >
                              {showModel ? "Hide key points" : "Reveal key points"}
                            </Button>
                          )}
                        </div>

                        {showModel && currentQuestion?.modelAnswer && (
                          <div
                            className="model-answer"
                            style={{
                              whiteSpace: "pre-wrap",
                              background: "#fff",
                              border: "1px solid var(--ring)",
                              borderRadius: 12,
                              padding: 14,
                              lineHeight: 1.5,
                            }}
                          >
                            {Array.isArray(currentQuestion.modelAnswer)
                              ? currentQuestion.modelAnswer.map((line, i) => (
                                <div key={i} style={{ marginBottom: 6 }}>• {line}</div>
                              ))
                              : String(currentQuestion.modelAnswer)}
                          </div>
                        )}
                      </div>
                    )}

                    {String(currentQuestion?.type).toLowerCase() === "fill_blank" && (
                      <>
                        <div className="small">Expected answers</div>
                        <ol className="qr-blanks">
                          {(currentQuestion.blanks || []).map((alts, i) => (
                            <li key={i}>
                              <b>Blank {i + 1}:</b> {(alts || []).join(" or ")}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </>
                )}
              </Card>
            </div>
          </>
        )}

        {/* ===== Student (preview) ===== */}
        {tab === "student" && (
          <div className="grid grid--one">
            <Card>
              {!previewQuestion ? (
                <div className="small muted">Quiz not loaded.</div>
              ) : (
                <div className="student-preview student-preview--wide">
                  <div className="card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                      <h3 style={{ margin: "0 0 10px" }}>{getPrompt(previewQuestion)}</h3>
                      <span className="small muted">
                        {qType(previewQuestion).replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <QuestionPlayer question={previewQuestion} value={null} onChange={() => { }} disabled />

                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <button className="btn secondary" disabled>Submit (preview)</button>
                      <span className="chip">
                        {`Question ${(snap?.currentIndex ?? 0) + 1} of ${totalQs || 0}`}
                      </span>
                      {snap?.status === "paused" && <span className="chip">Paused by lecturer</span>}
                    </div>
                  </div>

                  <div className="small muted" style={{ marginTop: 8 }}>
                    Read-only preview. (Students see this on their devices.)
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>

      {/* small styles for name pills */}
      <style>{`
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          font-size: 14px;
        }
        .pill .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent, #60a5fa);
          display: inline-block;
        }
      `}</style>
    </>
  );
}
