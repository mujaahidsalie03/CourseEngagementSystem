// /src/realtime/sessionClient.js
import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (!socket) {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    socket = io(base, { withCredentials: true });
    window.socket = socket; // for debug / direct emits
  }
  return socket;
}


// connectSession(sessionId, onEvent)
// Forwards server events verbatim and also emits a synthesized `patch`
// so existing screens that rely on patch-merging keep working.

// onEvent({ type, data })
//   types we forward: 'snapshot','quiz_started','next_question',
//                     'quiz_paused','quiz_resumed','quiz_ended',
//                     'answers_update','new_response',
//                     'participant_joined','participant_left','patch'

export function connectSession(sessionId, onEvent) {
  const s = getSocket();

  // join the session room
  s.emit("joinSessionRoom", { sessionId });

  const fwd = (type) => (payload = {}) => onEvent?.({ type, data: payload });
  const patch = (data = {}) => onEvent?.({ type: "patch", data });

  // helpers to build minimal patch + carry timing if present
  const timingPick = (p = {}) => {
    const out = {};
    for (const k of [
      "serverNow",
      "questionStartedAt",
      "timeLimit",
      "questionEndsAt",
      "remainingSeconds",
    ]) {
      if (p[k] != null) out[k] = p[k];
    }
    return out;
  };

  const onSnapshot = (p = {}) => {
    // snapshot already has status/currentIndex; forward only
    fwd("snapshot")(p);
  };

  const onQuizStarted = (p = {}) => {
    fwd("quiz_started")(p);
    patch({
      status: "active",
      currentIndex: typeof p.questionIndex === "number" ? p.questionIndex : 0,
      ...timingPick(p),
    });
  };

  const onNextQuestion = (p = {}) => {
    fwd("next_question")(p);
    patch({
      status: "active",
      currentIndex:
        typeof p.questionIndex === "number" ? p.questionIndex : undefined,
      ...timingPick(p),
    });
  };

  const onQuizPaused = (p = {}) => {
    fwd("quiz_paused")(p);
    patch({ status: "paused", ...timingPick(p) });
  };

  const onQuizResumed = (p = {}) => {
    fwd("quiz_resumed")(p);
    patch({ status: "active", ...timingPick(p) });
  };

  const onQuizEnded = (p = {}) => {
    fwd("quiz_ended")(p);
    patch({ status: "completed" });
  };

  const onAnswersUpdate  = fwd("answers_update");
  const onNewResponse    = fwd("new_response");
  const onJoined         = (p = {}) => { fwd("participant_joined")(p); patch({}); };
  const onLeft           = (p = {}) => { fwd("participant_left")(p);  patch({}); };

  // wire listeners
  s.on("snapshot",           onSnapshot);
  s.on("quiz_started",       onQuizStarted);
  s.on("next_question",      onNextQuestion);
  s.on("quiz_paused",        onQuizPaused);
  s.on("quiz_resumed",       onQuizResumed);
  s.on("quiz_ended",         onQuizEnded);
  s.on("answers_update",     onAnswersUpdate);
  s.on("new_response",       onNewResponse);
  s.on("participant_joined", onJoined);
  s.on("participant_left",   onLeft);

  // unsubscribe
  return () => {
    s.off("snapshot",           onSnapshot);
    s.off("quiz_started",       onQuizStarted);
    s.off("next_question",      onNextQuestion);
    s.off("quiz_paused",        onQuizPaused);
    s.off("quiz_resumed",       onQuizResumed);
    s.off("quiz_ended",         onQuizEnded);
    s.off("answers_update",     onAnswersUpdate);
    s.off("new_response",       onNewResponse);
    s.off("participant_joined", onJoined);
    s.off("participant_left",   onLeft);
  };
}
