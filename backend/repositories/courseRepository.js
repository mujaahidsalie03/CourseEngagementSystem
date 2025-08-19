const Course = require('../models/Course');
const User = require('../models/User');

//Creates a new course in the database and links it to the lecturer.
const create = async (courseData) => {
    const course = new Course(courseData);
    const createdCourse = await course.save();

    // Add the new course's ID to the lecturer's 'courses' array
    await User.findByIdAndUpdate(courseData.lecturerId, { $push: { courses: createdCourse._id } });

    return createdCourse;
};

//Finds all courses associated with a given user ID (either as a lecturer or a student).
const findByUserId = async (userID) => {
    // Find all courses where the user's ID is the lecturerId OR is present in the students array
    const courses = await Course.find({
    $or: [
      { lecturerId: userId },
      { students: userId }
    ]
    }).populate('lecturerId', 'name'); // Also fetch the lecturer's name for display
    return courses;
};

module.exports = {
  create,
  findByUserId,
};
