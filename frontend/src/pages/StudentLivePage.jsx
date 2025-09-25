import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import Spinner from "../components/Spinner.jsx";
import QuestionPlayer from "../components/QuestionPlayer.jsx";
import { connectSession } from "../realtime/sessionClient";
import { getSession, getQuiz, submitAnswer } from "../api/appApi";

/* ---------- helpers ---------- */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmt = (s) =>
  s == null
    ? "--:--"
    : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
        Math.floor(s % 60)
      ).padStart(2, "0")}`;

const qType = (q) =>
  String(q?.type || q?.questionType || "")
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const getPrompt = (q) => q?.prompt ?? q?.questionText ?? q?.text ?? "Question";

/** Memoized timer pill so ticks don't re-render the question subtree */
const TimerPill = memo(function TimerPill({ seconds, className = "", style }) {
  return (
    <span className={`chip accent timer-pill ${className}`} style={style}>
      Time left: <b className="tabular">{fmt(seconds)}</b>
    </span>
  );
});

const getAnswers = (q) =>
  Array.isArray(q?.answers)
    ? q.answers.map((a, i) => ({
        id: a.id ?? `opt_${i}`,
        text: a.text ?? a.answerText ?? String(a ?? ""),
        correct: !!(a.correct ?? a.isCorrect),
      }))
    : [];

const getTimeLimit = (q) =>
  Number(q?.timeLimit ?? q?.settings?.timeLimit ?? q?.duration ?? 30) || 30;

/* =================================================================== */

export default function StudentLivePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [value, setValue] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // timer state
  const [secondsLeft, setSecondsLeft] = useState(null);
  const tickRef = useRef(null);
  const startedAtRef = useRef(null); // client-clock ms when this question started
  const autosubmittedRef = useRef(false);
  const seededRef = useRef(false);

  // server-time sync
  const serverOffsetRef = useRef(0); // serverNow - Date.now()
  const qStartedAtRef = useRef(null); // server ms
  const qTimeLimitRef = useRef(null); // seconds

  const vis = useMemo(() => {
    const a = snap?.visual?.a || "#B8C6FF";
    const b = snap?.visual?.b || "#A78BFA";
    return { a, b };
  }, [snap?.visual]);
  const cssVars = { "--accent": vis.a, "--accent2": vis.b };

  const currentIndex =
    snap?.currentIndex ?? (snap?.status === "active" ? 0 : -1);

  const currentQ =
    quiz && currentIndex >= 0 && currentIndex < (quiz?.questions?.length ?? 0)
      ? quiz.questions[currentIndex]
      : null;

  /* ---------- derived values for stability ---------- */
  const qKind = useMemo(() => qType(currentQ), [currentQ]);
  const isChoice = qKind === "mcq" || qKind === "poll";
  const readyForChoices = useMemo(
    () => !isChoice || getAnswers(currentQ).length > 0,
    [isChoice, currentQ]
  );
  // stable key used in deps & as React key
  const qKey = currentQ?.id ?? currentIndex;

  /* ---------- tick helpers ---------- */
  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTick = useCallback(
    (fromSeconds) => {
      stopTick();
      const dur = getTimeLimit(currentQ);
      startedAtRef.current = Date.now() - (dur - fromSeconds) * 1000;
      tickRef.current = setInterval(() => {
        setSecondsLeft((prev) => clamp(prev - 1, 0, 10_000));
      }, 1000);
    },
    [currentQ, stopTick]
  );

  /* ---------- initial fetch ---------- */
  useEffect(() => {
    (async () => {
      try {
        const s = await getSession(sessionId);
        setSnap(s);
        if (s?.quizId) {
          const q = await getQuiz(s.quizId);
          setQuiz(q);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  /* ---------- submit (wrapped) ---------- */
  const handleSubmit = useCallback(
    async (isAuto = false) => {
      if (!currentQ || currentIndex < 0) return;
      if (submitted && !isAuto) return;
      if (isSubmitting) return;

      setIsSubmitting(true);

      const elapsed = startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0;

      const type = qType(currentQ);
      const ans = getAnswers(currentQ);
      let answerForServer = "";

      if (type === "mcq" || type === "poll") {
        const allowMultiple =
          !!currentQ?.settings?.allowMultiple && type === "poll";
        const ensureArray = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
        const selectedIds = ensureArray(value);
        const selectedTexts = selectedIds
          .map((id) => ans.find((o) => String(o.id) === String(id))?.text)
          .filter(Boolean);

        answerForServer = allowMultiple
          ? selectedTexts.join(" | ")
          : selectedTexts[0] ?? "";
      } else if (type === "word_cloud" || type === "pose_and_discuss") {
        answerForServer = String(value ?? "").trim();
      } else if (type === "fill_blank" || type === "fill_in_the_blank") {
        const blanks = Array.isArray(value)
          ? value.map((s) => String(s ?? "").trim())
          : [];
        answerForServer = { type: "fill_in_the_blank", blanks };
      } else {
        answerForServer =
          typeof value === "string" ? value : (value && value.text) || "";
      }

      try {
        await submitAnswer(sessionId, currentIndex, answerForServer, elapsed);
        setSubmitted(true);
      } catch (err) {
        console.error("submitAnswer failed", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentQ, currentIndex, isSubmitting, sessionId, submitted, value]
  );

  // keep a ref to the latest submit fn
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  /* ---------- live socket ---------- */
  useEffect(() => {
    const off = connectSession(sessionId, async (evt) => {
      const d = evt?.data || {};

      // time sync from server if present
      if (typeof d.serverNow === "number") {
        serverOffsetRef.current = d.serverNow - Date.now();
      }
      if (typeof d.questionStartedAt === "number") {
        qStartedAtRef.current = d.questionStartedAt;
      }
      if (typeof d.timeLimit === "number") {
        qTimeLimitRef.current = d.timeLimit;
      }

      const seedFromEventTiming = () => {
        const dur = qTimeLimitRef.current ?? (currentQ ? getTimeLimit(currentQ) : 30);
        const serverNow = Date.now() + serverOffsetRef.current;

        const startedAtServer =
          (d.questionStartedAt ?? qStartedAtRef.current) ?? null;
        const endsAtServer =
          d.questionEndsAt ??
          (startedAtServer ? startedAtServer + dur * 1000 : null);

        const remaining =
          typeof d.remainingSeconds === "number"
            ? Math.max(0, Math.round(d.remainingSeconds))
            : endsAtServer
            ? Math.max(0, Math.round((endsAtServer - serverNow) / 1000))
            : dur;

        setSecondsLeft(remaining);
        startedAtRef.current = startedAtServer
          ? startedAtServer - serverOffsetRef.current
          : Date.now() - (dur - remaining) * 1000;
        seededRef.current = true;
        if ((snap?.status ?? d.status) === "active") startTick(remaining);
        else stopTick();
      };

      switch (evt?.type) {
        case "snapshot": {
          setSnap((p) => ({ ...(p || {}), ...(d || {}) }));
          seedFromEventTiming();
          return;
        }
        case "quiz_started": {
          setSnap((p) => ({
            ...(p || {}),
            status: "active",
            currentIndex:
              typeof d.questionIndex === "number" ? d.questionIndex : 0,
          }));
          seedFromEventTiming();
          return;
        }
        case "next_question": {
          try {
            if (!autosubmittedRef.current) {
              autosubmittedRef.current = true;
              await handleSubmitRef.current?.(true);
            }
          } catch {
          } finally {
            autosubmittedRef.current = false;
          }

          setSnap((p) => ({
            ...(p || {}),
            status: "active",
            currentIndex:
              typeof d.questionIndex === "number"
                ? d.questionIndex
                : (p?.currentIndex ?? 0) + 1,
          }));
          seedFromEventTiming();
          return;
        }
        case "quiz_paused": {
          setSnap((p) => ({ ...(p || {}), status: "paused" }));
          stopTick();
          return;
        }
        case "quiz_resumed": {
          setSnap((p) => ({ ...(p || {}), status: "active" }));
          seedFromEventTiming();
          return;
        }
        case "quiz_ended": {
          setSnap((p) => ({ ...(p || {}), status: "completed" }));
          return;
        }
        case "patch": {
          setSnap((p) => ({ ...(p || {}), ...(d || {}) }));
          return;
        }
        default: {
          // ignore
        }
      }
    });

    return () => off && off();
  }, [sessionId, startTick, stopTick, currentQ, snap?.status]);

  /* ---------- when the question changes, (re)seed the timer ---------- */
  useEffect(() => {
    autosubmittedRef.current = false;
    setSubmitted(false);
    setValue(null);
    seededRef.current = false;
    if (!currentQ) {
      stopTick();
      setSecondsLeft(0);
      return;
    }

    const dur = qTimeLimitRef.current ?? getTimeLimit(currentQ);
    const serverNow = Date.now() + serverOffsetRef.current;
    const startedAtServer =
      snap?.questionStartedAt != null ? snap.questionStartedAt : qStartedAtRef.current;
    const endsAtServer =
      snap?.questionEndsAt != null
        ? snap.questionEndsAt
        : startedAtServer
        ? startedAtServer + dur * 1000
        : null;

    const remaining =
      typeof snap?.remainingSeconds === "number"
        ? Math.max(0, Math.round(snap.remainingSeconds))
        : endsAtServer
        ? Math.max(0, Math.round((endsAtServer - serverNow) / 1000))
        : dur;

    setSecondsLeft(remaining);

    startedAtRef.current = startedAtServer
      ? startedAtServer - serverOffsetRef.current
      : Date.now() - (dur - remaining) * 1000;
    seededRef.current = true;

    if (snap?.status === "active") startTick(remaining);
    else stopTick();

    return stopTick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, quiz]);

  /* ---------- pause/resume reacts to status WITHOUT resetting remaining ---------- */
  useEffect(() => {
    if (!currentQ) return;
    if (snap?.status === "active") {
      if (!tickRef.current) startTick(secondsLeft);
    } else {
      stopTick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.status, currentQ]);

  /* ---------- blur any stray focused text input when a choice Q appears ---------- */
  useEffect(() => {
    if (!isChoice) return;
    const el = document.activeElement;
    if (
      el &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
    ) {
      el.blur();
    }
  }, [isChoice, qKey]);

  /* ---------- autosubmit when time hits zero ---------- */
  useEffect(() => {
    if (!currentQ) return;
    if (secondsLeft === 0 && seededRef.current && !autosubmittedRef.current) {
      autosubmittedRef.current = true;
      if (!submitted) handleSubmitRef.current?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  /* ---------- navigate on completion ---------- */
  useEffect(() => {
    if (snap?.status === "completed") {
      navigate(`/s/sessions/${sessionId}/done`, { replace: true });
    }
  }, [snap?.status, navigate, sessionId]);

  /* ---------- compute locked BEFORE memo ---------- */
  const locked =
    (snap?.status !== "active") || submitted || (secondsLeft ?? 0) <= 0 || isSubmitting;

  /* ---------- memoized QuestionPlayer element (prevents iOS jitter) ---------- */
  const qpEl = useMemo(
    () => (
      <QuestionPlayer
        key={qKey}
        question={currentQ}
        value={value}
        onChange={setValue}
        disabled={locked}
      />
    ),
    [qKey, value, locked,currentQ]
  );

  /* ---------- render ---------- */
  if (loading || !snap || !quiz) {
    return (
      <>
        <Header />
        <div className="container">
          <Spinner />
        </div>
      </>
    );
  }

  const total = quiz.questions.length;
  const qNum = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <>
      <Header />
      <div className="container" style={cssVars}>
        <section className="course-hero colored" style={{ marginBottom: 14 }}>
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>
              ⏱
            </div>
            <div>
              <h1 className="course-title" style={{ margin: 0 }}>
                {snap?.status === "paused" ? "Paused" : "Live Quiz"}
              </h1>
              <div className="meta">
                <span className="chip">
                  {qNum ? `Question ${qNum} of ${total}` : "Waiting…"}
                </span>
                <TimerPill seconds={secondsLeft} style={{ marginLeft: 8 }} />
              </div>
            </div>
          </div>
        </section>

        {!currentQ ? (
          <div className="card">
            <div className="muted">Waiting for the first question…</div>
          </div>
        ) : (
          <div className="card">
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "baseline" }}
            >
              <h2 style={{ margin: "0 0 10px" }}>{getPrompt(currentQ)}</h2>
              <span className="small muted">
                {qKind.replaceAll("_", " ").toUpperCase()}
              </span>
            </div>

            {readyForChoices ? (
              qpEl
            ) : (
              <div className="muted small">Loading options…</div>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {!submitted ? (
                <button
                  className="btn"
                  disabled={locked}
                  onClick={() => handleSubmitRef.current?.(false)}
                >
                  {isSubmitting ? "Submitting…" : "Submit"}
                </button>
              ) : (
                <span className="chip">Answer submitted ✅</span>
              )}
              {snap.status === "paused" && (
                <span className="chip">Paused by lecturer</span>
              )}
              {secondsLeft === 0 && <span className="chip">Time’s up</span>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
