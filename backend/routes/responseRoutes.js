const express = require('express');
const router = express.Router();
const { submitResponse } = require('../controllers/responseController');

// POST /api/responses
// Submits a student's answer to a question in a live session.
router.post('/', submitResponse);

module.exports = router;
