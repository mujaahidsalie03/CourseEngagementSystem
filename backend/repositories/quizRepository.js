// repositories/quizRepository.js
const Quiz = require('../models/quizModel');

const create = (quizData) => {
  const quiz = new Quiz(quizData);
  return quiz.save();
};

const findByCourseId = (courseId) => {
  return Quiz.find({ courseId: courseId }).sort({ updatedAt: -1 });
};

// NEW: This function was added because it's required by the quizSessionService.
// It finds a quiz only if it also matches the lecturer's ID.
const findByIdAndLecturer = (quizId, lecturerId) => {
    return Quiz.findOne({ _id: quizId, createdBy: lecturerId });
};

module.exports = { 
  create, 
  findByCourseId, 
  findByIdAndLecturer // Export the new function
};
