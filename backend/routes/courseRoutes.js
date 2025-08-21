// routes/courseRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const courseController = require('../controllers/courseController');

// list my courses (lecturer = teaching, student = enrolled)
router.get('/', auth(), courseController.listMineOrEnrolled);

// create a course (lecturer)
router.post('/', auth(), requireRole('lecturer'), courseController.create);

// get by id
router.get('/:id', auth(), courseController.byId);

module.exports = router;
