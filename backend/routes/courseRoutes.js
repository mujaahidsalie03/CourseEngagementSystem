const express = require('express');
const router = express.Router();
const { createCourse, getUserCourses } = require('../controllers/courseController');

// POST /api/courses
// Creates a new course.
router.post('/', createCourse);

// GET /api/courses/user/:userId
// Gets all courses for a specific user by their ID.
router.get('/user/:userId', getUserCourses);

module.exports = router;