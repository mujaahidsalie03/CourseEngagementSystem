const quizRepository = require('../repositories/quizRepository');

const createQuiz = async (req, res) => {
  try {
    const newQuiz = await quizRepository.create(req.body);
    res.status(201).json(newQuiz);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

const getQuizzesByCourse = async (req, res) => {
  try {
    const quizzes = await quizRepository.findByCourseId(req.params.courseId);
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

module.exports = { createQuiz, getQuizzesByCourse };