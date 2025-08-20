const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const quizSessionSchema = new Schema({
  quizId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Quiz' // Reference to the Quiz being run
  },
  sessionCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['not_started', 'active', 'finished'],
    default: 'not_started'
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  responses: [{
    type: Schema.Types.ObjectId,
    ref: 'Response' // Will create the Response model later
  }]
}, { 
  timestamps: true,
  // This tells Mongoose to use the collection named 'sessions'
  // instead of the default 'quizsessions'
  collection: 'sessions' 
});

module.exports = mongoose.model('QuizSession', quizSessionSchema);
