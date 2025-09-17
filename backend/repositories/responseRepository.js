// repositories/responseRepository.js
const mongoose = require('mongoose');
const Response = require('../models/responseModel');

exports.upsert = ({ session, student, questionIndex, selectedAnswerIndex, isCorrect, pointsEarned }) =>
  Response.findOneAndUpdate(
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

exports.aggregateCounts = (sessionId, questionIndex) =>
  Response.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId), questionIndex } },
    { $group: { _id: '$selectedAnswerIndex', count: { $sum: 1 } } },
    { $project: { _id: 0, option: '$_id', count: 1 } },
    { $sort: { option: 1 } },
  ]);
