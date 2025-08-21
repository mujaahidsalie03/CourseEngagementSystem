const express = require('express');
const router = express.Router();
const { 
  startSession, 
  stopSession, 
  joinSession, 
  submitAnswer, 
  getSessionResults 
} = require('../controllers/quizSessionController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.post('/start', auth(), requireRole('lecturer'), startSession);
router.post('/:sessionId/stop', auth(), requireRole('lecturer'), stopSession);
router.get('/:sessionId/results', auth(), requireRole('lecturer'), getSessionResults);
router.post('/join', auth(), requireRole('student'), joinSession);
router.post('/:sessionId/answer', auth(), requireRole('student'), submitAnswer);
router.get('/ping', (req, res) => res.json({ status: 'ok', message: 'Quiz Session service is running' }));

module.exports = router;
