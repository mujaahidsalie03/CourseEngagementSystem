const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quizSessionSchema = new Schema({
  quizId: { type: Schema.Types.ObjectId, required: true, ref: 'Quiz' },
  sessionCode: { type: String, required: true, unique: true, trim: true },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'active', 'finished'],
    default: 'pending'
  },
  currentQuestionIndex: { type: Number, default: 0 },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  responses: [{ type: Schema.Types.ObjectId, ref: 'Response' }],
  startedAt: { type: Date },
  endedAt: { type: Date }
}, { 
  timestamps: true,
  collection: 'sessions' 
});

module.exports = mongoose.model('QuizSession', quizSessionSchema);
