// backend/services/quizSessionService.js
const mongoose = require('mongoose');
const Course = require('../models/courseModel');
const Quiz = require('../models/quizModel');
const QuizSession = require('../models/quizSessionModel');
const Response = require('../models/responseModel');

const makeCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[0OIL]/g, 'X');

function oid(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid ID');
    err.status = 400;
    throw err;
  }
  return new mongoose.Types.ObjectId(id);
}

async function startSession(lecturerId, quizId) {
  console.log('[startSession] lecturerId =', lecturerId);
  console.log('[startSession] quizId      =', quizId);

  const qid = oid(quizId);
  const q = await Quiz.findById(qid).lean();

  if (!q) {
    const err = new Error('Quiz not found');
    err.status = 404;
    throw err;
  }

  const c = await Course.findById(q.courseId).lean();
  console.log('[startSession] quiz.courseId =', q.courseId);
  console.log('[startSession] course.lecturerId =', c?.lecturerId);

  if (!c) {
    const err = new Error('Course for quiz not found');
    err.status = 404;
    throw err;
  }

  // ✅ robust ObjectId comparison
  const lectOid = oid(lecturerId);
  if (!c.lecturerId || !lectOid.equals(c.lecturerId)) {
    const err = new Error('Not allowed to start this quiz');
    err.status = 403;
    throw err;
  }

  const session = await QuizSession.create({
    quizId: q._id,
    sessionCode: makeCode(),
    status: 'active',
    currentQuestionIndex: 0,
    startedAt: new Date(),
  });

  return session;
}

async function joinByCode(user, code) {
  if (user.role !== 'student') {
    const err = new Error('Students only');
    err.status = 403;
    throw err;
  }
  const session = await QuizSession.findOne({
    sessionCode: (code || '').toUpperCase(),
    status: 'active',
  }).populate('quizId');

  if (!session) {
    const err = new Error('Session not live or code invalid');
    err.status = 404;
    throw err;
  }
  return { sessionId: session._id, quiz: session.quizId };
}

async function submitAnswer(user, sessionId, questionIndex, selectedAnswerIndex) {
  if (user.role !== 'student') {
    const err = new Error('Students only');
    err.status = 403;
    throw err;
  }
  const sid = oid(sessionId);

  const session = await QuizSession.findById(sid).populate('quizId');
  if (!session || session.status !== 'active') {
    const err = new Error('Session not live');
    err.status = 400;
    throw err;
  }

  const q = session.quizId?.questions?.[questionIndex];
  if (!q) {
    const err = new Error('Bad questionIndex');
    err.status = 400;
    throw err;
  }

  const correctIndex = (q.answers || []).findIndex(a => a.isCorrect);
  const isCorrect = selectedAnswerIndex === correctIndex;
  const pointsEarned = isCorrect ? (q.points || 1) : 0;

  await Response.findOneAndUpdate(
    { session: session._id, student: user._id, questionIndex },
    {
      $set: {
        selectedAnswerIndex,
        isCorrect,
        pointsEarned,
        answeredAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  const agg = await Response.aggregate([
    { $match: { session: session._id, questionIndex } },
    { $group: { _id: '$selectedAnswerIndex', count: { $sum: 1 } } },
    { $project: { _id: 0, option: '$_id', count: 1 } },
    { $sort: { option: 1 } },
  ]);

  return { live: agg };
}

async function stopSession(lecturerId, sessionId) {
  const sid = oid(sessionId);
  const s = await QuizSession.findById(sid).populate('quizId');
  if (!s) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }

  const c = await Course.findById(s.quizId.courseId).lean();
  if (!c || !oid(lecturerId).equals(c.lecturerId)) {
    const err = new Error('Not allowed');
    err.status = 403;
    throw err;
  }

  s.status = 'finished';
  s.endedAt = new Date();
  await s.save();
  return { ok: true };
}

module.exports = { startSession, joinByCode, submitAnswer, stopSession };
