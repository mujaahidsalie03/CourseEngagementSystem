// routes/students.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Course = require('../models/courseModel');

// Small helper to coerce id into ObjectId when possible
const toId = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return String(v);
  }
};

//
// GET /api/students/me/courses
// Returns all courses the current user is enrolled in (student side).
// This endpoint is DEV-friendly:
// Reads user from req.user (middleware/auth), headers, or query.
//  Does NOT block on role; it only needs a user id to look up enrolments.
// Populates lecturer name (lecturerId.name) for the card UI.

router.get('/me/courses', async (req, res) => {
  try {
    const userId =
      req.user?._id ||
      req.header('x-user-id') ||
      req.query.userId ||
      req.body?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Missing user id' });
    }

    const uid = toId(userId);

    // Flexible matching across common field names
    const orFilters = [
      { students: uid },
      { enrolledStudents: uid },
      { enrolments: uid },
      { participants: uid },
    ];

    const courses = await Course.find({ $or: orFilters })
      .populate('lecturerId', 'name')
      .lean();

    // Normalize a minimal shape the front-end expects
    const out = courses.map((c) => ({
      _id: c._id,
      courseName: c.courseName || c.title || 'Untitled course',
      courseCode: c.courseCode || c.code || '',
      lecturerId: c.lecturerId
        ? { _id: c.lecturerId._id, name: c.lecturerId.name }
        : undefined,
    }));

    return res.json(out);
  } catch (err) {
    console.error('GET /api/students/me/courses error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
