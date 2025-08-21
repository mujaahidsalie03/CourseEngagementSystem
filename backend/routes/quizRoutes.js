// routes/quizRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const quizController = require('../controllers/quizController');

// create quiz (lecturer)
router.post('/', auth(), requireRole('lecturer'), quizController.createQuiz);

// list by course
router.get('/course/:courseId', auth(), quizController.byCourse);

// get by id
router.get('/:id', auth(), quizController.byId);

module.exports = router;
