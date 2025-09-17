// controllers/courseController.js
const Course = require('../models/courseModel');

exports.listMineOrEnrolled = async (req, res) => {
  try {
    if (req.user.role === 'lecturer') {
      const items = await Course.find({ lecturerId: req.user._id }).lean();
      return res.json(items);
    }
    // students
    const items = await Course.find({ students: req.user._id }).lean();
    return res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { courseName, courseCode } = req.body;
    if (!courseName || !courseCode) {
      return res.status(400).json({ message: 'courseName and courseCode required' });
    }
    const c = await Course.create({ courseName, courseCode, lecturerId: req.user._id });
    res.status(201).json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.byId = async (req, res) => {
  try {
    const c = await Course.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
