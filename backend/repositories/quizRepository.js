// repositories/quizRepository.js
const Quiz = require('../models/quizModel');

exports.create = (data) => Quiz.create(data);

// 🔧 used by controllers – was missing before
exports.findById = (id) => Quiz.findById(id).lean();

exports.findByCourse = (courseId) => Quiz.find({ courseId }).lean();

exports.updateById = (id, patch) =>
  Quiz.findByIdAndUpdate(id, patch, { new: true });

exports.deleteById = (id) => Quiz.findByIdAndDelete(id);
