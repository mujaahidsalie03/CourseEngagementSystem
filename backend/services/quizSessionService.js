const quizSessionRepository = require('../repositories/quizSessionRepository');
const quizRepository = require('../repositories/quizRepository');
const responseRepository = require('../repositories/responseRepository');
const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/**
 * Business logic to start a new quiz session.
 */
const startSession = async (quizId, lecturerId) => {
  // Verify the quiz exists and belongs to this lecturer
  const quiz = await quizRepository.findByIdAndLecturer(quizId, lecturerId);
  if (!quiz) {
    throw new Error('Quiz not found or you do not have permission to start it.');
  }

  const session = await quizSessionRepository.create({
    quizId,
    status: 'active',
    joinCode: makeCode(),
    startedAt: new Date()
  });
  
  return { sessionId: session._id, joinCode: session.joinCode };
};

/**
 * Business logic to stop an active quiz session.
 */
const stopSession = async (sessionId) => {
  const session = await quizSessionRepository.updateStatus(sessionId, 'finished');
  if (!session) {
    throw new Error('Session not found.');
  }
  return session; // Return the updated session
};

/**
 * Business logic for a student to join a session.
 */
const joinSession = async (sessionCode, studentId) => {
  const session = await quizSessionRepository.findLiveByCode(sessionCode);
  if (!session) {
    throw new Error('Active session with that code not found.');
  }
  
  await quizSessionRepository.addParticipant(session._id, studentId);
  return { sessionId: session._id, quiz: session.quizId };
};

/**
 * Business logic for a student to submit an answer.
 */
const submitAnswer = async (sessionId, studentId, answerData) => {
  const { questionIndex, answer } = answerData;
  return await responseRepository.createOrUpdate({ 
    quizSessionId: sessionId, 
    studentId, 
    questionIndex, 
    answer 
  });
};

/**
 * Business logic to get the aggregated results for a session.
 */
const getResults = async (sessionId) => {
  return await quizSessionRepository.getResults(sessionId);
};

module.exports = {
  startSession,
  stopSession,
  joinSession,
  submitAnswer,
  getResults,
};
