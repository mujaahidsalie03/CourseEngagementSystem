const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['lecturer', 'student'],
    required: true
  },
  
  enrolledCourses : [{ type: mongoose.Schema.Types.ObjectId, ref: "Course"}], // student
  teachingCourses : [{ type: mongoose.Schema.Types.ObjectId, ref: "Course"}], // lecturer

  courses: {
    type: [String],
    default: []
  },
  passwordHash: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);