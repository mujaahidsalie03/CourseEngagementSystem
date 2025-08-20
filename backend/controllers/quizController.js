const quizRepository = require('../repositories/quizRepository');

// @desc    Create a new quiz
// @route   POST /api/quizzes
// @access  Public (for demo)
const createQuiz = async (req, res) => {
  try {
    const { title, courseId, questions } = req.body;
    if (!title || !courseId || !questions) {
      return res.status(400).json({ message: 'Title, courseId, and questions are required.' });
    }
    const newQuiz = await quizRepository.create({ title, courseId, questions });
    res.status(201).json(newQuiz);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while creating quiz.' });
  }
};

// @desc    Get all quizzes for a specific course
// @route   GET /api/quizzes/course/:courseId
// @access  Public (for demo)
const getQuizzesByCourse = async (req, res) => {
  try {
    const quizzes = await quizRepository.findByCourseId(req.params.courseId);
    res.json(quizzes);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while fetching quizzes.' });
  }
};

// @desc    Get a single quiz by its ID
// @route   GET /api/quizzes/:quizId
// @access  Public (for demo)
const getQuizById = async (req, res) => {
  try {
    const quiz = await quizRepository.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }
    res.json(quiz);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while fetching quiz.' });
  }
};

module.exports = {
  createQuiz,
  getQuizzesByCourse,
  getQuizById,
};
