const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const quizSessionController = require('../controllers/quizSessionController');

// CREATE a new quiz session (Lecturer only)
router.post('/', auth, quizSessionController.createSession);

// JOIN a session using session code (Student/Lecturer)
router.post('/join', auth, quizSessionController.joinSession);

// START a session (Lecturer only)
router.post('/:sessionId/start', auth, quizSessionController.startSession);

// SUBMIT an answer to current question (Student only)
router.post('/:sessionId/answer', auth, quizSessionController.submitAnswer);

// GET session results/analytics (Lecturer/Student)
router.get('/:sessionId/results', auth, quizSessionController.getSessionResults);

// END a session (Lecturer only)
router.post('/:sessionId/end', auth, quizSessionController.endSession);

// GET session details (generic, last!)
router.get('/:sessionId', auth, quizSessionController.getSession);

module.exports = router;
