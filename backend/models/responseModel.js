// models/responseModel.js
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizSession', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  questionIndex: { type: Number, required: true },
  selectedAnswerIndex: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  pointsEarned: { type: Number, default: 0 },
  answeredAt: { type: Date, default: Date.now },
}, { timestamps: true });

responseSchema.index({ session: 1, student: 1, questionIndex: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);
