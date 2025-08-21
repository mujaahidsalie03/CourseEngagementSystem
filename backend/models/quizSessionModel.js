// models/quizSessionModel.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  sessionCode: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['active', 'finished'], default: 'active', index: true },
  currentQuestionIndex: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('QuizSession', sessionSchema);
