// services/socketService.js
// Socket.IO service for live quiz sessions.
// - Manages room membership, authoritative per-question timing, and live updates
// - Bridges student submissions to persistence (Response model)
// - Emits distribution updates, scoreboards, and snapshots to keep clients in sync
const mongoose = require("mongoose");
const Response = require("../models/responseModel");
const QuizSession = require("../models/quizSessionModel");
const Quiz = require("../models/quizModel");

// Build a stable question id: prefer question._id; otherwise fall back to "quizId:index"
const keyFor = (quizId, idx, q) =>
  String(q?._id || `${String(quizId)}:${Number(idx)}`);


//   Authoritative timing per session (exported)
// TimingState = {
// questionStartedAt: number, // ms since epoch
//   timeLimit: number,         // seconds
 //   pausedAt: number|null,     // ms when paused (null if active)
 // pauseAccumMs: number       // total paused duration accumulated (ms)
 // }

const _sessionTiming = new Map(); // sessionId -> TimingState
// Read the current timing state for a session
const getTimingForSession = (sid) => _sessionTiming.get(String(sid)) || null;
// Set or replace the timing state for a session
const setTimingForSession = (sid, t) => _sessionTiming.set(String(sid), t);

// ompute derived timing fields for emits
const snapTimingForSession = (sid, nowMs = Date.now()) => {
  const t = getTimingForSession(sid);
  if (!t) return { questionEndsAt: null, remainingSeconds: null };
  // Accumulate paused time (if currently paused, include time since pausedAt)
  const pausedSoFar =
    t.pausedAt != null ? t.pauseAccumMs + (nowMs - t.pausedAt) : t.pauseAccumMs;
    // End = start + limit + all paused durations
  const questionEndsAt = t.questionStartedAt + t.timeLimit * 1000 + pausedSoFar;
   // Floor at 0 to avoid negative countdowns
  const remainingSeconds = Math.max(
    0,
    Math.round((questionEndsAt - nowMs) / 1000)
  );
  return {
    questionEndsAt,
    remainingSeconds,
    questionStartedAt: t.questionStartedAt,
    timeLimit: t.timeLimit,
  };
};

//Presence tracking (in-memory)
  // Map<sessionId, Map<userId, {id,name}>>

const presence = new Map();
const roomMap = (sid) => {
  const k = String(sid);
  if (!presence.has(k)) presence.set(k, new Map());
  return presence.get(k);
};

//// Return a shallow list of participants for a session (used by controllers too)
function getParticipantsForSession(sessionId) {
  const m = presence.get(String(sessionId));
  return m ? Array.from(m.values()) : [];
}


 //  Helpers (answer normalization for socket path)
  //Normalize incoming payloads into a canonical {answerText, blanksArray?}
   //matching the HTTP controller semantics for parity.
function normalizeIncomingAnswerForSocket(q, raw) {
  if (!q) return { answerText: "" };

  const t = String(q.questionType || "").toLowerCase();

  // MCQ / Poll: accept text, {selectedText}, {selectedTexts[]}, {text}, or {optionIndex}
  if (t === "mcq" || t === "poll") {
    if (typeof raw === "string") return { answerText: raw.trim() };
    if (raw && typeof raw === "object") {
      if (typeof raw.selectedText === "string")
        return { answerText: raw.selectedText.trim() };
      if (Array.isArray(raw.selectedTexts))
        return { answerText: raw.selectedTexts.join(" | ") };
      if (typeof raw.text === "string") return { answerText: raw.text.trim() };
      if (typeof raw.optionIndex === "number" && Array.isArray(q.answers)) {
        const a = q.answers[raw.optionIndex];
        return { answerText: a ? String(a.answerText || "").trim() : "" };
      }
    }
    return { answerText: "" };
  }

  // Word cloud / PAD / free text
  if (t === "word_cloud" || t === "pose_and_discuss" || t === "text") {
    if (typeof raw === "string") return { answerText: raw.trim() };
    if (raw && typeof raw === "object")
      return { answerText: String(raw.text || "").trim() };
    return { answerText: "" };
  }

  // Fill-in-the-blank: normalize into array and pipe-joined string
  if (t === "fill_in_the_blank") {
    if (Array.isArray(raw)) {
      const arr = raw.map((s) => String(s ?? "").trim());
      return { answerText: arr.join(" | "), blanksArray: arr };
    }
    if (raw && typeof raw === "object" && Array.isArray(raw.blanks)) {
      const arr = raw.blanks.map((s) => String(s ?? "").trim());
      return { answerText: arr.join(" | "), blanksArray: arr };
    }
    if (typeof raw === "string") {
      const arr = raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      return { answerText: arr.join(" | "), blanksArray: arr };
    }
     // Fallback: coerce to trimmed string
    return { answerText: "", blanksArray: [] };
  }

  return { answerText: String(raw ?? "").trim() };
}

 //  Socket Service
//Binds all event handlers and translates them into DB/state changes + emits.
class SocketService {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }
//Wire up all socket events on connection
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // --- Rooms / joining ---
      socket.on("join_session", (data) =>
        this.handleJoinSessionRoom(socket, data)
      );
      socket.on("joinSessionRoom", (data) =>
        this.handleJoinSessionRoom(socket, data)
      );

      // --- Lecturer controls via sockets (optional path)
      socket.on("start_quiz", (data) => this.handleStartQuiz(socket, data));
      socket.on("next_question", (data) =>
        this.handleNextQuestion(socket, data)
      );
      socket.on("pause_quiz", (data) => this.handlePauseQuiz(socket, data));
      socket.on("resume_quiz", (data) => this.handleResumeQuiz(socket, data));
      socket.on("end_quiz", (data) => this.handleEndQuiz(socket, data));

      // --- Student interactions ---
      socket.on("submit_answer", (data) =>
        this.handleSubmitAnswer(socket, data)
      );

      // --- Results and analytics ---
      socket.on("show_scoreboard", (data) =>
        this.handleShowScoreboard(socket, data)
      );
      socket.on("show_question_results", (data) =>
        this.handleShowQuestionResults(socket, data)
      );

      socket.on("disconnect", () => this.handleDisconnect(socket));
    });
  }

  // --- Room join handler used by both events above ---
  handleJoinSessionRoom(socket, { sessionId, user } = {}) {
    if (!sessionId) return;
    socket.join(`session:${sessionId}`);
    socket.sessionId = String(sessionId);

    if (user && (user.id || user._id)) {
      const uid = String(user.id || user._id);
      const name = user.name || "Student";
      socket.userId = uid;
      socket.userRole = socket.userRole || "student";
      const room = roomMap(sessionId);
      room.set(uid, { id: uid, name });
      this.io
        .to(`session:${sessionId}`)
        .emit("participant_joined", { id: uid, name });
    }
    console.log(`Socket ${socket.id} joined room session:${sessionId}`);

    // Send a one-off snapshot to THIS socket so late joiners sync timers
    (async () => {
      try {
        const session = await QuizSession.findById(sessionId).populate("quiz");
        if (!session || !session.quiz) return;

        const now = Date.now();
        const ts = snapTimingForSession(sessionId, now);

        const currentIndex =
          session.currentQuestionIndex ?? session.currentIndex ?? 0;
        const q = session.quiz.questions[currentIndex];

        socket.emit("snapshot", {
          status: session.status, // 'waiting' | 'active' | 'paused' | 'completed'
          currentIndex,
          serverNow: now,
          questionStartedAt: ts.questionStartedAt ?? null,
          timeLimit: Number(q?.timeLimit ?? ts.timeLimit ?? 60),
          questionEndsAt: ts.questionEndsAt,
          remainingSeconds: ts.remainingSeconds,
        });
      } catch {}
    })();
  }

  // --- Start quiz (socket path)
  async handleStartQuiz(socket, data) {
    try {
      const { sessionId, quizId } = data;

      const session = await QuizSession.findById(sessionId);
      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

       // Enforce allowed state transition (waiting -> active)
      await session.startSession();

      const quiz = await Quiz.findById(quizId);
      if (!quiz || quiz.questions.length === 0) {
        socket.emit("error", { message: "Quiz not found or has no questions" });
        return;
      }

      // Build student-safe first question (no isCorrect flags)
      const firstQuestion = this.prepareQuestionForStudents(
        quiz.questions[0],
        0,
        quiz._id
      );

      // Initialize authoritative timing state for Q0
      const startedAt = Date.now();
      setTimingForSession(sessionId, {
        questionStartedAt: startedAt,
        timeLimit: Number(firstQuestion.timeLimit ?? 60),
        pausedAt: null,
        pauseAccumMs: 0,
      });

      const now = Date.now();
      const ts = snapTimingForSession(sessionId, now);

      // Broadcast "quiz_started" with timer fields
      this.io.to(`session:${sessionId}`).emit("quiz_started", {
        question: firstQuestion,
        questionIndex: 0,
        totalQuestions: quiz.questions.length,
        serverNow: now,
        questionStartedAt: ts.questionStartedAt,
        timeLimit: ts.timeLimit,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

      //Reset per-question visuals and counters on start
      const qId = String(quiz.questions[0]?._id || `${String(quiz._id)}:0`);
      this.io.to(`session:${sessionId}`).emit("answers_update", {
        questionId: qId,
        questionIndex: 0,
        distribution: {},
      });
      this.io.to(`session:${sessionId}`).emit("new_response", {
        questionIndex: 0,
        responseCount: 0,
      });

      console.log(`Quiz started for session ${sessionId}`);
    } catch (error) {
      console.error("Start quiz error:", error);
      socket.emit("error", { message: "Failed to start quiz" });
    }
  }

  // --- Next question (socket path)
   // Advance to a specific question index (socket-initiated)
  async handleNextQuestion(socket, data) {
    try {
      const { sessionId, questionIndex } = data;

      const session = await QuizSession.findById(sessionId).populate("quiz");
      if (!session || !session.quiz) {
        socket.emit("error", { message: "Session or quiz not found" });
        return;
      }

      // Will throw if invalid index or wrong state; also touches lastActivityAt
      await session.advanceToQuestion(questionIndex);

      // If index is at/over the end, emit completion event
      if (questionIndex >= session.quiz.questions.length) {
        this.io.to(`session:${sessionId}`).emit("quiz_finished");
        return;
      }

      const question = this.prepareQuestionForStudents(
        session.quiz.questions[questionIndex],
        questionIndex,
        session.quiz._id
      );

      // Reset timing for the new question
      const startedAt = Date.now();
      setTimingForSession(sessionId, {
        questionStartedAt: startedAt,
        timeLimit: Number(question.timeLimit ?? 60),
        pausedAt: null,
        pauseAccumMs: 0,
      });

      const now = Date.now();
      const ts = snapTimingForSession(sessionId, now);

      this.io.to(`session:${sessionId}`).emit("next_question", {
        question,
        questionIndex,
        totalQuestions: session.quiz.questions.length,
        serverNow: now,
        questionStartedAt: ts.questionStartedAt,
        timeLimit: ts.timeLimit,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

      // Reset per-question visuals and counters when advancing
      const qId = String(
        session.quiz.questions[questionIndex]?._id ||
          `${String(session.quiz._id)}:${Number(questionIndex)}`
      );
      this.io.to(`session:${sessionId}`).emit("answers_update", {
        questionId: qId,
        questionIndex,
        distribution: {},
      });
      this.io.to(`session:${sessionId}`).emit("new_response", {
        questionIndex,
        responseCount: 0,
      });

      console.log(
        `Next question (${questionIndex}) sent for session ${sessionId}`
      );
    } catch (error) {
      console.error("Next question error:", error);
      socket.emit("error", { message: "Failed to go to next question" });
    }
  }

  // --- Pause / Resume / End (socket path)
  async handlePauseQuiz(socket, data) {
    const { sessionId } = data;
    const session = await QuizSession.findById(sessionId);
    if (!session) return;
    await session.pauseSession();

    const t = getTimingForSession(sessionId);
    if (t && !t.pausedAt) t.pausedAt = Date.now();

    const now = Date.now();
    const ts = snapTimingForSession(sessionId, now);

    this.io.to(`session:${sessionId}`).emit("quiz_paused", {
      serverNow: now,
      questionStartedAt: ts.questionStartedAt ?? null,
      timeLimit: ts.timeLimit ?? null,
      questionEndsAt: ts.questionEndsAt,
      remainingSeconds: ts.remainingSeconds,
    });
    console.log(`Quiz paused for session ${sessionId}`);
  }

  async handleResumeQuiz(socket, data) {
    const { sessionId } = data;
    const session = await QuizSession.findById(sessionId);
    if (!session) return;
    await session.resumeSession();

    const t = getTimingForSession(sessionId);
    const now = Date.now();
    if (t && t.pausedAt) {
      t.pauseAccumMs += now - t.pausedAt;
      t.pausedAt = null;
    }
    const ts = snapTimingForSession(sessionId, now);

    this.io.to(`session:${sessionId}`).emit("quiz_resumed", {
      serverNow: now,
      questionStartedAt: ts.questionStartedAt ?? null,
      timeLimit: ts.timeLimit ?? null,
      questionEndsAt: ts.questionEndsAt,
      remainingSeconds: ts.remainingSeconds,
    });
    console.log(`Quiz resumed for session ${sessionId}`);
  }

  async handleEndQuiz(socket, data) {
    const { sessionId } = data;
    const session = await QuizSession.findById(sessionId);
    if (!session) return;
    await session.endSession();
    this.io.to(`session:${sessionId}`).emit("quiz_ended");
    console.log(`Quiz ended for session ${sessionId}`);
  }

  // --- Submit answer ---
  async handleSubmitAnswer(socket, data) {
    try {
      const { sessionId, questionIndex, answer, timeSpent = 0 } = data;
      const userId = socket.userId;

      if (!userId) {
        socket.emit("error", { message: "User not identified" });
        return;
      }

      const session = await QuizSession.findById(sessionId).populate("quiz");
      if (!session || !session.quiz) {
        socket.emit("error", { message: "Session or quiz not found" });
        return;
      }

      const question = session.quiz.questions[questionIndex];
      if (!question) {
        socket.emit("error", { message: "Invalid question index" });
        return;
      }

      // Normalize incoming answer for parity with HTTP path
      const { answerText, blanksArray } = normalizeIncomingAnswerForSocket(
        question,
        answer
      );

      const response = new Response({
        session: sessionId,
        student: userId,
        questionIndex,
        selectedAnswer:
          question.questionType === "fill_in_the_blank"
            ? blanksArray || []
            : answerText,
        maxPointsPossible: question.points,
        timeSpent,
      });

      response.calculateScore(question);
      await response.save();

      // include 'responseCount' (some UIs rely on it)
      const responseCount = await Response.countDocuments({
        $or: [
          { session: sessionId, questionIndex },
          { quizSessionId: sessionId, questionIndex },
        ],
      });

      socket.emit("answer_submitted", {
        questionIndex,
        submittedAt: response.submittedAt,
        pointsEarned: response.pointsEarned,
        isCorrect: response.isCorrect,
      });

      socket.to(`session:${sessionId}`).emit("new_response", {
        userId,
        questionIndex,
        submittedAt: response.submittedAt,
        pointsEarned: response.pointsEarned,
        isCorrect: response.isCorrect,
        selected:
          question.questionType === "fill_in_the_blank"
            ? Array.isArray(blanksArray)
              ? blanksArray
              : []
            : answerText,
        responseCount,
      });

      // live distribution push
      try {
        const rows = await Response.getAnswerDistribution(
          sessionId,
          questionIndex
        );
        const distribution = {};
        const answers = Array.isArray(question.answers) ? question.answers : [];

        for (const r of rows || []) {
          const key = String(r?._id ?? "");
          const cnt = Number(r?.count || 0);
          if (!key) continue;

          // key is already the answer _id from the aggregation — set once
          distribution[key] = (distribution[key] || 0) + cnt;

          // add a human-readable alias by label ()
          const byId = answers.find((a) => String(a?._id) === key);
          if (byId) {
            const label = String(byId.answerText ?? "");
            if (label) distribution[label] = (distribution[label] || 0) + cnt;
          }
        }

        const qId = String(
          question?._id || `${String(session.quiz)}:${Number(questionIndex)}`
        );
        this.io.to(`session:${sessionId}`).emit("answers_update", {
          questionId: qId,
          questionIndex,
          distribution,
        });
      } catch (e) {
        console.warn("answers_update emit failed:", e.message);
      }

      console.log(
        `Answer persisted: student ${userId}, Q${questionIndex}, session ${sessionId}`
      );
    } catch (error) {
      console.error("Submit answer error:", error);
      socket.emit("error", { message: "Failed to submit answer" });
    }
  }

  // --- Scoreboard / Results ---
  async handleShowScoreboard(socket, data) {
    try {
      const { sessionId, limit = 5 } = data;
      const scoreboard = await Response.getLeaderboard(sessionId, limit);
      this.io.to(`session:${sessionId}`).emit("scoreboard", { scoreboard });
      console.log(`Scoreboard sent for session ${sessionId}`);
    } catch (error) {
      console.error("Show scoreboard error:", error);
      socket.emit("error", { message: "Failed to generate scoreboard" });
    }
  }

  async handleShowQuestionResults(socket, data) {
    try {
      const { sessionId, questionIndex } = data;
      const results = await Response.getAnswerDistribution(
        sessionId,
        questionIndex
      );
      this.io.to(`session:${sessionId}`).emit("question_results", {
        questionIndex,
        results,
      });
      console.log(
        `Question results sent for session ${sessionId}, question ${questionIndex}`
      );
    } catch (error) {
      console.error("Show question results error:", error);
      socket.emit("error", { message: "Failed to get question results" });
    }
  }

  // --- Disconnect ---
  handleDisconnect(socket) {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socket.sessionId && socket.userId) {
      const room = roomMap(socket.sessionId);
      const u = { id: socket.userId };
      room.delete(socket.userId);
      this.io.to(`session:${socket.sessionId}`).emit("participant_left", u);
    }
  }

  // --- Helpers ---

  // Student-safe question payload
  prepareQuestionForStudents(question, index, quizId) {
    const q = {
      id: keyFor(quizId, index, question),
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points,
      timeLimit: question.timeLimit || 30,
      index,
    };

    if (question.image) {
      q.image = question.image;
      q.imageAlt = question.imageAlt || "";
    }

    switch (question.questionType) {
      case "mcq":
      case "poll":
        q.answers = (question.answers || []).map((a) => ({
          answerText: a.answerText,
        }));
        break;

      case "word_cloud":
        q.maxSubmissions = question.maxSubmissions;
        q.allowAnonymous = question.allowAnonymous;
        break;

      case "pose_and_discuss":
        if (question.modelAnswer) q.modelAnswer = question.modelAnswer;
        break;

      case "fill_in_the_blank":
        q.template = question.template || "";
        q.blanks =
          Array.isArray(question.blanks) && question.blanks.length
            ? question.blanks
            : (q.template.match(/\{([^}]+)\}/g) || []).map((m) =>
                m
                  .slice(1, -1)
                  .split("|")
                  .map((s) => s.trim())
                  .filter(Boolean)
              );
        q.caseSensitive = !!question.caseSensitive;
        q.trimWhitespace = !!question.trimWhitespace;
        break;
    }

    return q;
  }
}

module.exports = SocketService;
module.exports.getParticipantsForSession = getParticipantsForSession;

// Export timing helpers so controllers can use them too:
module.exports.getTimingForSession = getTimingForSession;
module.exports.setTimingForSession = setTimingForSession;
module.exports.snapTimingForSession = snapTimingForSession;
