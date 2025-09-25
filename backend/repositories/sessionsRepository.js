// repositories/sessionsRepository.js
const Activity = require('../models/quizModel');
const Session = require('../models/quizSessionModel');
const Response = require('../models/responseModel');

exports.findActivityByLecturer = (activityId, lecturerId) =>
  Activity.findOne({ _id: activityId, createdBy: lecturerId });

exports.createSession = (data) => Session.create(data);

exports.findSessionById = (id) => Session.findById(id);

exports.findLiveSessionByCode = (code) =>
  Session.findOne({ joinCode: code, status: 'live' }).populate('activity');

exports.findSessionWithActivity = (id) =>
  Session.findById(id).populate('activity');

exports.upsertResponse = (sessionId, questionIndex, studentId, answer) =>
  Response.findOneAndUpdate(
    { session: sessionId, questionIndex, student: studentId },
    { $set: { answer, answeredAt: new Date() } },
    { upsert: true, new: true }
  );

exports.getAggregates = (sessionId) =>
  Response.aggregate([
    { $match: { session: sessionId } },
    { $group: { _id: { q: '$questionIndex', a: '$answer' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.q', options: { $push: { answer: '$_id.a', count: '$count' } } } },
    { $sort: { _id: 1 } }
  ]);
