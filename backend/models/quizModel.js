// models/quizModel.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    answerText: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
    size: Number,
    width: Number,
    height: Number,
    dataUrl: String, // dev/mock
    url: String,     // optional real URL
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, default: '' },

    // Persist canonical type "fill_in_the_blank"
    questionType: {
      type: String,
      enum: ['mcq', 'poll', 'word_cloud', 'pose_and_discuss', 'fill_in_the_blank'],
      required: true,
      default: 'mcq',
    },

    points: { type: Number, default: 1 },
    timeLimit: { type: Number, default: 60 },

    // MCQ / Poll
    answers: { type: [answerSchema], default: [] },
    shuffleOptions: { type: Boolean, default: false }, // <— add this

    // Pose & Discuss (optional)
    modelAnswer: { type: String, default: '' },

    // Word cloud
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
    title: { type: String, required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: { type: [questionSchema], default: [] },
    isDraft: { type: Boolean, default: false },
    settings: {
      showResultsAfterEach: { type: Boolean, default: true },
      allowLateJoin: { type: Boolean, default: true },
      shuffleQuestions: { type: Boolean, default: false },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Keep MCQ guard
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
