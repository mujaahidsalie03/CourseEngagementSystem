const mongoose = require('mongoose');
const ResponseSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  questionIndex: { type: Number, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answer: { type: mongoose.Schema.Types.Mixed, required: true },
  answeredAt: { type: Date, default: Date.now }
}, { timestamps: true });
ResponseSchema.index({ session:1, questionIndex:1, student:1 }, { unique: true });
module.exports = mongoose.model('Response', ResponseSchema);
