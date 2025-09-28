// controllers/quizController.js
// Quiz CRUD + student-facing quiz payloads + per-student status/score annotations.
// Assumes an auth middleware attaches req.user with {_id, role} (used in some routes).
const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const Course = require("../models/courseModel");
const QuizSession = require("../models/quizSessionModel");
const Response = require("../models/responseModel");

// helpers
// Parse blanks from single-brace templates:  "A {stack|STACK}"
// -> returns [["stack","STACK"], ...]

// Each {...} group yields an array of acceptable answers, split by '|'.
// Trims whitespace around options.
// Does not enforce case handling here; caseSensitive is respected at grading time.
const extractBlanks = (template = "") =>
  (template.match(/\{([^}]+)\}/g) || []).map((m) =>
    m
      .slice(1, -1)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
  );

//Normalize raw question input into a consistent internal shape.
// Provides defaults (points, timeLimit, etc.).
// Ensures properties exist for each supported question type.
// Does not perform validation here (that happens in validateQuestion).

const preprocess = (q = {}) => {
  const t = q.questionType;
  const base = {
    questionType: t,
    questionText: (q.questionText || "").trim(),
    points: Number(q.points ?? 1) || 1,
    timeLimit: Number(q.timeLimit ?? 30) || 30,
    image: q.image || null,
    imageAlt: q.imageAlt || "",
  };

  if (t === "mcq" || t === "poll") {
    base.answers = (q.answers || []).map((a) => ({
      answerText: String(a.answerText || ""),
      isCorrect: !!a.isCorrect,
    }));
     base.shuffleOptions = !!q.shuffleOptions;
  }

  if (t === "pose_and_discuss") {
    if (q.modelAnswer) base.modelAnswer = String(q.modelAnswer);
  }

  if (t === "word_cloud") {
    base.maxSubmissions = Number(q.maxSubmissions ?? 1) || 1;
    base.allowAnonymous = !!q.allowAnonymous;
  }

  if (t === "fill_in_the_blank") {
    // If blanks provided, use them; otherwise derive from template.
    base.template = String(q.template || "");
    base.blanks =
      Array.isArray(q.blanks) && q.blanks.length
        ? q.blanks
        : extractBlanks(base.template);
    base.caseSensitive = !!q.caseSensitive;
    base.trimWhitespace = !!q.trimWhitespace;
  }

  return base;
};

// Validate a preprocessed question object.
// Returns an array of error messages; empty array means valid.
// Assumes q was produced by preprocess().

const validateQuestion = (q) => {
  const errors = [];
  const t = q.questionType;

  if (!t) errors.push("questionType is required");

  if (t === "mcq" || t === "poll") {
    if (!Array.isArray(q.answers) || q.answers.length < 2) {
      errors.push("At least 2 answers required");
    }
    if (t === "mcq" && !q.answers?.some((a) => a.isCorrect)) {
      errors.push("At least one correct answer required");
    }
  }

  if (t === "word_cloud") {
    if (!q.maxSubmissions || q.maxSubmissions < 1) {
      errors.push("maxSubmissions must be >= 1");
    }
  }

  if (t === "fill_in_the_blank") {
    // If blanks not provided, derive them at the time for validation.
    const blanks = q.blanks.length ? q.blanks : extractBlanks(q.template);
    if (!q.template) errors.push("Template is required");
    if (!blanks.length) errors.push("No blanks detected");
  }

  return errors;
};

 //Strip a preprocessed/validated question down to the minimal stored shape.
 //(Avoids storing derived/transient fields; keeps only what's needed.)

const normaliseQuestion = (q) => {
  const t = q.questionType;
  const out = {
    questionType: t,
    questionText: q.questionText,
    points: q.points,
    timeLimit: q.timeLimit,
    image: q.image,
    imageAlt: q.imageAlt,
  };

  if (t === "mcq" || t === "poll") {
    out.answers = q.answers;
    out.shuffleOptions = !!q.shuffleOptions;
  }

  if (t === "pose_and_discuss") {
    if (q.modelAnswer) out.modelAnswer = q.modelAnswer;
  }

  if (t === "word_cloud") {
    out.maxSubmissions = q.maxSubmissions;
    out.allowAnonymous = q.allowAnonymous;
  }

  if (t === "fill_in_the_blank") {
    out.template = q.template;
    out.blanks = q.blanks.length ? q.blanks : extractBlanks(q.template);
    out.caseSensitive = q.caseSensitive;
    out.trimWhitespace = q.trimWhitespace;
  }

  return out;
};

//Routes
// create a new quiz for a course
//Authenticated (assumes req.user exists; not enforcing role here)
//{ courseId, title, questions = [], settings = {} }
// Validates each question; returns 400 with per-question errors if invalid.
 // Stores normalized question objects.
// POST /api/quizzes
exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions = [], settings = {} } = req.body;

    if (!courseId || !title) {
      return res
        .status(400)
        .json({ message: "courseId and title are required." });
    }

     // Ensure course exists (also acts as a basic authorization boundary)
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

    //put the question in a uniform shape
    const prepared = questions.map(preprocess);

    // Validate each question; collect readable errors with index
    const errors = prepared
      .map((q, i) => {
        const e = validateQuestion(q);
        return e.length ? `Question ${i + 1}: ${e.join(", ")}` : null;
      })
      .filter(Boolean);

    if (errors.length) {
      return res.status(400).json({ message: "Validation errors", errors });
    }

    //persist the quiz
    const quiz = await Quiz.create({
      title: title.trim(),
      courseId,
      questions: prepared.map(normaliseQuestion),
      settings: {
        // sensible defaults; can be overridden 
        showResultsAfterEach: settings.showResultsAfterEach ?? true,
        allowLateJoin: settings.allowLateJoin ?? true,
        shuffleQuestions: !!settings.shuffleQuestions,
      },
      isDraft: false,
      createdBy: req.user?._id,
    });

    res.status(201).json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

//
// GET /api/quizzes/course/:courseId
// Returns quizzes for a course and annotates, per logged-in student:
// myStatus: 'completed' | 'not_completed' (based on any response)
// myScore : sum of pointsEarned across that student's responses
// works without req.user but then returns base list
exports.byCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Base list (minimal quiz info)
    const quizzes = await Quiz.find({ courseId })
      .select("title createdAt updatedAt isDraft questions settings")
      .lean();

      //if we don't know which user it is, return the base list (mainly for lecturer)
    const quizIds = [];
    const base = quizzes.map((q) => {
      quizIds.push(q._id);
      return {
        ...q,
        questionCount: q.questions ? q.questions.length : 0,
      };
    });

    // No user? return base list (keeps compatibility with lecturer use)
    const userId =
      req.user?._id ||
      req.header("x-user-id") || //fallback for dev header
      req.query.userId || //fallback query parameters
      req.body?.userId; //fallback body field

    if (!userId || quizIds.length === 0) {
      return res.json(base);
    }

    const uid = new mongoose.Types.ObjectId(String(userId));

    // Sessions that used any of these quizzes (find all)
    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id quiz")
      .lean();

    if (!sessions.length) {
      //no sessions (cannot have any responses)
      return res.json(
        base.map((q) => ({ ...q, myStatus: "not_completed", myScore: null }))
      );
    }

     // Group session ids by quiz id for later lookups
    const sessionsByQuiz = sessions.reduce((acc, s) => {
      const key = String(s.quiz);
      (acc[key] ||= []).push(s._id);
      return acc;
    }, {});

    const allSessionIds = sessions.map((s) => s._id);

    // Aggregate student's responses for those sessions
    const scored = await Response.aggregate([
      {
        $match: {
          student: uid,
          session: { $in: allSessionIds },
        },
      },
      {
        $group: {
          _id: "$session",
          points: { $sum: "$pointsEarned" },
        },
      },
    ]);

    // Map sessionId -> points
    const pointsBySession = Object.fromEntries(
      scored.map((r) => [String(r._id), r.points || 0])
    );

    // For each quiz, mark status/score if the user has any response in any session
    const out = base.map((q) => {
      const sessIds = sessionsByQuiz[String(q._id)] || [];
      if (!sessIds.length)
        return { ...q, myStatus: "not_completed", myScore: null };
      const any = sessIds.some((sid) => pointsBySession[String(sid)] != null);
      const score = sessIds.reduce(
        (sum, sid) => sum + (pointsBySession[String(sid)] || 0),
        0
      );
      return {
        ...q,
        myStatus: any ? "completed" : "not_completed",
        myScore: any ? score : null,
      };
    });

    return res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/quizzes/:id
// Fetch a quiz by id (full doc). Populates courseId's name (if model has it).
// access  Authenticated
exports.byId = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate("courseId", "name")
      .lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/quizzes/:id
// Update quiz title/questions/settings
// access  Authenticated (no role enforcement here)
// If questions provided, they’re fully revalidated and normalized before save.
// Settings are shallow-merged into existing quiz.settings.

exports.updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, questions = [], settings = {} } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

     // Full question replace only if you send any
    if (questions.length) {
      const prepared = questions.map(preprocess);

      const errors = prepared
        .map((q, i) => {
          const e = validateQuestion(q);
          return e.length ? `Question ${i + 1}: ${e.join(", ")}` : null;
        })
        .filter(Boolean);

      if (errors.length) {
        return res.status(400).json({ message: "Validation errors", errors });
      }

      quiz.questions = prepared.map(normaliseQuestion);
    }

    if (title) quiz.title = title.trim();
    if (Object.keys(settings).length) {
      // Merge new settings into existing
      quiz.settings = { ...quiz.settings, ...settings };
    }

    await quiz.save();
    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

// DELETE /api/quizzes/:id
// Delete a quiz by id
// access  Authenticated (no role enforcement here)
exports.deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findByIdAndDelete(id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json({ message: "Quiz deleted successfully", id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};


// GET /api/quizzes/:id/session
// Student view: keep only what students need (strips author only view) (but also includes
// template & blanks for fill-in-the-blank
// modelAnswer for pose & discuss (used behind a “Reveal key points” button)

exports.getQuizForSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // 'lecturer' | 'student'
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    if (role === "student") {
      // Build a minimal, student-safe version of each question
      const cleaned = {
        ...quiz,
        questions: (quiz.questions || []).map((question, index) => {
          const studentQuestion = {
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            timeLimit: question.timeLimit,
            index, // preserve index for client
          };
// Include image if present
          if (question.image) {
            studentQuestion.image = question.image;
            studentQuestion.imageAlt = question.imageAlt || "";
          }
// Copy only student-facing fields per type
          switch (question.questionType) {
            case "mcq":
            case "poll":
              // Only answerText; no isCorrect flags
              studentQuestion.answers = (question.answers || []).map((a) => ({
                answerText: a.answerText,
              }));
              studentQuestion.shuffleOptions = !!question.shuffleOptions;
              break;

            case "word_cloud":
              studentQuestion.maxSubmissions = question.maxSubmissions;
              studentQuestion.allowAnonymous = question.allowAnonymous;
              break;

            case "pose_and_discuss":
              // Provide modelAnswer so the UI can reveal it on demand.
              if (question.modelAnswer) {
                studentQuestion.modelAnswer = question.modelAnswer;
              }
              break;

            case "fill_in_the_blank":
              // Include everything needed to render + grade on client/server.
              studentQuestion.template = question.template || "";
              studentQuestion.blanks =
                (question.blanks && question.blanks.length
                  ? question.blanks
                  : extractBlanks(question.template)) || [];
              studentQuestion.caseSensitive = !!question.caseSensitive;
              studentQuestion.trimWhitespace = !!question.trimWhitespace;
              break;

            default:
              break;
          }
          return studentQuestion;
        }),
      };
      return res.json(cleaned);
    }
 // Lecturer or unspecified role => return full quiz doc
    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
