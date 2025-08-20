const Quiz = require('../models/quizModel');

/**
 * Creates a new quiz in the database.
 * @param {object} quizData - Data for the new quiz (title, courseId, questions).
 * @returns {Promise<Document>} The saved quiz document.
 */
const create = async (quizData) => {
  const quiz = new Quiz(quizData);
  return await quiz.save();
};

/**
 * Finds all quizzes associated with a specific course ID.
 * @param {string} courseId - The ID of the course.
 * @returns {Promise<Array<Document>>} An array of quiz documents.
 */
const findByCourseId = async (courseId) => {
  return await Quiz.find({ courseId: courseId });
};

/**
 * Finds a single quiz by its ID.
 * @param {string} quizId - The ID of the quiz.
 * @returns {Promise<Document|null>} The quiz document or null if not found.
 */
const findById = async (quizId) => {
  return await Quiz.findById(quizId);
};

module.exports = {
  create,
  findByCourseId,
  findById,
};
