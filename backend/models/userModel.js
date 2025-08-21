// models/userModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['lecturer', 'student'], required: true },
  // CORRECTED: This is the definitive structure.
  // The 'courses' field has been removed to avoid confusion.
  teachingCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course"}],
  enrolledCourses : [{ type: mongoose.Schema.Types.ObjectId, ref: "Course"}],
  passwordHash: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
