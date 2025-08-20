const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schema for an individual answer
const answerSchema = new Schema({
  answerText: {
    type: String,
    required: true,
    trim: true
  },
  isCorrect: {
    type: Boolean,
    required: true,
    default: false
  }
}, { _id: false }); // _id: false prevents Mongoose from creating an _id for each answer

// Sub-schema for a question, which contains an array of answers
const questionSchema = new Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  answers: [answerSchema] // Array of answer sub-documents
}, { _id: false });

// Main schema for the Quiz
const quizSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  courseId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Course' // Link to the course this quiz belongs to
  },
  questions: [questionSchema] // Array of question sub-documents
}, { timestamps: true,
     collection: 'quizzes'
 });

module.exports = mongoose.model('Quiz', quizSchema);
