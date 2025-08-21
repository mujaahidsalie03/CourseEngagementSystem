const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const responseSchema = new Schema({
  quizSessionId: { type: Schema.Types.ObjectId, required: true, ref: 'QuizSession' },
  studentId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  questionIndex: { type: Number, required: true },
  // Storing the actual answer submitted is more flexible
  answer: { type: Schema.Types.Mixed, required: true }, 
  isCorrect: { type: Boolean, required: true },
  answeredAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  collection: 'responses'
});

// This unique index is a great idea to prevent duplicate answers
responseSchema.index({ quizSessionId: 1, questionIndex: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Response', responseSchema);
