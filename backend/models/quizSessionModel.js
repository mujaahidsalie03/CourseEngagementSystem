// models/quizSessionModel.js
//QuizSession model:
// Represents a single live session for a quiz (join code, status, timing).
// Tracks participants, settings, derived stats, and lifecycle methods.
const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  joinedAt: { 
    type: Date, 
    default: Date.now 
  },
  leftAt: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'disconnected'], 
    default: 'active' 
  }
}, { _id: false });

//A session belongs to a Quiz, has a short join code, status, timers, and
  // an in-document list of participants for quick access in dashboards.

const quizSessionSchema = new mongoose.Schema({
  // Core session data
  quiz: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Quiz', 
    required: true 
  },
  // Human-entered join code (uppercased + unique)
  sessionCode: { 
    type: String, 
    required: true, 
    unique: true, // DB-level unique index
    uppercase: true, // normalizes value before save
    minlength: 4,
    maxlength: 8
  },
  // Session owner (lecturer)
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Session state
  status: {
    type: String,
    enum: ['waiting', 'active', 'paused', 'completed'],
    default: 'waiting'
  },
  currentQuestionIndex: {
    type: Number,
    default: -1 // -1 means not started yet
  },
  
  // Timestamps
  startedAt: { type: Date },
  endedAt: { type: Date },
  lastActivityAt: { 
    type: Date, 
    default: Date.now 
  },
  
  // Participants
  participants: [participantSchema],
  
  // Session settings
  settings: {
    allowLateJoin: { type: Boolean, default: true },
    autoAdvance: { type: Boolean, default: false },
    timePerQuestion: { type: Number, default: 30 }, // seconds
    showResultsAfterEach: { type: Boolean, default: true },
    shuffleQuestions: { type: Boolean, default: false },
    showLeaderboard: { type: Boolean, default: true }
  },
  
  // Metadata
  totalQuestions: { type: Number, default: 0 },
  maxParticipants: { type: Number, default: 100 },
  
  // Session statistics (calculated fields)
  stats: {
    totalResponses: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
quizSessionSchema.index({ sessionCode: 1, status: 1 });
quizSessionSchema.index({ createdBy: 1, createdAt: -1 });
quizSessionSchema.index({ quiz: 1, createdAt: -1 });
quizSessionSchema.index({ status: 1, lastActivityAt: -1 });

// Virtuals
quizSessionSchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.filter(p => p.status === 'active').length : 0;
});

quizSessionSchema.virtual('duration').get(function() {
  if (this.startedAt && this.endedAt) {
    return Math.floor((this.endedAt - this.startedAt) / 1000); // Duration in seconds
  } else if (this.startedAt) {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
  return 0;
});

quizSessionSchema.virtual('isActive').get(function() {
  return this.status === 'active' || this.status === 'paused';
});

// Pre-save middleware to update totalQuestions and lastActivityAt
quizSessionSchema.pre('save', async function(next) {
  // Update lastActivityAt on any change
  this.lastActivityAt = new Date();
  
  // Set totalQuestions if not set
  if (this.totalQuestions === 0 && this.quiz) {
    try {
      const quiz = await mongoose.model('Quiz').findById(this.quiz);
      if (quiz) {
        this.totalQuestions = quiz.questions.length;
      }
    } catch (error) {
      console.error('Error setting totalQuestions:', error);
    }
  }
  
  next();
});

// Instance methods

// Start
quizSessionSchema.methods.startSession = async function() {
  if (this.status !== 'waiting') {
    throw new Error('Session can only be started from waiting state');
  }
  
  this.status = 'active';
  this.startedAt = new Date();
  this.currentQuestionIndex = 0;
  this.lastActivityAt = new Date();
  
  return this.save();
};

// Pause
quizSessionSchema.methods.pauseSession = async function() {
  if (this.status !== 'active') {
    throw new Error('Can only pause an active session');
  }
  
  this.status = 'paused';
  this.lastActivityAt = new Date();
  
  return this.save();
};

// Resume
quizSessionSchema.methods.resumeSession = async function() {
  if (this.status !== 'paused') {
    throw new Error('Can only resume a paused session');
  }
  
  this.status = 'active';
  this.lastActivityAt = new Date();
  
  return this.save();
};

// End
quizSessionSchema.methods.endSession = async function() {
  if (this.status === 'completed') {
    return this; // Already ended
  }
  
  this.status = 'completed';
  this.endedAt = new Date();
  this.lastActivityAt = new Date();
  
  return this.save();
};

// Add student
quizSessionSchema.methods.addParticipant = function(userId) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      joinedAt: new Date(),
      status: 'active'
    });
  } else if (existingParticipant.status === 'inactive') {
    existingParticipant.status = 'active';
    existingParticipant.joinedAt = new Date();
  }
  
  return this.save();
};

// Remove student
quizSessionSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.status = 'inactive';
    participant.leftAt = new Date();
  }
  
  return this.save();
};

quizSessionSchema.methods.canJoin = function() {
  return this.status === 'waiting' || 
         (this.status === 'active' && this.settings.allowLateJoin);
};

quizSessionSchema.methods.isExpired = function() {
  // Consider session expired if no activity for 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return this.lastActivityAt < twoHoursAgo && this.status !== 'completed';
};

// Static methods
quizSessionSchema.statics.findActiveByCode = function(sessionCode) {
  return this.findOne({
    sessionCode: sessionCode.toUpperCase(),
    status: { $in: ['waiting', 'active', 'paused'] }
  });
};

quizSessionSchema.statics.findByLecturer = function(lecturerId, options = {}) {
  const { status, limit = 10, skip = 0 } = options;
  
  let query = this.find({ createdBy: lecturerId });
  
  if (status) {
    query = query.where({ status });
  }
  
  return query
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('quiz', 'title')
    .exec();
};

quizSessionSchema.statics.getSessionStats = function(sessionId) {
  return this.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(sessionId) } },
    {
      $lookup: {
        from: 'responses',
        localField: '_id',
        foreignField: 'session',
        as: 'responses'
      }
    },
    {
      $project: {
        sessionCode: 1,
        status: 1,
        participantCount: { $size: '$participants' },
        totalResponses: { $size: '$responses' },
        averageScore: { $avg: '$responses.pointsEarned' },
        startedAt: 1,
        endedAt: 1,
        duration: {
          $cond: {
            if: { $and: ['$startedAt', '$endedAt'] },
            then: { $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 1000] },
            else: null
          }
        }
      }
    }
  ]);
};

// Cleanup expired sessions (run as background job)
quizSessionSchema.statics.cleanupExpiredSessions = async function() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  const result = await this.updateMany(
    {
      lastActivityAt: { $lt: twoHoursAgo },
      status: { $in: ['waiting', 'active', 'paused'] }
    },
    {
      status: 'completed',
      endedAt: new Date()
    }
  );
  
  return result;
};

/**
 * Advance session to a specific question index
 */
quizSessionSchema.methods.advanceToQuestion = async function(questionIndex) {
  // Validate index
  if (!this.quiz) {
    throw new Error('Quiz not populated in session');
  }

  if (questionIndex < 0 || questionIndex >= this.quiz.questions.length) {
    throw new Error('Invalid question index');
  }

  this.currentQuestionIndex = questionIndex;
  this.lastActivityAt = new Date();
  this.status = 'active'; // ensure session is marked active
  return this.save();
};


module.exports = mongoose.model('QuizSession', quizSessionSchema);