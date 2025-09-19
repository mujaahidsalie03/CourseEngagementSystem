// controllers/quizSessionController.js
const QuizSession = require('../models/quizSessionModel');
const Quiz = require('../models/quizModel');
const Response = require('../models/responseModel');
const mongoose = require('mongoose');

// Helper function to generate session code
const generateSessionCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to validate session access
const validateSessionAccess = (session, userId, userRole) => {
  if (userRole === 'lecturer') {
    // Lecturer must be the session creator
    return String(session.createdBy) === String(userId);
  } else if (userRole === 'student') {
    // Students can join if session allows it
    return session.status === 'waiting' || (session.status === 'active' && session.allowLateJoin);
  }
  return false;
};

// CREATE a new quiz session (Lecturer)
exports.createSession = async (req, res) => {
  try {
    const { quizId, allowLateJoin = true, autoAdvance = false } = req.body;
    const userId = req.body.userId; // Temporary: from request body

    if (!quizId) {
      return res.status(400).json({ message: 'Quiz ID is required' });
    }

    // Verify quiz exists
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Generate unique session code
    let sessionCode;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      sessionCode = generateSessionCode();
      const existing = await QuizSession.findOne({ sessionCode, status: { $ne: 'completed' } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ message: 'Failed to generate unique session code' });
    }

    const session = await QuizSession.create({
      quiz: quizId,
      sessionCode,
      createdBy: userId,
      status: 'waiting',
      currentQuestionIndex: -1, // -1 means not started yet
      allowLateJoin,
      autoAdvance,
      participants: [],
      settings: {
        allowLateJoin,
        autoAdvance,
        timePerQuestion: 30 // Default, can be overridden per question
      }
    });

    // Populate quiz details
    await session.populate('quiz', 'title questions');

    res.status(201).json({
      sessionId: session._id,
      sessionCode: session.sessionCode,
      quiz: session.quiz,
      status: session.status,
      settings: session.settings
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// JOIN a session (Student)
exports.joinSession = async (req, res) => {
  try {
    const { sessionCode } = req.body;
    const userId = req.body.userId;
    const userRole = req.body.role || 'student';

    if (!sessionCode) {
      return res.status(400).json({ message: 'Session code is required' });
    }

    // Find active session
    const session = await QuizSession.findOne({ 
      sessionCode,
      status: { $in: ['waiting', 'active'] }
    }).populate('quiz', 'title questions');

    if (!session) {
      return res.status(404).json({ message: 'Session not found or has ended' });
    }

    // Validate access
    if (!validateSessionAccess(session, userId, userRole)) {
      return res.status(403).json({ message: 'Cannot join this session' });
    }

    // Check if user already joined
    const existingParticipant = session.participants.find(
      p => String(p.user) === String(userId)
    );

    if (!existingParticipant) {
      // Add participant
      session.participants.push({
        user: userId,
        joinedAt: new Date(),
        status: 'active'
      });
      await session.save();
    }

    // Get socket.io instance from app
    const io = req.app.get('io');
    if (io && userRole === 'student') {
      // Notify lecturer about new participant
      io.to(`session:${session._id}`).emit('participant_joined', {
        userId,
        joinedAt: new Date(),
        participantCount: session.participants.length
      });
    }

    res.json({
      sessionId: session._id,
      sessionCode: session.sessionCode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      quiz: {
        _id: session.quiz._id,
        title: session.quiz.title,
        totalQuestions: session.quiz.questions.length
      }
    });

  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// START a session (Lecturer)
exports.startSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.body.userId;

    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Validate lecturer access
    if (!validateSessionAccess(session, userId, 'lecturer')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ message: 'Session has already started or ended' });
    }

    // Update session
    session.status = 'active';
    session.startedAt = new Date();
    session.currentQuestionIndex = 0;
    await session.save();

    // Get socket.io instance and emit quiz start
    const io = req.app.get('io');
    if (io) {
      const firstQuestion = prepareQuestionForStudents(session.quiz.questions[0], 0);
      
      io.to(`session:${sessionId}`).emit('quiz_started', {
        question: firstQuestion,
        questionIndex: 0,
        totalQuestions: session.quiz.questions.length,
        sessionStatus: 'active'
      });
    }

    res.json({
      sessionId: session._id,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      startedAt: session.startedAt
    });

  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET session details
exports.getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userRole = req.query.role || 'student';

    const session = await QuizSession.findById(sessionId)
      .populate('quiz')
      .populate('participants.user', 'name email');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const responseData = {
      sessionId: session._id,
      sessionCode: session.sessionCode,
      status: session.status,
      currentQuestionIndex: session.currentQuestionIndex,
      participantCount: session.participants.length,
      startedAt: session.startedAt,
      settings: session.settings
    };

    // Include different data based on role
    if (userRole === 'lecturer') {
      responseData.participants = session.participants;
      responseData.quiz = session.quiz; // Full quiz with answers
    } else {
      responseData.quiz = {
        _id: session.quiz._id,
        title: session.quiz.title,
        totalQuestions: session.quiz.questions.length
      };
      
      // Current question for students (if session is active)
      if (session.status === 'active' && session.currentQuestionIndex >= 0) {
        responseData.currentQuestion = prepareQuestionForStudents(
          session.quiz.questions[session.currentQuestionIndex],
          session.currentQuestionIndex
        );
      }
    }

    res.json(responseData);

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// SUBMIT answer (Student)
exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionIndex, answer, timeSpent = 0 } = req.body;
    const userId = req.body.userId;

    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Session is not active' });
    }

    if (questionIndex !== session.currentQuestionIndex) {
      return res.status(400).json({ message: 'Question index mismatch' });
    }

    const question = session.quiz.questions[questionIndex];
    if (!question) {
      return res.status(400).json({ message: 'Question not found' });
    }

    // Check if user already answered this question
    const existingResponse = await Response.findOne({
      session: sessionId,
      student: userId,
      questionIndex
    });

    if (existingResponse) {
      return res.status(400).json({ message: 'Answer already submitted for this question' });
    }

    // Calculate points based on question type
    let pointsEarned = 0;
    let isCorrect = false;

    switch (question.questionType) {
      case 'mcq':
        // Find if the selected answer is correct
        const selectedAnswer = question.answers.find(a => a.answerText === answer);
        if (selectedAnswer && selectedAnswer.isCorrect) {
          isCorrect = true;
          pointsEarned = question.points;
        }
        break;
        
      case 'word_cloud':
        // Word cloud submissions always get participation points
        if (answer && answer.trim()) {
          pointsEarned = question.points;
          isCorrect = true;
        }
        break;
        
      case 'pose_and_discuss':
        // Participation points for submitting an answer
        if (answer && answer.trim()) {
          pointsEarned = question.points;
          isCorrect = true;
        }
        break;

      case 'fill_in_the_blank':
        // somendra logic here
        break;

      case 'poll':
        // somendra logic here
        break;
    }

    // Save response
    const response = await Response.create({
      session: sessionId,
      student: userId,
      questionIndex,
      selectedAnswer: answer,
      pointsEarned,
      timeSpent,
      isCorrect,
      submittedAt: new Date()
    });

    // Emit to socket for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`session:${sessionId}`).emit('new_response', {
        userId,
        questionIndex,
        submittedAt: new Date(),
        responseCount: await Response.countDocuments({ session: sessionId, questionIndex })
      });
    }

    res.json({
      responseId: response._id,
      pointsEarned,
      isCorrect,
      submittedAt: response.submittedAt
    });

  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET session results/analytics
exports.getSessionResults = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get response statistics
    const responseStats = await Response.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: '$questionIndex',
          totalResponses: { $sum: 1 },
          correctResponses: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          avgTimeSpent: { $avg: '$timeSpent' },
          responses: { $push: '$selectedAnswer' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get leaderboard
    const leaderboard = await Response.aggregate([
      { $match: { session: new mongoose.Types.ObjectId(sessionId) } },
      {
        $group: {
          _id: '$student',
          totalPoints: { $sum: '$pointsEarned' },
          correctAnswers: { $sum: { $cond: ['$isCorrect', 1, 0] } },
          totalAnswers: { $sum: 1 }
        }
      },
      { $sort: { totalPoints: -1 } },
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
          totalPoints: 1,
          correctAnswers: 1,
          totalAnswers: 1,
          accuracy: { $divide: ['$correctAnswers', '$totalAnswers'] }
        }
      }
    ]);

    res.json({
      sessionId: session._id,
      sessionCode: session.sessionCode,
      quiz: {
        title: session.quiz.title,
        totalQuestions: session.quiz.questions.length
      },
      participantCount: session.participants.length,
      responseStats,
      leaderboard,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt
    });

  } catch (error) {
    console.error('Get session results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// END session (Lecturer)
exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.body.userId;

    const session = await QuizSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Validate lecturer access
    if (!validateSessionAccess(session, userId, 'lecturer')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    session.status = 'completed';
    session.endedAt = new Date();
    await session.save();

    // Emit session end
    const io = req.app.get('io');
    if (io) {
      io.to(`session:${sessionId}`).emit('quiz_ended', {
        message: 'Quiz has ended',
        endedAt: session.endedAt
      });
    }

    res.json({
      sessionId: session._id,
      status: session.status,
      endedAt: session.endedAt
    });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to prepare questions for students (remove sensitive data)
const prepareQuestionForStudents = (question, index) => {
  const studentQuestion = {
    questionText: question.questionText,
    questionType: question.questionType,
    points: question.points,
    timeLimit: question.timeLimit || 30,
    index
  };

  switch (question.questionType) {
    case 'mcq':
      studentQuestion.answers = question.answers.map(answer => ({
        answerText: answer.answerText
        // Don't include isCorrect for students
      }));
      break;
      
    case 'word_cloud':
      studentQuestion.maxSubmissions = question.maxSubmissions || 1;
      studentQuestion.allowAnonymous = question.allowAnonymous || false;
      break;
      
    case 'pose_and_discuss':
      // Don't send model answer to students initially
      break;
  }

  return studentQuestion;
};