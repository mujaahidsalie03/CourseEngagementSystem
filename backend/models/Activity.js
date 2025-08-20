const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'truefalse', 'short'], default: 'mcq' },
  text: { type: String, required: true },
  options: [String],
  correctIndex: { type: Number },
  points: { type: Number, default: 1 }
});

const ActivitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [QuestionSchema],
  isDraft: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Activity', ActivitySchema);  // <-- MUST be a model
