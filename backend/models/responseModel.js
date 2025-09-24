// models/responseModel.js
const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  // Session and user references
  session: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'QuizSession', 
    required: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Question details
  questionIndex: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Answer data - flexible to support different question types
  selectedAnswer: {
    type: mongoose.Schema.Types.Mixed, // Can be string, array, or object
    required: true
  },
  
  // For MCQ - store the exact answer text selected
  selectedAnswerText: { type: String },
  
  // For word cloud - can store multiple submissions
  wordCloudSubmissions: [{ 
    word: String, 
    submittedAt: { type: Date, default: Date.now } 
  }],
  
  // For pose and discuss - store the student's response
  discussionResponse: { type: String },
  
  // Scoring and feedback
  pointsEarned: { 
    type: Number, 
    default: 0,
    min: 0
  },
  maxPointsPossible: { 
    type: Number, 
    required: true 
  },
  isCorrect: { 
    type: Boolean, 
    default: false 
  },
  
  // Timing data
  timeSpent: { 
    type: Number, 
    default: 0 // in seconds
  },
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
  
  // Additional metadata
  attemptNumber: { 
    type: Number, 
    default: 1 
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Flags for different states
  isLateSubmission: { 
    type: Boolean, 
    default: false 
  },
  wasAutoSubmitted: { 
    type: Boolean, 
    default: false 
  },
  
  // Feedback data (populated after quiz ends)
  feedback: {
    correctAnswer: { type: String },
    explanation: { type: String },
    wasShownToStudent: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
responseSchema.index({ session: 1, student: 1, questionIndex: 1 }, { unique: true });
responseSchema.index({ session: 1, questionIndex: 1 });
responseSchema.index({ student: 1, submittedAt: -1 });
responseSchema.index({ session: 1, isCorrect: 1 });

// Virtuals
responseSchema.virtual('accuracyPercentage').get(function() {
  return this.maxPointsPossible > 0 ? (this.pointsEarned / this.maxPointsPossible) * 100 : 0;
});

responseSchema.virtual('responseTime').get(function() {
  // Format time spent in human-readable format
  const seconds = this.timeSpent;
  if (seconds < 60) {
    return `${seconds}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
});

// Pre-save middleware
responseSchema.pre('save', function(next) {
  // Ensure selectedAnswerText is set for MCQ responses
  if (typeof this.selectedAnswer === 'string') {
    this.selectedAnswerText = this.selectedAnswer;
  }
  
  // Validate response based on question type (if we have access to question data)
  if (this.isNew) {
    this.attemptNumber = 1; // First submission
  }
  
  next();
});

// Instance methods
responseSchema.methods.calculateScore = function(question) {
  let pointsEarned = 0;
  let isCorrect = false;

  switch (question.questionType) {
    case 'mcq':
      const correctAnswer = question.answers.find(a => a.isCorrect);
      if (correctAnswer && this.selectedAnswer === correctAnswer.answerText) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
      
    case 'word_cloud':
      // Word cloud gets participation points
      if (this.selectedAnswer && this.selectedAnswer.toString().trim()) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
      
    case 'pose_and_discuss':
      // Participation points for submitting an answer
      if (this.selectedAnswer && this.selectedAnswer.toString().trim()) {
        isCorrect = true;
        pointsEarned = question.points;
      }
      break;
  }

  this.pointsEarned = pointsEarned;
  this.isCorrect = isCorrect;
  this.maxPointsPossible = question.points;
  
  return this;
};

responseSchema.methods.addFeedback = function(correctAnswer, explanation) {
  this.feedback = {
    correctAnswer,
    explanation,
    wasShownToStudent: false
  };
  return this.save();
};

// Static methods
responseSchema.statics.getSessionStats = function(sessionId) {
  return this.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: '$questionIndex',
        totalResponses: { $sum: 1 },
        correctResponses: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        avgTimeSpent: { $avg: '$timeSpent' },
        avgScore: { $avg: '$pointsEarned' },
        answers: { $push: '$selectedAnswer' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

responseSchema.statics.getStudentStats = function(studentId, sessionId = null) {
  const matchConditions = { student: new mongoose.Types.ObjectId(studentId) };
  if (sessionId) {
    matchConditions.session = new mongoose.Types.ObjectId(sessionId);
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$student',
        totalResponses: { $sum: 1 },
        correctResponses: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        totalPoints: { $sum: '$pointsEarned' },
        avgTimeSpent: { $avg: '$timeSpent' },
        sessions: { $addToSet: '$session' }
      }
    },
    {
      $project: {
        totalResponses: 1,
        correctResponses: 1,
        totalPoints: 1,
        avgTimeSpent: 1,
        accuracy: { 
          $cond: {
            if: { $gt: ['$totalResponses', 0] },
            then: { $divide: ['$correctResponses', '$totalResponses'] },
            else: 0
          }
        },
        sessionsCount: { $size: '$sessions' }
      }
    }
  ]);
};

responseSchema.statics.getLeaderboard = function(sessionId, limit = 10) {
  return this.aggregate([
    { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: '$student',
        totalPoints: { $sum: '$pointsEarned' },
        correctAnswers: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        totalAnswers: { $sum: 1 },
        avgTimeSpent: { $avg: '$timeSpent' }
      }
    },
    { $sort: { totalPoints: -1, avgTimeSpent: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $project: {
        userId: '$_id',
        name: { $arrayElemAt: ['$user.name', 0] },
        email: { $arrayElemAt: ['$user.email', 0] },
        totalPoints: 1,
        correctAnswers: 1,
        totalAnswers: 1,
        accuracy: { $divide: ['$correctAnswers', '$totalAnswers'] },
        avgTimeSpent: 1
      }
    }
  ]);
};

responseSchema.statics.getAnswerDistribution = function(sessionId, questionIndex) {
  return this.aggregate([
    { 
      $match: { 
        session: new mongoose.Types.ObjectId(sessionId),
        questionIndex: questionIndex
      } 
    },
    {
      $group: {
        _id: '$selectedAnswer',
        count: { $sum: 1 },
        avgTimeSpent: { $avg: '$timeSpent' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

responseSchema.statics.getWordCloudData = function(sessionId, questionIndex) {
  return this.aggregate([
    { 
      $match: { 
        session: new mongoose.Types.ObjectId(sessionId),
        questionIndex: questionIndex
      } 
    },
    {
      $project: {
        words: {
          $split: [
            { $toLower: { $toString: '$selectedAnswer' } },
            ' '
          ]
        }
      }
    },
    { $unwind: '$words' },
    {
      $match: {
        'words': { $ne: '' },
        'words': { $not: { $in: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'] } }
      }
    },
    {
      $group: {
        _id: '$words',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 50 } // Top 50 words for word cloud
  ]);
};

// This is our new function
responseSchema.statics.getStudentCourseStats = async function(studentId, courseId) {
  const mongoose = require('mongoose');

  // 1. Find all quizzes that belong to the course
  const quizzesInCourse = await mongoose.model('Quiz').find({ courseId }).select('_id').lean();
  const quizIds = quizzesInCourse.map(q => q._id);

  // 2. Find all sessions for those quizzes
  const sessionsForQuizzes = await mongoose.model('QuizSession').find({ quiz: { $in: quizIds } }).select('_id').lean();
  const sessionIds = sessionsForQuizzes.map(s => s._id);

  // 3. Find all of the student's responses ONLY for those sessions
  const responses = await this.find({ 
    student: studentId, 
    session: { $in: sessionIds } 
  }).lean();

  if (responses.length === 0) {
    return null; // No data to analyze
  }

  // 4. Calculate the summary statistics
  const totalAnswers = responses.length;
  const correctAnswers = responses.filter(r => r.isCorrect).length;
  const totalPoints = responses.reduce((sum, r) => sum + r.pointsEarned, 0);
  const quizzesTakenCount = new Set(responses.map(r => r.session.toString())).size;
  const totalPossiblePoints = responses.reduce((sum, r) => sum + r.maxPointsPossible, 0);

  const summaryStats = {
    participationRate: (quizzesTakenCount / sessionsForQuizzes.length) * 100,
    averageScore: totalPossiblePoints > 0 ? (totalPoints / totalPossiblePoints) * 100 : 0,
    quizzesTaken: quizzesTakenCount,
    correctAnswers: correctAnswers,
    totalAnswers: totalAnswers,
  };

  // 5. Format data for the chart (simplified for now)
  // A full implementation would group by quiz title and average the score.
  const performanceOverTime = responses.map((r, index) => ({
    name: `Quiz ${index + 1}`,
    yourScore: (r.pointsEarned / r.maxPointsPossible) * 100,
  }));

  return { summaryStats, performanceOverTime };
};

module.exports = mongoose.model('Response', responseSchema);