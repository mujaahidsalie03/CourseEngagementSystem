// models/responseModel.js
//Response model:
// One document per student's answer to a specific question in a specific session.
// Supports multiple question types by storing a flexible `selectedAnswer`.
// Maintains legacy fields for smooth migrations/old indexes.

const mongoose = require("mongoose");

 //Use these for all new reads/writes. Each response belongs to:
   //    - a session (QuizSession)
     //  - a student (User)
const responseSchema = new mongoose.Schema(
  {
    // --- Current canonical references ---
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizSession",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- Legacy field names (kept for existing unique index compatibility) 
   // Some older code/indexes used quizSessionId/studentId; keep them in sync
     //  in the pre-validate hook so old queries/indexes still work.
    quizSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizSession",
      default: null,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Question details
     // Zero-based index of the question within the quiz.
    questionIndex: {
      type: Number,
      required: true,
      min: 0,
    },

    // Answer data - flexible to support different question types
    // For FIB we may store an array; for MCQ/Poll/Text we store a string
    //Flexible shape to cover all types:
      // - MCQ/Poll/Text: string
       // FIB: array of strings (or pipe-separated string)
        //(room for future types)
    selectedAnswer: {
      type: mongoose.Schema.Types.Mixed, // string | array | object
      required: true,
    },

    // For MCQ - store the exact answer text selected when it's a string
    selectedAnswerText: { type: String },

    // Word cloud - optional multiple submissions
    wordCloudSubmissions: [
      {
        word: String,
        submittedAt: { type: Date, default: Date.now },
      },
    ],

    // Pose & Discuss - student's response
    discussionResponse: { type: String },

    // Scoring and feedback
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxPointsPossible: {
      type: Number,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },

    // Timing data
    timeSpent: {
      type: Number,
      default: 0, // seconds
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },

    // Additional metadata
    attemptNumber: {
      type: Number,
      default: 1,
    },
    ipAddress: { type: String },
    userAgent: { type: String },

    // Flags
    isLateSubmission: {
      type: Boolean,
      default: false,
    },
    wasAutoSubmitted: {
      type: Boolean,
      default: false,
    },

    // Feedback data (populated after quiz ends)
    feedback: {
      correctAnswer: { type: String },
      explanation: { type: String },
      wasShownToStudent: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// indexes
//Primary uniqueness: a student can submit at most once per question per session.
  // Additional helpers for common query patterns and legacy compatibility.
// Canonical unique key:
responseSchema.index(
  { session: 1, student: 1, questionIndex: 1 },
  { unique: true }
);
responseSchema.index({ session: 1, questionIndex: 1 }); // aggregate per-question
responseSchema.index({ student: 1, submittedAt: -1 }); // recent activity
responseSchema.index({ session: 1, isCorrect: 1 }); //correctness summaries

// Legacy unique key (sparse to avoid null collisions)
responseSchema.index(
  { quizSessionId: 1, studentId: 1, questionIndex: 1 },
  { unique: true, sparse: true }
);

// virtuals
responseSchema.virtual("accuracyPercentage").get(function () {
  return this.maxPointsPossible > 0
    ? (this.pointsEarned / this.maxPointsPossible) * 100
    : 0;
});

responseSchema.virtual("responseTime").get(function () {
  const seconds = this.timeSpent;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
});

//helpers
//Template parsers for {alt1|alt2} and {{alt1|alt2}} syntaxes.
  // (Duplicated intentionally to keep the model self-contained.
// Parse single-brace "{foo|bar}" templates
function parseBracedTemplate(tpl = "") {
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
// Parse double-brace "{{foo|bar}}" templates (your earlier create flow used this)
function parseDoubleBracedTemplate(tpl = "") {
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

//middleware
//Backfill legacy fields to keep old unique index valid.
  // Keep selectedAnswerText synced when selectedAnswer is a string.
   // Initialize attemptNumber on first write.
// Ensure legacy fields are filled from canonical ones so the legacy index always has values
responseSchema.pre("validate", function (next) {
  if (!this.quizSessionId && this.session) this.quizSessionId = this.session;
  if (!this.studentId && this.student) this.studentId = this.student;

  // Keep selectedAnswerText in sync for string answers
  if (typeof this.selectedAnswer === "string") {
    this.selectedAnswerText = this.selectedAnswer;
  }

  if (this.isNew) this.attemptNumber = 1;
  next();
});

//methods
//calculateScore(question):
  // Grades this response given the question config.
   // Updates pointsEarned, isCorrect, and maxPointsPossible in-place.
responseSchema.methods.calculateScore = function (question) {
  let pointsEarned = 0;
  let isCorrect = false;

  const type = String(question?.questionType || "").toLowerCase();

  switch (type) {
    case "mcq": {
      // Single-correct MCQ: compare answer text
      const correctAnswer = (question.answers || []).find((a) => a.isCorrect);
      if (correctAnswer && this.selectedAnswer === correctAnswer.answerText) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
    }
    case "poll": {
      // Participation points — any non-empty answer gets full points
      const has =
        (Array.isArray(this.selectedAnswer)
          ? this.selectedAnswer.join(" ")
          : String(this.selectedAnswer || "")
        ).trim().length > 0;
      if (has) {
        isCorrect = true; // not really "correct" but useful for stats
        pointsEarned = question.points;
      }
      break;
    }
    case "word_cloud": {
      if (this.selectedAnswer && this.selectedAnswer.toString().trim()) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
    }
    case "pose_and_discuss": {
      if (this.selectedAnswer && this.selectedAnswer.toString().trim()) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
    }
    case "fill_in_the_blank": {
      // normalize expected blanks into array-of-arrays
      const parseSingle = (tpl = "") => {
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
      };
      const parseDouble = (tpl = "") => {
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
      };

      let expected = Array.isArray(question.blanks) ? question.blanks : [];
      if (!expected.length && question.template) {
        expected = parseDouble(question.template);
        if (!expected.length) expected = parseSingle(question.template);
      }
      expected = expected.map((entry) => {
        if (Array.isArray(entry))
          return entry.map((s) => String(s).trim()).filter(Boolean);
        return String(entry)
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      });

      // Normalize given answers into an array
      const given = Array.isArray(this.selectedAnswer)
        ? this.selectedAnswer
        : String(this.selectedAnswer || "")
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);

      if (expected.length && given.length >= expected.length) {
        const caseSensitive = !!question.caseSensitive;
        const trim = question.trimWhitespace !== false;
        const norm = (s) => {
          let v = String(s ?? "");
          if (trim) v = v.trim();
          return caseSensitive ? v : v.toLowerCase();
        };

        // All blanks must match one of their allowed alternatives
        let allMatch = true;
        for (let i = 0; i < expected.length; i++) {
          const u = norm(given[i] ?? "");
          const ok = (expected[i] || []).some((alt) => norm(alt) === u);
          if (!ok) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          isCorrect = true;
          pointsEarned = question.points;
        }
      }
      break;
    }

    default:
      break;
  }

  // Persist computed fields on the document
  this.pointsEarned = pointsEarned;
  this.isCorrect = isCorrect;
  this.maxPointsPossible = question.points;

  return this;
};

// Attach feedback (e.g., after grading pass or quiz end)
responseSchema.methods.addFeedback = function (correctAnswer, explanation) {
  this.feedback = {
    correctAnswer,
    explanation,
    wasShownToStudent: false,
  };
  return this.save();
};

//statistics
responseSchema.statics.getSessionStats = function (sessionId) {
  return this.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: "$questionIndex",
        totalResponses: { $sum: 1 },
        correctResponses: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        avgTimeSpent: { $avg: "$timeSpent" },
        avgScore: { $avg: "$pointsEarned" },
        answers: { $push: "$selectedAnswer" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

responseSchema.statics.getStudentStats = function (
  studentId,
  sessionId = null
) {
  const match = { student: new mongoose.Types.ObjectId(studentId) };
  if (sessionId) match.session = new mongoose.Types.ObjectId(sessionId);

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$student",
        totalResponses: { $sum: 1 },
        correctResponses: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        totalPoints: { $sum: "$pointsEarned" },
        avgTimeSpent: { $avg: "$timeSpent" },
        sessions: { $addToSet: "$session" },
      },
    },
    {
      $project: {
        totalResponses: 1,
        correctResponses: 1,
        totalPoints: 1,
        avgTimeSpent: 1,
        accuracy: {
          $cond: [
            { $gt: ["$totalResponses", 0] },
            { $divide: ["$correctResponses", "$totalResponses"] },
            0,
          ],
        },
        sessionsCount: { $size: "$sessions" },
      },
    },
  ]);
};

responseSchema.statics.getLeaderboard = function (sessionId, limit = 10) {
  return this.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: "$student",
        totalPoints: { $sum: "$pointsEarned" },
        correctAnswers: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        totalAnswers: { $sum: 1 },
        avgTimeSpent: { $avg: "$timeSpent" },
      },
    },
    { $sort: { totalPoints: -1, avgTimeSpent: 1 } },
    { $limit: limit },
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
        email: { $arrayElemAt: ["$user.email", 0] },
        totalPoints: 1,
        correctAnswers: 1,
        totalAnswers: 1,
        accuracy: { $divide: ["$correctAnswers", "$totalAnswers"] },
        avgTimeSpent: 1,
      },
    },
  ]);
};

// Distribution for MCQ/Poll charts; keys are the raw selectedAnswer values.
responseSchema.statics.getAnswerDistribution = function (
  sessionId,
  questionIndex
) {
  return this.aggregate([
    {
      $match: {
        session: new mongoose.Types.ObjectId(sessionId),
        questionIndex: questionIndex,
      },
    },
    {
      $group: {
        _id: "$selectedAnswer",
        count: { $sum: 1 },
        avgTimeSpent: { $avg: "$timeSpent" },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

// Word cloud: tokenize by spaces, downcase, remove stopwords, and count.
responseSchema.statics.getWordCloudData = function (sessionId, questionIndex) {
  return this.aggregate([
    {
      $match: {
        session: new mongoose.Types.ObjectId(sessionId),
        questionIndex: questionIndex,
      },
    },
    {
      $project: {
        words: {
          $split: [{ $toLower: { $toString: "$selectedAnswer" } }, " "],
        },
      },
    },
    { $unwind: "$words" },
    {
      $match: {
        words: { $ne: "" },
        words: {
          $not: {
            $in: [
              "the",
              "a",
              "an",
              "and",
              "or",
              "but",
              "in",
              "on",
              "at",
              "to",
              "for",
              "of",
              "with",
              "by",
            ],
          },
        },
      },
    },
    {
      $group: {
        _id: "$words",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);
};

module.exports = mongoose.model("Response", responseSchema);
