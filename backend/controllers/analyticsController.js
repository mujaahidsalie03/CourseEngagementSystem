const Response = require('../models/responseModel');

exports.getStudentAnalyticsForCourse = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    // We will create this getStudentCourseStats function in the next step
    const stats = await Response.getStudentCourseStats(studentId, courseId);

    if (!stats) {
      return res.status(404).json({ message: 'No analytics found for this student in this course.' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Get student analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};