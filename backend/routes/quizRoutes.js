const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const quizController = require('../controllers/quizController');
// ⬇️ Add this import
const quizSessionController = require('../controllers/quizSessionController');

// Get all quizzes for a specific course
router.get('/course/:courseId', auth, quizController.byCourse);

// ⚠️ Put this BEFORE '/:id' so it doesn't get shadowed
router.get('/:quizId/my-review', auth, quizSessionController.getMyQuizReview);

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
