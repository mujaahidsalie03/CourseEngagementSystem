const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// A flexible sub-schema for an individual answer
const answerSchema = new Schema({
  answerText: { type: String, required: true, trim: true },
  isCorrect: { type: Boolean, required: true, default: false }
}, { _id: false });

// A feature-rich sub-schema for a question
const questionSchema = new Schema({
  questionType: {
    type: String,
    enum: ['mcq', 'truefalse', 'short_answer'],
    default: 'mcq'
  },
  questionText: { type: String, required: true, trim: true },
  points: { type: Number, default: 1, min: 0 },
  answers: [answerSchema]
}, { _id: false });

// The main schema for the Quiz
const quizSchema = new Schema({
  title: { type: String, required: true, trim: true },
  courseId: { type: Schema.Types.ObjectId, required: true, ref: 'Course' },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  questions: [questionSchema],
  isDraft: { type: Boolean, default: true }
}, { 
  timestamps: true,
  collection: 'quizzes'
});

module.exports = mongoose.model('Quiz', quizSchema);
