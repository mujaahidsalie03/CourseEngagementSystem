const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const responseSchema = new Schema({
  quizSessionId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'QuizSession' // Link to the live session
  },
  studentId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User' // Link to the student who answered
  },
  questionIndex: {
    type: Number,
    required: true // The index of the question in the quiz's question array
  },
  selectedAnswerIndex: {
    type: Number,
    required: true // The index of the answer the student chose
  },
  isCorrect: {
    type: Boolean,
    required: true // Pre-calculated for easier analytics
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true, 
  collection: 'responses'
});

module.exports = mongoose.model('Response', responseSchema);
