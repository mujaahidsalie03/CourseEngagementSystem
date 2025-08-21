// repositories/quizSessionRepository.js
const QuizSession = require('../models/quizSessionModel');

exports.create = (data) => QuizSession.create(data);

exports.findById = (id) => QuizSession.findById(id).lean();

exports.updateById = (id, patch) =>
  QuizSession.findByIdAndUpdate(id, patch, { new: true });

exports.findActiveByCode = (code) =>
  QuizSession.findOne({ sessionCode: code, status: 'active' }).lean();
