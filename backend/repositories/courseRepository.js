// repositories/courseRepository.js
// Thin data-access layer for the Course model.
// Returns lean (plain) objects suitable for JSON responses or lightweight reads.
const Course = require('../models/courseModel');

exports.findById = (id) => Course.findById(id).lean();

exports.findByLecturer = (lecturerId) =>
  Course.find({ lecturerId }).lean();

exports.findForStudent = (studentId) =>
  Course.find({ students: studentId }).lean();
