// models/quizModel.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  answerText: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  points: { type: Number, default: 1 }, // allowed, defaults to 1
  answers: { type: [answerSchema], validate: v => Array.isArray(v) && v.length >= 2 },
}, { _id: false });

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  questions: { type: [questionSchema], default: [] },
  isDraft: { type: Boolean, default: false },
  // createdBy removed from required checks (can be null)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
