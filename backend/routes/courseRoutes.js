const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const courseController = require('../controllers/courseController');

// List my courses (lecturer = teaching, student = enrolled)
router.get('/', auth, courseController.listMineOrEnrolled);

// Create a course (lecturer only)
router.post('/', auth, requireRole('lecturer'), courseController.create);

// Get course by ID
router.get('/:id', auth, courseController.byId);

module.exports = router;
