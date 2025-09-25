// repositories/courseRepository.js
const Course = require('../models/courseModel');

exports.findById = (id) => Course.findById(id).lean();

exports.findByLecturer = (lecturerId) =>
  Course.find({ lecturerId }).lean();

exports.findForStudent = (studentId) =>
  Course.find({ students: studentId }).lean();
