// routes/sessions.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const sessionsController = require('../controllers/sessionsController');

// Start a session
router.post('/', auth(), requireRole('lecturer'), sessionsController.startSession);

// Stop session
router.post('/:id/stop', auth(), requireRole('lecturer'), sessionsController.stopSession);

// Student join
router.post('/join', auth(), sessionsController.joinSession);

// Submit answer
router.post('/:id/answer', auth(), sessionsController.submitAnswer);

// Lecturer pulls aggregates
router.get('/:id/aggregate', auth(), requireRole('lecturer'), sessionsController.getAggregate);

// Health check
router.get('/ping', (req, res) => res.json({ ok: true, route: 'sessions' }));

module.exports = router;
