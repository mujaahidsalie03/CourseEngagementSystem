// controllers/quizController.js
const Quiz = require('../models/quizModel');
const Course = require('../models/courseModel');

exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions = [] } = req.body;
    if (!courseId || !title) return res.status(400).json({ message: 'courseId and title required' });

    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    if (String(course.lecturerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Normalize questions: ensure points default, trim text
    const norm = (questions || []).map(q => ({
      questionText: (q.questionText || '').trim(),
      points: typeof q.points === 'number' ? q.points : 1,
      answers: (q.answers || []).map(a => ({
        answerText: (a.answerText || '').trim(),
        isCorrect: !!a.isCorrect
      }))
    }));

    const quiz = await Quiz.create({
      title: title.trim(),
      courseId,
      questions: norm,
      isDraft: false,
      createdBy: req.user._id
    });
    res.status(201).json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.byCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const items = await Quiz.find({ courseId }).lean();
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.byId = async (req, res) => {
  try {
    const q = await Quiz.findById(req.params.id).lean();
    if (!q) return res.status(404).json({ message: 'Not found' });
    res.json(q);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
