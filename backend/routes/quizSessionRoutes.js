// routes/quizSessionRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const sessionCtrl = require('../controllers/quizSessionController');

// start a session (lecturer)
router.post('/start', auth(), requireRole('lecturer'), sessionCtrl.start);

// join a session (student)
router.post('/join', auth(), requireRole('student'), sessionCtrl.join);

// answer a question (student)
router.post('/:id/answer', auth(), requireRole('student'), sessionCtrl.answer);

// stop a session (lecturer)
router.post('/:id/stop', auth(), requireRole('lecturer'), sessionCtrl.stop);

// optional scoreboard endpoint
router.get('/:id/scoreboard', auth(), sessionCtrl.scoreboard);

module.exports = router;
