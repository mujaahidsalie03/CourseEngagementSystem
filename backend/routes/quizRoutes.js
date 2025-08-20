const express = require('express');
const router = express.Router();
const {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
} = require('../controllers/quizController');

// POST /api/quizzes
// Creates a new quiz.
router.post('/', createQuiz);

// GET /api/quizzes/course/:courseId
// Gets all quizzes belonging to a specific course.
router.get('/course/:courseId', getQuizzesByCourse);

// GET /api/quizzes/:quizId
// Gets a single quiz by its unique ID.
router.get('/:quizId', getQuizById);

module.exports = router;