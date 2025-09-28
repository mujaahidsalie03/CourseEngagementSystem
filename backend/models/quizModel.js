// models/quizModel.js
//Quiz model:
// A quiz belongs to a course (courseId) and contains an array of questions.
// Supports MCQ, Poll, Word Cloud, Pose & Discuss, and Fill-in-the-Blank (FIB).
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
     // Displayed label for an option (MCQ or Poll)
    answerText: { type: String, required: true },
    // Only relevant for MCQ; Polls ignore correctness
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

// Optional media metadata. 
const imageSchema = new mongoose.Schema(
  {
    name: String, //original filename
    type: String, //MIME type
    size: Number, //bytes
    width: Number,
    height: Number,
    dataUrl: String, // dev/mock
    url: String,     //preferred: link to object storage/CDN
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    //prompt shown to students
    questionText: { type: String, default: '' },

    // Persist canonical type "fill_in_the_blank"
    // Canonical type names (controller normalizes older spellings)
    questionType: {
      type: String,
      enum: ['mcq', 'poll', 'word_cloud', 'pose_and_discuss', 'fill_in_the_blank'],
      required: true,
      default: 'mcq',
    },

     // Scoring + timing (per question)
    points: { type: Number, default: 1 },
    timeLimit: { type: Number, default: 60 },

     // MCQ / Poll configuration
    answers: { type: [answerSchema], default: [] },
    shuffleOptions: { type: Boolean, default: false }, // <— add this

     // Pose & Discuss (optional model answer for reveal)
    modelAnswer: { type: String, default: '' },

    // Word Cloud limits
    maxSubmissions: { type: Number, default: 1 },
    allowAnonymous: { type: Boolean, default: false },

    // Media (optional)
    image: imageSchema,
    imageAlt: { type: String, default: '' },

    // Fill in the Blank
    template: { type: String, default: '' },
    blanks: { type: [[String]], default: [] },      // store parsed blanks (optional)
    caseSensitive: { type: Boolean, default: false },
    trimWhitespace: { type: Boolean, default: true },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    //title for qiz
    title: { type: String, required: true },
    //owning course
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    //ordered lists of questions
    questions: { type: [questionSchema], default: [] },
    //Draft vs published flag (UI can hide drafts)
    isDraft: { type: Boolean, default: false },
     // Quiz-level behavior toggles
    settings: {
      showResultsAfterEach: { type: Boolean, default: true },
      allowLateJoin: { type: Boolean, default: true },
      shuffleQuestions: { type: Boolean, default: false },
    },
    // Creator metadata (lecturer)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true } // adds createdAt/updatedAt
);

// MCQ guard
//Ensures every MCQ has at least one correct option. Other validations
// (min answers, FIB blanks, etc.) are handled in controllers.

quizSchema.pre('save', function (next) {
  for (const q of this.questions) {
    if (q.questionType === 'mcq') {
      if (!q.answers || !q.answers.some(a => a.isCorrect)) {
        return next(new Error(`MCQ must have at least one correct answer`));
      }
    }
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
