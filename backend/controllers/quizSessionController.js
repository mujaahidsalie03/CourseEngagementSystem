// controllers/quizSessionController.js
const mongoose = require('mongoose');
const Quiz = require('../models/quizModel');
const Course = require('../models/courseModel');
const QuizSession = require('../models/quizSessionModel');
const Response = require('../models/responseModel');

const code = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[0OIL]/g, 'X');

// POST /api/sessions/start  (lecturer)
exports.start = async (req, res) => {
  try {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ message: 'quizId required' });

    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const course = await Course.findById(quiz.courseId).lean();
    if (!course || String(course.lecturerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const s = await QuizSession.create({
      quizId: quiz._id,
      sessionCode: code(),
      status: 'active',
      currentQuestionIndex: 0
    });

    return res.status(201).json({ sessionId: s._id, sessionCode: s.sessionCode });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/sessions/join  (student)
exports.join = async (req, res) => {
  try {
    const raw = req.body.code || req.body.sessionCode || req.body.quizCode;
    if (!raw) return res.status(400).json({ message: 'code required' });
    const codeVal = String(raw).toUpperCase();

    const s = await QuizSession.findOne({ sessionCode: codeVal, status: 'active' })
      .populate('quizId');
    if (!s) return res.status(404).json({ message: 'Session not live or code invalid' });

    return res.json({ sessionId: s._id, quiz: s.quizId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/sessions/:id/answer  (student)
exports.answer = async (req, res) => {
  try {
    const { questionIndex, selectedAnswerIndex } = req.body;
    const sessionId = req.params.id;

    if (typeof questionIndex !== 'number' || typeof selectedAnswerIndex !== 'number') {
      return res.status(400).json({ message: 'questionIndex and selectedAnswerIndex required' });
    }

    const s = await QuizSession.findById(sessionId).lean();
    if (!s || s.status !== 'active') return res.status(400).json({ message: 'Session not live' });

    const quiz = await Quiz.findById(s.quizId).lean();
    const q = quiz?.questions?.[questionIndex];
    if (!q) return res.status(400).json({ message: 'Bad questionIndex' });

    const correctIndex = (q.answers || []).findIndex(a => !!a.isCorrect);
    const isCorrect = selectedAnswerIndex === correctIndex;
    const pointsEarned = isCorrect ? (q.points || 1) : 0;

    await Response.findOneAndUpdate(
      { session: s._id, student: req.user._id, questionIndex },
      {
        $set: {
          selectedAnswerIndex,
          isCorrect,
          pointsEarned,
          answeredAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    // live results (bar chart bins per option)
    const agg = await Response.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(sessionId), questionIndex } },
      { $group: { _id: '$selectedAnswerIndex', count: { $sum: 1 } } },
      { $project: { _id: 0, option: '$_id', count: 1 } },
      { $sort: { option: 1 } }
    ]);

    req.app.get('io').to(`session:${sessionId}`).emit('live_results', {
      bins: agg,
      index: questionIndex
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/sessions/:id/stop (lecturer)
exports.stop = async (req, res) => {
  try {
    const s = await QuizSession.findById(req.params.id).populate('quizId');
    if (!s) return res.status(404).json({ message: 'Not found' });

    const course = await Course.findById(s.quizId.courseId).lean();
    if (!course || String(course.lecturerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    s.status = 'finished';
    s.endedAt = new Date();
    await s.save();

    req.app.get('io').to(`session:${s._id}`).emit('end_quiz');
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

// OPTIONAL: GET /api/sessions/:id/scoreboard  (top N)
exports.scoreboard = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 3));
    const sessionId = req.params.id;
    const sid = new mongoose.Types.ObjectId(sessionId);
    const top = await Response.aggregate([
      { $match: { session: sid } },
      { $group: { _id: '$student', total: { $sum: '$pointsEarned' } } },
      { $sort: { total: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { _id: 0, name: '$u.name', total: 1 } },
    ]);
    res.json({ top });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
