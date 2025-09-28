// controllers/quizSessionController.js
//Quiz session lifecycle controller: create/join/start/pause/resume/advance/submit
// answers, session results, and per-student review.
// req.user may be attached by auth middleware (id/role), but fallbacks exist.
// Socket.IO server instance is stored on app as `app.set('io', io)`.
// Timing is maintained centrally in socketService for consistent late-join sync.

const QuizSession = require("../models/quizSessionModel");
const Quiz = require("../models/quizModel");
const Response = require("../models/responseModel");
const Course = require("../models/courseModel");
const mongoose = require("mongoose");

const {
  getParticipantsForSession, // in-memory participant tracker (for quick lookups)
  getTimingForSession, // returns authoritative timing state for a session
  setTimingForSession, // sets/resets timing state when questions change
  snapTimingForSession, // computes derived fields (endsAt, remainingSeconds)
} = require("../services/socketService");

// Stable fallback id used where a question doc _id may not exist (older from earlier testing data)
const stableQuestionId = (quizId, index) =>
  `${String(quizId)}:${Number(index)}`;

// helpers
// Normalize text for comparisons (case/space) used by FIB grading.
const normText = (s, { caseSensitive = false, trimWhitespace = true } = {}) => {
  let v = String(s ?? "");
  if (trimWhitespace) v = v.trim();
  return caseSensitive ? v : v.toLowerCase();
};

// Utility to detect "fill in the blank" across legacy spellings.
const isFIB = (t) =>
  ["fill_in_the_blank", "fill_blank", "fill-in-the-blank"].includes(
    String(t || "")
      .toLowerCase()
      .replaceAll("-", "_")
  );

  // Ensure blanks are arrays-of-arrays (each blank may have multiple accepted answers).
const normalizeBlanksShape = (blanks) =>
  Array.isArray(blanks)
    ? blanks.map((b) => (Array.isArray(b) ? b : b == null ? [] : [b]))
    : [];

// Simple 6-char alphanumeric join code (retry loop on collision).
const generateSessionCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

// User/role helpers: tolerate dev setups (headers/body fallbacks).
const getUserId = (req) =>
  (req.user && (req.user._id || req.user.id)) ||
  req.header("x-user-id") ||
  req.body.userId;

const getUserRole = (req) =>
  (req.user && req.user.role) || req.body.role || "student";

// Basic access rules per role and session status.
// Lecturer must be owner of the seession
// Student can join if session is waiting OR active (when allowLateJoin is true).
const validateSessionAccess = (session, userId, role) => {
  if (role === "lecturer") return String(session.createdBy) === String(userId);
  if (role === "student") {
    const allow = session?.settings?.allowLateJoin ?? true;
    return (
      session.status === "waiting" || (session.status === "active" && allow)
    );
  }
  return false;
};

// Template parsing helpers (single vs double braces)
function parseSingleBraced(tpl = "") {
  const re = /\{([^}]+)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const alts = m[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(alts.length ? alts : [""]);
  }
  return out;
}
function parseDoubleBraced(tpl = "") {
  const re = /\{\{([^}]+)\}\}/g;
  const out = [];
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const alts = m[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(alts.length ? alts : [""]);
  }
  return out;
}

// Resolve expected blanks for a question from q.blanks, or derive from template.
// Supports both {{double}} and {single} brace syntaxes for compatibility (found this problem when merging work)
function normalizeExpectedBlanks(q) {
  let expected = Array.isArray(q.blanks) ? q.blanks : [];
  if (!expected.length && q.template) {
    expected = parseDoubleBraced(q.template);
    if (!expected.length) expected = parseSingleBraced(q.template);
  }
  expected = expected.map((entry) => {
    if (Array.isArray(entry))
      return entry.map((s) => String(s).trim()).filter(Boolean);
    return String(entry)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  });
  return expected;
}

//Kept for completeness; same as parseSingleBraced (used by some flows).
function parseTemplateBlanks(template = "") {
  const re = /\{([^}]+)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(template)) !== null) {
    const alts = m[1]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(alts.length ? alts : [""]);
  }
  return out;
}

// Build a student-safe question payload for the live session (no correctness flags).
const prepareQuestionForStudents = (q, index, quizId) => {
  const out = {
    id: String(q?._id || stableQuestionId(quizId, index)),
    questionText: q.questionText,
    questionType: q.questionType,
    points: q.points,
    timeLimit: q.timeLimit || 30,
    image: q.image,
    imageAlt: q.imageAlt,
    index,
  };
  if (q.questionType === "mcq") {
    // Only the answer text, no isCorrect
    out.answers = (q.answers || []).map((a) => ({ answerText: a.answerText }));
  } else if (q.questionType === "word_cloud") {
    out.maxSubmissions = q.maxSubmissions || 1;
    out.allowAnonymous = q.allowAnonymous || false;
  } else if (q.questionType === "fill_in_the_blank") {
    // Provide template + blanks (for rendering inputs) and comparison flags
    out.template = q.template;
    out.blanks = q.blanks;
    out.caseSensitive = !!q.caseSensitive;
    out.trimWhitespace = !!q.trimWhitespace;
  }
  return out;
};


// Normalize inbound answers from various client shapes into a consistent record.
// Accepts
//{ answer: { type, text, blanks:[] } } (object)
// { answer: [..] } (array)
//  { answer: "a | b" } (string for FIB)
//  Raw arrays/strings as body (legacy)
function normalizeIncomingAnswer(q, body) {
  const raw = body?.answer ?? body;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const t = (raw.type || q.questionType || "")
      .toLowerCase()
      .replaceAll(" ", "_");

    if (t === "mcq" || t === "poll") {
      /* ...unchanged... */
    }

    if (t === "word_cloud" || t === "pose_and_discuss" || t === "text") {
      return { answerText: String(raw.text || "").trim() };
    }

    if (t === "fill_blank" || t === "fill_in_the_blank") {
      const arr = Array.isArray(raw.blanks)
        ? raw.blanks.map((s) => String(s ?? "").trim())
        : [];
      return { answerText: arr.join(" | "), blanksArray: arr };
    }
  }

  if (Array.isArray(raw)) {
    const arr = raw.map((s) => String(s ?? "").trim());
    return { answerText: arr.join(" | "), blanksArray: arr };
  }

  //if a plain string arrives for a FIB question, split it
  const asStr = String(raw ?? "").trim();
  const qtype = String(q?.questionType || "")
    .toLowerCase()
    .replaceAll(" ", "_");
  if (qtype === "fill_in_the_blank" || qtype === "fill_blank") {
    const arr = asStr
      ? asStr
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return { answerText: asStr, blanksArray: arr };
  }

  return { answerText: asStr };
}

// controllers
// Create a new live quiz session (lecturer only implied; no hard role check here)
exports.createSession = async (req, res) => {
  // (unchanged)
  try {
    const {
      quizId,
      allowLateJoin = true,
      autoAdvance = false,
      courseId,
    } = req.body;

    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Unauthorized (no user)" });
    if (!quizId)
      return res.status(400).json({ message: "Quiz ID is required" });

    // Resolve quiz + ensure it is linked to a course (supports multiple field names)
    const quiz = await Quiz.findById(quizId).select(
      "_id title course courseId course_id questions"
    );
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const derivedCourse =
      (quiz.course && String(quiz.course)) ||
      (quiz.courseId && String(quiz.courseId)) ||
      (quiz.course_id && String(quiz.course_id)) ||
      (courseId && String(courseId)) ||
      "";

    if (!derivedCourse) {
      return res
        .status(409)
        .json({ message: "Quiz is not linked to a course" });
    }

// Backfill quiz.course if missing
    if (!quiz.course || String(quiz.course) !== derivedCourse) {
      quiz.course = derivedCourse;
      await quiz.save();
    }

    // Generate unique join code (max 10 attempts)
    let code,
      ok = false,
      tries = 0;
    while (!ok && tries < 10) {
      code = generateSessionCode();
      ok = !(await QuizSession.findOne({
        sessionCode: code,
        status: { $ne: "completed" },
      }));
      tries++;
    }
    if (!ok)
      return res
        .status(500)
        .json({ message: "Failed to generate unique session code" });
// Create session with initial waiting status
    const session = await QuizSession.create({
      quiz: quizId,
      course: derivedCourse,
      sessionCode: code,
      createdBy: userId,
      status: "waiting",
      currentQuestionIndex: -1,
      participants: [],
      settings: { allowLateJoin, autoAdvance, timePerQuestion: 30 },
    });

    await session.populate("quiz", "title questions");
    res.status(201).json({
      sessionId: session._id,
      sessionCode: session.sessionCode,
      quiz: session.quiz,
      status: session.status,
      settings: session.settings,
    });
  } catch (err) {
    console.error("Create session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/sessions/join
// Student/lecturer joins a session by code (ensures course match & status)
exports.joinSession = async (req, res) => {
  // (unchanged)
  try {
    const userId = getUserId(req);
    const role = getUserRole(req);
    const { sessionCode, courseId: fromPageCourseId } = req.body;

    if (!sessionCode)
      return res.status(400).json({ message: "Session code is required" });
    if (!userId)
      return res.status(401).json({ message: "Unauthorized (no user)" });

    // Only allow join if session is waiting/active
    const session = await QuizSession.findOne({
      sessionCode: String(sessionCode).toUpperCase(),
      status: { $in: ["waiting", "active"] },
    }).populate("quiz", "title questions course courseId course_id");

    if (!session) {
      return res
        .status(404)
        .json({ message: "Session not found or has ended" });
    }
// Canonicalize course id on the session (from session or quiz)
    const quizCourse =
      (session.quiz?.course && String(session.quiz.course)) ||
      (session.quiz?.courseId && String(session.quiz.courseId)) ||
      (session.quiz?.course_id && String(session.quiz.course_id)) ||
      "";

    let canonicalCourseId =
      (session.course && String(session.course)) || quizCourse || "";

    if (!canonicalCourseId && quizCourse) {
      session.course = quizCourse;
      canonicalCourseId = quizCourse;
      await session.save();
    }

    if (!canonicalCourseId) {
      return res
        .status(409)
        .json({ message: "Session is not linked to a course" });
    }

    // Enforce the "join from same course page" rule
    if (
      !fromPageCourseId ||
      String(fromPageCourseId) !== String(canonicalCourseId)
    ) {
      return res
        .status(403)
        .json({ message: "This session belongs to a different course" });
    }

    if (!validateSessionAccess(session, userId, role)) {
      return res.status(403).json({ message: "Cannot join this session" });
    }

 // Add participant if new; otherwise ignore duplicate
    const exists = (session.participants || []).some(
      (p) => String(p.user) === String(userId)
    );
    if (!exists) {
      session.participants.push({
        user: userId,
        joinedAt: new Date(),
        status: "active",
      });
      await session.save();
    }
// Notify room (for live participant counters)
    const io = req.app.get("io");
    if (io && role === "student") {
      io.to(`session:${session._id}`).emit("participant_joined", {
        userId,
        joinedAt: new Date(),
        participantCount: session.participants.length,
      });
    }

    res.json({
      sessionId: session._id,
      sessionCode: session.sessionCode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      quiz: {
        _id: session.quiz._id,
        title: session.quiz.title,
        totalQuestions: session.quiz.questions.length,
      },
      course: canonicalCourseId,
    });
  } catch (err) {
    console.error("Join session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//GET /api/sessions/:sessionId
// Get current session state; students must be participants
exports.getSession = async (req, res) => {
  // (unchanged)
  try {
    const { sessionId } = req.params;
    const role = getUserRole(req);
    const userId = getUserId(req);

    const s = await QuizSession.findById(sessionId)
      .populate("quiz")
      .populate("participants.user", "name email");
    if (!s) return res.status(404).json({ message: "Session not found" });

    if (role === "student") {
      const isParticipant = s.participants?.some(
        (p) => String(p.user?._id || p.user) === String(userId)
      );
      if (!isParticipant) {
        return res
          .status(403)
          .json({ message: "Join required for this session" });
      }
    }
    // Base payload common to both roles
    const data = {
      sessionId: s._id,
      sessionCode: s.sessionCode,
      code: s.sessionCode, //for compatibility
      status: s.status,
      currentQuestionIndex: s.currentQuestionIndex, //for compatibility
      currentIndex: s.currentQuestionIndex,
      startedAt: s.startedAt,
      settings: s.settings,
      participantCount: s.participants.length,
      quizId: s.quiz?._id,
      participants: s.participants.map((p) => ({
        id: p.user?._id || p.user,
        name: p.user?.name || "Student",
      })),
      pendingLate: [], // placeholder for future late-join logic
    };

    if (role === "lecturer") {
      // Full quiz for lecturer dashboard
      data.quiz = s.quiz;
    } else {
      // Students get only metadata and the current question (if active)
      data.quiz = {
        _id: s.quiz._id,
        title: s.quiz.title,
        totalQuestions: s.quiz.questions.length,
      };
      if (s.status === "active" && s.currentQuestionIndex >= 0) {
        data.currentQuestion = prepareQuestionForStudents(
          s.quiz.questions[s.currentQuestionIndex],
          s.currentQuestionIndex,
          s.quiz._id
        );
      }
    }

    res.json(data);
  } catch (err) {
    console.error("Get session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//POST /api/sessions/:sessionId/start
// Start a session (lecturer), emit first question + authoritative timing
exports.startSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Unauthorized (no user)" });

    const s = await QuizSession.findById(sessionId).populate("quiz");
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (!validateSessionAccess(s, userId, "lecturer"))
      return res.status(403).json({ message: "Unauthorized" });
    if (s.status !== "waiting")
      return res
        .status(400)
        .json({ message: "Session already started or ended" });

        // Transition to active first question
    s.status = "active";
    s.startedAt = new Date();
    s.currentQuestionIndex = 0;
    await s.save();

    const io = req.app.get("io");
    const first = prepareQuestionForStudents(
      s.quiz.questions[0],
      0,
      s.quiz._id
    );

    // SET TIMING STATE (authoritative)
    const startedAt = Date.now();
    setTimingForSession(sessionId, {
      questionStartedAt: startedAt,
      timeLimit: Number(first.timeLimit ?? s.settings?.timePerQuestion ?? 30),
      pausedAt: null,
      pauseAccumMs: 0,
    });

    // Compute derived timing fields for consistent client display
    const now = Date.now();
    const ts = snapTimingForSession(sessionId, now);

    // Broadcast "quiz_started" with timing payload so late joiners sync correctly.
    if (io) {
      io.to(`session:${sessionId}`).emit("quiz_started", {
        question: first,
        questionIndex: 0,
        totalQuestions: s.quiz.questions.length,
        sessionStatus: "active",
        serverNow: now,
        questionStartedAt: ts.questionStartedAt,
        timeLimit: ts.timeLimit,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

      //Reset any live aggregates (distributions) for first question
      io.to(`session:${sessionId}`).emit("answers_update", {
        questionId: String(s.quiz.questions[0]._id),
        questionIndex: 0,
        distribution: {},
      });
      io.to(`session:${sessionId}`).emit("new_response", {
        questionIndex: 0,
        responseCount: 0,
      });
    }

    res.json({
      sessionId: s._id,
      status: s.status,
      currentQuestionIndex: s.currentQuestionIndex,
      currentIndex: s.currentQuestionIndex,
      startedAt: s.startedAt,
      questionStartedAt: ts.questionStartedAt,
      questionEndsAt: ts.questionEndsAt,
      remainingSeconds: ts.remainingSeconds,
    });
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//POST /api/sessions/:sessionId/pause
// Pause timing for current question (lecturer)
exports.pauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = getUserId(req);
    const s = await QuizSession.findById(sessionId);
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (!validateSessionAccess(s, userId, "lecturer"))
      return res.status(403).json({ message: "Unauthorized" });

    await s.pauseSession();

// Mark pausedAt in timing state (used by snapTimingForSession)
    const t = getTimingForSession(sessionId);
    if (t && !t.pausedAt) t.pausedAt = Date.now();

    const io = req.app.get("io");
    const now = Date.now();
    const ts = snapTimingForSession(sessionId, now);

    if (io)
      io.to(`session:${sessionId}`).emit("quiz_paused", {
        serverNow: now,
        questionStartedAt: ts.questionStartedAt ?? null,
        timeLimit: ts.timeLimit ?? null,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

    res.json({ sessionId, status: "paused", ...ts });
  } catch (err) {
    console.error("Pause session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/sessions/:sessionId/resume
// Resume timing for current question (lecturer)
// Lecturer access
 exports.resumeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = getUserId(req);
    const s = await QuizSession.findById(sessionId);
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (!validateSessionAccess(s, userId, "lecturer"))
      return res.status(403).json({ message: "Unauthorized" });

    await s.resumeSession();

     // Adjust accumulated pause time so remainingSeconds is accurate
    const t = getTimingForSession(sessionId);
    const now = Date.now();
    if (t && t.pausedAt) {
      t.pauseAccumMs += now - t.pausedAt;
      t.pausedAt = null;
    }
    const ts = snapTimingForSession(sessionId, now);

    const io = req.app.get("io");
    if (io)
      io.to(`session:${sessionId}`).emit("quiz_resumed", {
        serverNow: now,
        questionStartedAt: ts.questionStartedAt ?? null,
        timeLimit: ts.timeLimit ?? null,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

    res.json({ sessionId, status: "active", ...ts });
  } catch (err) {
    console.error("Resume session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//POST /api/sessions/:sessionId/next
// Advance to next (or specified) question, reset timing, emit updates
exports.nextQuestion = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { nextIndex } = req.body || {};
    const userId = getUserId(req);

    const s = await QuizSession.findById(sessionId).populate("quiz");
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (!validateSessionAccess(s, userId, "lecturer"))
      return res.status(403).json({ message: "Unauthorized" });
    if (!s.quiz || !s.quiz.questions.length)
      return res.status(400).json({ message: "Quiz has no questions" });

    // Compute next index or explicit target
    const idx =
      typeof nextIndex === "number" ? nextIndex : s.currentQuestionIndex + 1;
      // No more questions => end session
    if (idx >= s.quiz.questions.length) {
      s.status = "completed";
      s.endedAt = new Date();
      await s.save();
      const io = req.app.get("io");
      if (io) io.to(`session:${sessionId}`).emit("quiz_ended");
      return res.json({ sessionId, status: "completed" });
    }

    // Update session index
    await s.advanceToQuestion(idx);
    const q = prepareQuestionForStudents(
      s.quiz.questions[idx],
      idx,
      s.quiz._id
    );

    // RESET TIMING STATE for the new question
    const startedAt = Date.now();
    setTimingForSession(sessionId, {
      questionStartedAt: startedAt,
      timeLimit: Number(q.timeLimit ?? s.settings?.timePerQuestion ?? 30),
      pausedAt: null,
      pauseAccumMs: 0,
    });
    const now = Date.now();
    const ts = snapTimingForSession(sessionId, now);

    // Broadcast next_question + reset aggregates for charts
    const io = req.app.get("io");
    if (io)
      io.to(`session:${sessionId}`).emit("next_question", {
        question: q,
        questionIndex: idx,
        totalQuestions: s.quiz.questions.length,
        serverNow: now,
        questionStartedAt: ts.questionStartedAt,
        timeLimit: ts.timeLimit,
        questionEndsAt: ts.questionEndsAt,
        remainingSeconds: ts.remainingSeconds,
      });

    if (io)
      io.to(`session:${sessionId}`).emit("answers_update", {
        questionId: String(s.quiz.questions[idx]._id),
        questionIndex: idx,
        distribution: {},
      });
    if (io)
      io.to(`session:${sessionId}`).emit("new_response", {
        questionIndex: idx,
        responseCount: 0, // reset count for UI
      });

    res.json({
      sessionId,
      currentQuestionIndex: idx,
      currentIndex: idx,
      status: s.status,
      questionStartedAt: ts.questionStartedAt,
      questionEndsAt: ts.questionEndsAt,
      remainingSeconds: ts.remainingSeconds,
    });
  } catch (err) {
    console.error("Next question error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/sessions/:sessionId/submit
// Submit an answer for the current question. Handles MCQ, Poll, FIB, etc.

// Notes on grading:
// MCQ: exact text match with a correct option.
// Poll / pose_and_discuss / word_cloud: any non-empty answer earns points.
// FIB: compare each blank against allowed alternatives, honoring case/trim flags.
exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionIndex, timeSpent = 0 } = req.body;
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Unauthorized (no user)" });

    const s = await QuizSession.findById(sessionId).populate("quiz");
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (s.status !== "active")
      return res.status(400).json({ message: "Session is not active" });
    if (questionIndex !== s.currentQuestionIndex) {
      return res.status(400).json({ message: "Question index mismatch" });
    }

    const q = s.quiz.questions[questionIndex];
    if (!q) return res.status(400).json({ message: "Question not found" });

    // Prevent duplicate submissions by same user for same question
    const dupe = await Response.findOne({
      $or: [
        { session: sessionId, student: userId, questionIndex },
        { quizSessionId: sessionId, studentId: userId, questionIndex },
      ],
    });
    if (dupe)
      return res
        .status(400)
        .json({ message: "Answer already submitted for this question" });

        // Normalize incoming answer into {answerText, blanksArray?}
    const { answerText, blanksArray } = normalizeIncomingAnswer(q, req.body);

    let pointsEarned = 0,
      isCorrect = false;

      // Type-specific grading
    switch (q.questionType) {
      case "mcq": {
        const cleaned = String(answerText || "").trim();
        if (!cleaned) {
          return res.status(400).json({ message: "No option selected" });
        }
        const chosen = (q.answers || []).find((a) => a.answerText === cleaned);
        if (chosen?.isCorrect) {
          isCorrect = true;
          pointsEarned = q.points;
        }
        break;
      }
      case "word_cloud":
      case "pose_and_discuss": {
        if (String(answerText || "").trim()) {
          isCorrect = true;
          pointsEarned = q.points;
        }
        break;
      }
      case "fill_in_the_blank": {
        // Build expected alternatives (from q.blanks or template)
        const expected = normalizeExpectedBlanks(q);
        // Accept either array form or pipe-separated string
        const given = Array.isArray(blanksArray)
          ? blanksArray.map((s) => String(s ?? "").trim())
          : String(answerText || "")
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean);
              // Require at least as many answers as there are blanks
        if (expected.length && given.length >= expected.length) {
          const norm = (s) =>
            normText(s, {
              caseSensitive: !!q.caseSensitive,
              trimWhitespace: q.trimWhitespace !== false,
            });
            // Every blank i must match one of its allowed alternatives
          const ok = expected.every((alts, i) => {
            const u = norm(given[i] ?? "");
            return (alts || []).some((alt) => norm(alt) === u);
          });
          isCorrect = ok;
          pointsEarned = ok ? q.points : 0;
        }
        break;
      }
      case "poll": {
        // Any non-empty choice is "valid" (no correctness notion)
        const has = String(answerText || "").trim().length > 0;
        if (has) {
          isCorrect = true;
          pointsEarned = q.points;
        }
        break;
      }
      default:
        break;
    }

    // Store response (keeps both current and legacy fields for compatibility)
    const resp = await Response.create({
      session: sessionId,
      student: userId,
      quizSessionId: sessionId,
      studentId: userId,

      questionIndex,
      selectedAnswer:
        q.questionType === "fill_in_the_blank" ? blanksArray || [] : answerText,
      maxPointsPossible: q.points,
      pointsEarned,
      timeSpent,
      isCorrect,
      submittedAt: new Date(),
    });

    // Per-submission broadcast (for live counts/visualizations)
    const io = req.app.get("io");
    if (io) {
      io.to(`session:${sessionId}`).emit("new_response", {
        userId,
        questionIndex,
        submittedAt: resp.submittedAt,
        selected:
          q.questionType === "fill_in_the_blank"
            ? Array.isArray(blanksArray)
              ? blanksArray
              : []
            : answerText,
        responseCount: await Response.countDocuments({
          $or: [
            { session: sessionId, questionIndex },
            { quizSessionId: sessionId, questionIndex },
          ],
        }),
      });
    }

// Update aggregate distribution for MCQ charts
    try {
      const io = req.app.get("io");
      if (!io) throw new Error("io missing");

      const questionId = String(
        q?._id || `${String(s.quiz._id)}:${Number(questionIndex)}`
      );

      // Model layer aggregation (id -> count)
      const rows = await Response.getAnswerDistribution(
        sessionId,
        questionIndex
      );

      // Build a distribution keyed by both optionId and answerText for convenience
      const distribution = {};
      const answers = Array.isArray(q.answers) ? q.answers : [];

      for (const r of rows || []) {
        const key = String(r?._id ?? "");
        const cnt = Number(r?.count || 0);
        if (!key) continue;

        distribution[key] = (distribution[key] || 0) + cnt;

        const byId = answers.find((a) => String(a?._id) === key);
        if (byId) {
          const label = String(byId.answerText ?? "");
          if (label) distribution[label] = (distribution[label] || 0) + cnt;
          distribution[String(byId._id)] =
            (distribution[String(byId._id)] || 0) + cnt;
        }
      }

      io.to(`session:${sessionId}`).emit("answers_update", {
        questionId,
        questionIndex,
        distribution,
      });
    } catch (e) {
      console.warn("answers_update emit failed:", e.message);
    }

    res.json({
      responseId: resp._id,
      pointsEarned,
      isCorrect,
      submittedAt: resp.submittedAt,
    });
  } catch (err) {
    console.error("Submit answer error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//GET /api/sessions/:sessionId/results
// Return per-question stats + leaderboard for a session

exports.getSessionResults = async (req, res) => {

  try {
    const { sessionId } = req.params;
    const s = await QuizSession.findById(sessionId).populate("quiz");
    if (!s) return res.status(404).json({ message: "Session not found" });

    // Aggregate per-question stats
    const responseStats = await Response.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: "$questionIndex",
          totalResponses: { $sum: 1 },
          correctResponses: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          avgTimeSpent: { $avg: "$timeSpent" },
          responses: { $push: "$selectedAnswer" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Leaderboard: points and accuracy per student
    const leaderboard = await Response.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: "$student",
          totalPoints: { $sum: "$pointsEarned" },
          correctAnswers: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          totalAnswers: { $sum: 1 },
        },
      },
      { $sort: { totalPoints: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $project: {
          userId: "$_id",
          name: { $arrayElemAt: ["$user.name", 0] },
          totalPoints: 1,
          correctAnswers: 1,
          totalAnswers: 1,
          accuracy: { $divide: ["$correctAnswers", "$totalAnswers"] },
        },
      },
    ]);

    res.json({
      sessionId: s._id,
      sessionCode: s.sessionCode,
      quiz: { title: s.quiz.title, totalQuestions: s.quiz.questions.length },
      participantCount: s.participants.length,
      responseStats,
      leaderboard,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    });
  } catch (err) {
    console.error("Get session results error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/sessions/:sessionId/end
// End the session and broadcast completion

exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = getUserId(req);
    const s = await QuizSession.findById(sessionId);
    if (!s) return res.status(404).json({ message: "Session not found" });
    if (!validateSessionAccess(s, userId, "lecturer"))
      return res.status(403).json({ message: "Unauthorized" });

    s.status = "completed";
    s.endedAt = new Date();
    await s.save();

    const io = req.app.get("io");
    if (io)
      io.to(`session:${sessionId}`).emit("quiz_ended", {
        message: "Quiz has ended",
        endedAt: s.endedAt,
      });

    res.json({ sessionId: s._id, status: s.status, endedAt: s.endedAt });
  } catch (err) {
    console.error("End session error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

//GET /api/sessions/code/:code
// Resolve a join code into a waiting/active session

exports.getByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || !code.trim()) {
      return res.status(400).json({ message: "Code is required" });
    }

    const session = await QuizSession.findOne({
      sessionCode: String(code).toUpperCase(),
      status: { $in: ["waiting", "active"] },
    })
      .select("_id quiz course status sessionCode currentQuestionIndex")
      .lean();

    if (!session) {
      return res
        .status(404)
        .json({ message: "No waiting/active session for that code." });
    }

    res.json({
      sessionId: session._id,
      status: session.status,
      currentIndex: session.currentQuestionIndex ?? -1,
      quiz: session.quiz,
      course: session.course,
      joinCode: session.sessionCode,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

//GET /api/sessions/:id/participants
// Return the in-memory participant list (from socketService)
exports.participants = async (req, res) => {
  try {
    const { id } = req.params;
    const list = getParticipantsForSession(String(id));
    res.json({ participants: list });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/quizzes/:quizId/my-review
// Returns per-question review for the logged-in student across any sessions of this quiz.
exports.getMyQuizReview = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = getUserId(req);
    if (!userId)
      return res.status(401).json({ message: "Unauthorized (no user)" });

    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    // find all sessions for this quiz (any status)
    const sessions = await QuizSession.find({ quiz: quizId })
      .select("_id")
      .lean();
    const sids = sessions.map((s) => s._id);
    // If no sessions exist, return empty review skeleton with expected blanks
    if (!sids.length) {
      return res.json({
        quiz: { _id: quiz._id, title: quiz.title },
        review: (quiz.questions || []).map((q, idx) => ({
          questionIndex: idx,
          question: {
            questionType: q.questionType,
            questionText: q.questionText,
            template: q.template,
            answers: (q.answers || []).map((a) => ({
              answerText: a.answerText,
              isCorrect: !!a.isCorrect,
            })),
            points: q.points || 0,
          },
          myAnswer: null,
          isCorrect: null,
          pointsEarned: 0,
          maxPointsPossible: q.points || 0,
          expectedBlanks: isFIB(q.questionType)
            ? normalizeExpectedBlanks(q)
            : [],
        })),
      });
    }

    // fetch student's responses across those sessions; pick latest per questionIndex
    const rows = await Response.find({
      student: userId,
      $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
    })
      .select(
        "questionIndex selectedAnswer pointsEarned maxPointsPossible isCorrect submittedAt"
      )
      .sort({ submittedAt: 1 })
      .lean();

    const latestByIdx = new Map();
    for (const r of rows) latestByIdx.set(r.questionIndex, r); // later sort ensures last wins

    const review = (quiz.questions || []).map((q, idx) => {
      const r = latestByIdx.get(idx) || null;

      let myAnswer = null;
      if (r) {
        const src =
          r.selectedAnswer !== undefined ? r.selectedAnswer : r.selected;
        if (Array.isArray(src)) {
          myAnswer = src;
        } else if (typeof src === "string" && isFIB(q.questionType)) {
          myAnswer = src
            .split("|")
            .map((s) => String(s).trim())
            .filter(Boolean);
        } else {
          myAnswer = src ?? null;
        }
      }

      return {
        questionIndex: idx,
        question: {
          questionType: q.questionType,
          questionText: q.questionText,
          template: q.template,
          answers: (q.answers || []).map((a) => ({
            answerText: a.answerText,
            isCorrect: !!a.isCorrect,
          })),
          points: q.points || 0,
        },
        myAnswer,
        isCorrect: r ? !!r.isCorrect : null,
        pointsEarned: r ? Number(r.pointsEarned || 0) : 0,
        maxPointsPossible: r
          ? Number(r.maxPointsPossible || q.points || 0)
          : q.points || 0,
        expectedBlanks:
          q.questionType === "fill_in_the_blank"
            ? normalizeExpectedBlanks(q)
            : [],
      };
    });

    res.json({
      quiz: { _id: quiz._id, title: quiz.title },
      review,
    });
  } catch (err) {
    console.error("getMyQuizReview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
