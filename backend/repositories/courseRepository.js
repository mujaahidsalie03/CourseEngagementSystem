// repositories/courseRepository.js
const Course = require('../models/courseModel');
const User = require('../models/userModel');

const create = async (courseData) => {
    const course = new Course(courseData);
    const createdCourse = await course.save();

    // CORRECTED: This now correctly pushes to the 'teachingCourses' array for a lecturer.
    await User.findByIdAndUpdate(courseData.lecturerId, { $push: { teachingCourses: createdCourse._id } });

    return createdCourse;
};

const findByUserId = async (userId) => {
    const courses = await Course.find({
      $or: [
        { lecturerId: userId },
        { students: userId }
      ]
    }).populate('lecturerId', 'name');
    
    return courses;
};

module.exports = {
  create,
  findByUserId,
};
