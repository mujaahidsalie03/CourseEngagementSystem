// services/socketService.js
const mongoose = require('mongoose');
const Response = require('../models/responseModel');
const QuizSession = require('../models/quizSessionModel');
const Quiz = require('../models/quizModel');

class SocketService {
  constructor(io) {
    this.io = io;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Join session room
      socket.on('join_session', this.handleJoinSessionRoom.bind(this, socket));
      socket.on('joinSessionRoom', this.handleJoinSessionRoom.bind(this, socket));

      // Lecturer controls
      socket.on('start_quiz', this.handleStartQuiz.bind(this, socket));
      socket.on('next_question', this.handleNextQuestion.bind(this, socket));
      socket.on('pause_quiz', this.handlePauseQuiz.bind(this, socket));
      socket.on('resume_quiz', this.handleResumeQuiz.bind(this, socket));
      socket.on('end_quiz', this.handleEndQuiz.bind(this, socket));

      // Student interactions
      socket.on('submit_answer', this.handleSubmitAnswer.bind(this, socket));

      // Results and analytics
      socket.on('show_scoreboard', this.handleShowScoreboard.bind(this, socket));
      socket.on('show_question_results', this.handleShowQuestionResults.bind(this, socket));

      socket.on('disconnect', this.handleDisconnect.bind(this, socket));
    });
  }

// Start quiz
  async handleStartQuiz(socket, data) {
    try {
      const { sessionId, quizId } = data;

      const session = await QuizSession.findById(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // Use model method to start
      await session.startSession();

      // Get quiz and first question
      const quiz = await Quiz.findById(quizId);
      if (!quiz || quiz.questions.length === 0) {
        socket.emit('error', { message: 'Quiz not found or has no questions' });
        return;
      }

      const firstQuestion = this.prepareQuestionForStudents(quiz.questions[0], 0);

      this.io.to(`session:${sessionId}`).emit('quiz_started', {
        question: firstQuestion,
        questionIndex: 0,
        totalQuestions: quiz.questions.length
      });

      console.log(`Quiz started for session ${sessionId}`);
    } catch (error) {
      console.error('Start quiz error:', error);
      socket.emit('error', { message: 'Failed to start quiz' });
    }
  }

  // Next question
  async handleNextQuestion(socket, data) {
    try {
      const { sessionId, questionIndex } = data;

      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session || !session.quiz) {
        socket.emit('error', { message: 'Session or quiz not found' });
        return;
      }

      // Use a model method to advance question
      await session.advanceToQuestion(questionIndex);

      if (questionIndex >= session.quiz.questions.length) {
        this.io.to(`session:${sessionId}`).emit('quiz_finished');
        return;
      }

      const question = this.prepareQuestionForStudents(session.quiz.questions[questionIndex], questionIndex);

      this.io.to(`session:${sessionId}`).emit('next_question', {
        question,
        questionIndex,
        totalQuestions: session.quiz.questions.length
      });

      console.log(`Next question (${questionIndex}) sent for session ${sessionId}`);
    } catch (error) {
      console.error('Next question error:', error);
      socket.emit('error', { message: 'Failed to go to next question' });
    }
  }


  // Pause quiz
  async handlePauseQuiz(socket, data) {
    const { sessionId } = data;

    const session = await QuizSession.findById(sessionId);
    if (!session) return;

    await session.pauseSession();

    this.io.to(`session:${sessionId}`).emit('quiz_paused');
    console.log(`Quiz paused for session ${sessionId}`);
  }

  // Resume quiz
  async handleResumeQuiz(socket, data) {
    const { sessionId } = data;

    const session = await QuizSession.findById(sessionId);
    if (!session) return;

    await session.resumeSession();

    this.io.to(`session:${sessionId}`).emit('quiz_resumed');
    console.log(`Quiz resumed for session ${sessionId}`);
  }


// End quiz
  async handleEndQuiz(socket, data) {
    const { sessionId } = data;

    const session = await QuizSession.findById(sessionId);
    if (!session) return;

    await session.endSession();

    this.io.to(`session:${sessionId}`).emit('quiz_ended');
    console.log(`Quiz ended for session ${sessionId}`);
  }


  // Submit answer (from students)
  async handleSubmitAnswer(socket, data) {
    try {
      const { sessionId, questionIndex, answer, timeSpent = 0 } = data;
      const userId = socket.userId;

      if (!userId) {
        socket.emit('error', { message: 'User not identified' });
        return;
      }

      // Fetch session & quiz
      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session || !session.quiz) {
        socket.emit('error', { message: 'Session or quiz not found' });
        return;
      }

      const question = session.quiz.questions[questionIndex];
      if (!question) {
        socket.emit('error', { message: 'Invalid question index' });
        return;
      }

      // Create a new response
      const response = new Response({
        session: sessionId,
        student: userId,
        questionIndex,
        selectedAnswer: answer,
        maxPointsPossible: question.points,
        timeSpent
      });

      // Calculate score for this response
      response.calculateScore(question);
      await response.save();

      // Acknowledge student submission
      socket.emit('answer_submitted', {
        questionIndex,
        submittedAt: response.submittedAt,
        pointsEarned: response.pointsEarned,
        isCorrect: response.isCorrect
      });

      // Notify lecturer about the new response
      socket.to(`session:${sessionId}`).emit('new_response', {
        userId,
        questionIndex,
        submittedAt: response.submittedAt,
        pointsEarned: response.pointsEarned,
        isCorrect: response.isCorrect
      });

      console.log(`Answer persisted: student ${userId}, Q${questionIndex}, session ${sessionId}`);
    } catch (error) {
      console.error('Submit answer error:', error);
      socket.emit('error', { message: 'Failed to submit answer' });
    }
  }


  // Show scoreboard
  async handleShowScoreboard(socket, data) {
    try {
      const { sessionId, limit = 5 } = data;

      // Use the model’s built-in aggregation helper
      const scoreboard = await Response.getLeaderboard(sessionId, limit);

      this.io.to(`session:${sessionId}`).emit('scoreboard', { scoreboard });
      console.log(`Scoreboard sent for session ${sessionId}`);
    } catch (error) {
      console.error('Show scoreboard error:', error);
      socket.emit('error', { message: 'Failed to generate scoreboard' });
    }
  }

  // Show question results
  async handleShowQuestionResults(socket, data) {
    try {
      const { sessionId, questionIndex } = data;

      // Use the model’s built-in helper
      const results = await Response.getAnswerDistribution(sessionId, questionIndex);

      this.io.to(`session:${sessionId}`).emit('question_results', {
        questionIndex,
        results
      });

      console.log(`Question results sent for session ${sessionId}, question ${questionIndex}`);
    } catch (error) {
      console.error('Show question results error:', error);
      socket.emit('error', { message: 'Failed to get question results' });
    }
  }

  // Handle disconnect
  handleDisconnect(socket) {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (socket.sessionId && socket.userId && socket.userRole === 'student') {
      // Notify lecturer about participant leaving
      socket.to(`session:${socket.sessionId}`).emit('participant_left', {
        userId: socket.userId,
        leftAt: new Date()
      });
    }
  }

  // Helper methods
  async getSessionState(sessionId) {
    try {
      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session) return null;

      return {
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.quiz ? session.quiz.questions.length : 0
      };
    } catch (error) {
      console.error('Get session state error:', error);
      return null;
    }
  }

  prepareQuestionForStudents(question, index) {
    const studentQuestion = {
      questionText: question.questionText,
      questionType: question.questionType,
      points: question.points,
      timeLimit: question.timeLimit,
      index
    };

    // Add type-specific fields for students
    switch (question.questionType) {
      case 'mcq':
        // Remove isCorrect flag for students
        studentQuestion.answers = question.answers.map(answer => ({
          answerText: answer.answerText
        }));
        break;

      case 'word_cloud':
        studentQuestion.maxSubmissions = question.maxSubmissions;
        studentQuestion.allowAnonymous = question.allowAnonymous;
        break;

      case 'pose_and_discuss':
        // Don't send model answer to students initially
        break;
    }

    return studentQuestion;
  }
}

module.exports = SocketService;