// repositories/quizSessionRepository.js
// Thin data-access layer for QuizSession.
// Keep controllers/services clean by centralizing common queries here.
const QuizSession = require('../models/quizSessionModel');

exports.create = (data) => QuizSession.create(data);

exports.findById = (id) => QuizSession.findById(id).lean();

exports.updateById = (id, patch) =>
  QuizSession.findByIdAndUpdate(id, patch, { new: true });

exports.findActiveByCode = (code) =>
  QuizSession.findOne({ sessionCode: code, status: 'active' }).lean();
