const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const quizController = require('../controllers/quizController');

// Get all quizzes for a specific course
router.get('/course/:courseId', auth, quizController.byCourse);

// Get quiz for live session (removes answers for students)
router.get('/:id/session', auth, quizController.getQuizForSession);

// Get a single quiz by ID (for viewing/editing)
router.get('/:id', auth, quizController.byId);

// Create a new quiz
router.post('/', auth, quizController.createQuiz);

// Update an existing quiz
router.put('/:id', auth, quizController.updateQuiz);

// Delete a quiz
router.delete('/:id', auth, quizController.deleteQuiz);

module.exports = router;
