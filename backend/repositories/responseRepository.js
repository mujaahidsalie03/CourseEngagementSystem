// repositories/responseRepository.js
// Thin data-access helpers for Response documents.
const mongoose = require('mongoose');
const Response = require('../models/responseModel');

//Upsert a student's response for a given session+question.
//Matches on the unique key (session, student, questionIndex).
// Sets answer index, correctness, and points; updates answeredAt.
exports.upsert = ({ session, student, questionIndex, selectedAnswerIndex, isCorrect, pointsEarned }) =>
  Response.findOneAndUpdate(
    // Match the canonical unique key
    { session, student, questionIndex },
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

  A//ggregate counts for a question to build distribution charts.
  //Groups by selectedAnswerIndex and returns { option, count } sorted by option.
exports.aggregateCounts = (sessionId, questionIndex) =>
  Response.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId), questionIndex } },
    { $group: { _id: '$selectedAnswerIndex', count: { $sum: 1 } } },
    { $project: { _id: 0, option: '$_id', count: 1 } },
    { $sort: { option: 1 } },
  ]);
