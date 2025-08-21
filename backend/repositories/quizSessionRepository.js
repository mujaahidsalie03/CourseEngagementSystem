const QuizSession = require('../models/quizSessionModel');
const Response = require('../models/responseModel');

const create = (sessionData) => {
  const session = new QuizSession(sessionData);
  return session.save();
};

const findById = (sessionId) => {
  return QuizSession.findById(sessionId);
};

const findLiveByCode = (sessionCode) => {
  return QuizSession.findOne({ sessionCode: sessionCode.toUpperCase(), status: 'active' }).populate('quizId');
};

const addParticipant = (sessionId, studentId) => {
  return QuizSession.findByIdAndUpdate(
    sessionId,
    { $addToSet: { participants: studentId } },
    { new: true }
  );
};

const updateStatus = (sessionId, status) => {
    const update = { status };
    if (status === 'finished') {
        update.endedAt = new Date();
    }
    return QuizSession.findByIdAndUpdate(sessionId, update, { new: true });
};

// Logic from your teammate's `getAggregates`
const getResults = (sessionId) => {
  return Response.aggregate([
    { $match: { quizSessionId: new mongoose.Types.ObjectId(sessionId) } },
    { $group: { _id: { questionIndex: '$questionIndex', answer: '$answer' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.questionIndex', options: { $push: { answer: '$_id.answer', count: '$count' } } } },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = { create, findById, findLiveByCode, addParticipant, updateStatus, getResults };

