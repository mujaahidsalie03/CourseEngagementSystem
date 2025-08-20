const express = require('express');
const router = express.Router();
const { startSession, joinSession } = require('../controllers/quizSessionController');

// POST /api/sessions/start
// Creates a new live session for a quiz.
router.post('/start', startSession);

// POST /api/sessions/join
// Allows a student to join an active session.
router.post('/join', joinSession);

module.exports = router;