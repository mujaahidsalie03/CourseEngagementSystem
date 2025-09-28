// repositories/sessionsRepository.js
// Data-access helpers around live quiz sessions and responses.
const Activity = require('../models/quizModel');
const Session = require('../models/quizSessionModel');
const Response = require('../models/responseModel');

//Find a quiz ("activity") by id, ensuring it was created by the lecturer.
exports.findActivityByLecturer = (activityId, lecturerId) =>
  Activity.findOne({ _id: activityId, createdBy: lecturerId });

//Create a new session.
// Expects payload matching QuizSession schema (e.g., { quiz, sessionCode, createdBy, ... }).
exports.createSession = (data) => Session.create(data);

//Find a session by id (returns a Mongoose doc; no .lean()).
exports.findSessionById = (id) => Session.findById(id);

//Find a *live* session by code and populate its "activity".
exports.findLiveSessionByCode = (code) =>
  Session.findOne({ joinCode: code, status: 'live' }).populate('activity');

// Find a session by id and populate the linked "activity".
exports.findSessionWithActivity = (id) =>
  Session.findById(id).populate('activity');

//Upsert a student's response for a question in a session.
exports.upsertResponse = (sessionId, questionIndex, studentId, answer) =>
  Response.findOneAndUpdate(
    { session: sessionId, questionIndex, student: studentId },
    { $set: { answer, answeredAt: new Date() } },
    { upsert: true, new: true }
  );

  //Aggregate counts per answer for a session (for charts).
exports.getAggregates = (sessionId) =>
  Response.aggregate([
    { $match: { session: sessionId } },
    { $group: { _id: { q: '$questionIndex', a: '$answer' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.q', options: { $push: { answer: '$_id.a', count: '$count' } } } },
    { $sort: { _id: 1 } }
  ]);
