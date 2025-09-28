const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/quizSessionController');

const quizSessionController = require("../controllers/quizSessionController");
// CREATE a new quiz session (Lecturer)
router.post('/', auth, c.createSession);

// JOIN a session (Student/Lecturer)
router.post('/join', auth, c.joinSession);

router.get('/by-code/:code', auth, c.getByCode);
router.get('/:id/participants', auth, c.participants);

/* Session details (last) */
router.get('/:sessionId', auth, c.getSession);


// START / PAUSE / RESUME / NEXT / END (Lecturer)
router.post('/:sessionId/start',  auth, c.startSession);
router.post('/:sessionId/pause',  auth, c.pauseSession);
router.post('/:sessionId/resume', auth, c.resumeSession);
router.post('/:sessionId/next',   auth, c.nextQuestion);
router.post('/:sessionId/end',    auth, c.endSession);

// SUBMIT an answer (Student)
router.post('/:sessionId/answer', auth, c.submitAnswer);

// RESULTS
router.get('/:sessionId/results', auth, c.getSessionResults);

// GET session details (lastss)
router.get('/:sessionId', auth, c.getSession);



module.exports = router;
