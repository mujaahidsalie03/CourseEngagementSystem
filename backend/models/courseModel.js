// models/courseModel.js
// Course model: represents a single course owned by a lecturer,
// with an enrolled students list. Used for "My Courses" and sessions.
const mongoose = require('mongoose');

//course scheme for document
const courseSchema = new mongoose.Schema({
  // Human-readable course title shown in the UI (e.g., "Data Structures")
  courseName: { type: String, required: true },
   // Canonical code used in listings/joins (e.g., "CSC2002S")
  courseCode: { type: String, required: true },
  // Owner of the course (must be a User with role 'lecturer')
  lecturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Enrolled students (array of User ObjectIds)
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Adds createdAt and updatedAt timestamps automatically
}, { timestamps: true });

//exports the module for use in controllers/ services
module.exports = mongoose.model('Course', courseSchema);
