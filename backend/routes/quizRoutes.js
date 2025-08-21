const express = require('express');
const router = express.Router();
const { createQuiz, getQuizzesByCourse } = require('../controllers/quizController');

router.post('/', createQuiz);
router.get('/course/:courseId', getQuizzesByCourse);

module.exports = router;
