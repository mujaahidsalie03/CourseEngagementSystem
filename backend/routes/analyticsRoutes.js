// backend/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

// Course-level analytics
router.get('/course/:courseId/summary', auth, ctrl.courseSummary);
router.get('/course/:courseId/trend',   auth, ctrl.courseTrend);
router.get('/course/:courseId/quizzes', auth, ctrl.courseQuizzes);

// Quiz-level analytics
router.get('/quiz/:quizId/summary', auth, ctrl.quizSummary);

// Student-level analytics (per users in a course)
router.get('/student/:studentId/course/:courseId/summary', auth, ctrl.studentCourseSummary);

module.exports = router;
