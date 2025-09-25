// controllers/quizController.js
const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const Course = require("../models/courseModel");
const QuizSession = require("../models/quizSessionModel");
const Response = require("../models/responseModel");

/* --------------------------------- Helpers -------------------------------- */

// Parse blanks from single-brace templates:  "A {stack|STACK}"
// -> returns [["stack","STACK"], ...]
const extractBlanks = (template = "") =>
  (template.match(/\{([^}]+)\}/g) || []).map((m) =>
    m
      .slice(1, -1)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean)
  );

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
    const blanks = q.blanks.length ? q.blanks : extractBlanks(q.template);
    if (!q.template) errors.push("Template is required");
    if (!blanks.length) errors.push("No blanks detected");
  }

  return errors;
};

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

/* --------------------------------- Routes --------------------------------- */

// POST /api/quizzes
exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions = [], settings = {} } = req.body;

    if (!courseId || !title) {
      return res
        .status(400)
        .json({ message: "courseId and title are required." });
    }

    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

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

    const quiz = await Quiz.create({
      title: title.trim(),
      courseId,
      questions: prepared.map(normaliseQuestion),
      settings: {
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

/**
 * GET /api/quizzes/course/:courseId
 * Returns quizzes for a course and annotates, per logged-in student:
 *  - myStatus: 'completed' | 'not_completed'
 *  - myScore : sum of pointsEarned across that student's responses
 */
exports.byCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Base list
    const quizzes = await Quiz.find({ courseId })
      .select("title createdAt updatedAt isDraft questions settings")
      .lean();

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
      req.header("x-user-id") ||
      req.query.userId ||
      req.body?.userId;

    if (!userId || quizIds.length === 0) {
      return res.json(base);
    }

    const uid = new mongoose.Types.ObjectId(String(userId));

    // Sessions that used any of these quizzes
    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id quiz")
      .lean();

    if (!sessions.length) {
      return res.json(
        base.map((q) => ({ ...q, myStatus: "not_completed", myScore: null }))
      );
    }

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

    const pointsBySession = Object.fromEntries(
      scored.map((r) => [String(r._id), r.points || 0])
    );

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
exports.updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, questions = [], settings = {} } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

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

/**
 * GET /api/quizzes/:id/session
 * Student view: keep only what students need (but DO include
 * - template & blanks for fill-in-the-blank
 * - modelAnswer for pose & discuss (used behind a “Reveal key points” button)
 */
exports.getQuizForSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // 'lecturer' | 'student'
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    if (role === "student") {
      const cleaned = {
        ...quiz,
        questions: (quiz.questions || []).map((question, index) => {
          const studentQuestion = {
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            timeLimit: question.timeLimit,
            index,
          };

          if (question.image) {
            studentQuestion.image = question.image;
            studentQuestion.imageAlt = question.imageAlt || "";
          }

          switch (question.questionType) {
            case "mcq":
            case "poll":
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

    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
