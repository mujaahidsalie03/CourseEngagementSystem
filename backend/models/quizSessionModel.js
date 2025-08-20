const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  activity: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Activity', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'live', 'stopped'], 
    default: 'pending' },
  joinCode: { 
    type: String, 
    unique: true, 
    index: true },

  startedAt: Date,
  endedAt: Date
  
}, { timestamps: true });
module.exports = mongoose.model('Session', SessionSchema);
