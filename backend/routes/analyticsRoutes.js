const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

// Defines the route: GET /api/analytics/student/:studentId/course/:courseId
router.get('/student/:studentId/course/:courseId', auth, analyticsController.getStudentAnalyticsForCourse);

module.exports = router;