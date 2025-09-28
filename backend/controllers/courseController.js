// controllers/courseController.js
// list courses (by role), create courses, and fetch by id.
// Assumes an auth middleware attaches `req.user` with `{ _id, role }`.
const Course = require('../models/courseModel');

// Model shape assumptions:
//   Course = {
//     courseName: String,
//     courseCode: String,
//     lecturerId: ObjectId (User),
//     students: [ObjectId (User)]
//   }

//Get courses for the current user
//Lecturers: returns all courses they own (lecturerId = req.user._id)
//Students: returns courses where they are enrolled (req.user._id in students[])


//relies on req.user being populated by prior auth middleware
// and that req.user.role is either lecturer or student.
exports.listMineOrEnrolled = async (req, res) => {
  try {
    if (req.user.role === 'lecturer') {

      //lecturers see courses they own
      const items = await Course.find({ lecturerId: req.user._id }).lean();
      return res.json(items);
    }
    // students see courses they are enrolled in
    const items = await Course.find({ students: req.user._id }).lean();
    return res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};


// Create a new course owned by the current user (as lecturer)
// POST /api/courses
exports.create = async (req, res) => {
  try {
    const { courseName, courseCode } = req.body;
    //fieldname validation
    if (!courseName || !courseCode) {
      return res.status(400).json({ message: 'courseName and courseCode required' });
    }

    // // Create course and assign current user as owner/lecturer
    const c = await Course.create({ courseName, courseCode, lecturerId: req.user._id });
    // Return the newly created course document
    res.status(201).json(c);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch a single course by its id
// route   GET /api/courses/:id
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
