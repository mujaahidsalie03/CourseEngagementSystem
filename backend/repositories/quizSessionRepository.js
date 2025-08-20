const QuizSession = require('../models/quizSessionModel');

/**
 * Generates a random 5-character alphanumeric string for the session code.
 * @returns {string} A 5-character code.
 */
const generateSessionCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

/**
 * Creates a new quiz session in the database.
 * @param {string} quizId - The ID of the quiz to start a session for.
 * @returns {Promise<Document>} The saved quiz session document.
 */
const create = async (quizId) => {
  // TODO: Add logic to ensure the generated code is unique,
  // but for the prototype, a simple random code is sufficient.
  const sessionCode = generateSessionCode();

  const session = new QuizSession({
    quizId,
    sessionCode,
    status: 'active' // We'll set it to active immediately upon creation
  });

  return await session.save();
};

/**
 * Finds an active quiz session by its session code.
 * @param {string} sessionCode - The 5-character code for the session.
 * @returns {Promise<Document|null>} The session document if found, otherwise null.
 */
const findByCode = async (sessionCode) => {
  return await QuizSession.findOne({ sessionCode: sessionCode.toUpperCase(), status: 'active' });
};


 //Adds a student to a quiz session's participant list.
 const addParticipant = async (sessionId, studentId) => {
  // Use $addToSet instead of $push to prevent duplicate entries if a student tries to join twice.
  return await QuizSession.findByIdAndUpdate(
    sessionId,
    { $addToSet: { participants: studentId } },
    { new: true } // This option returns the updated document
  );
};


module.exports = {
  create,
  findByCode,
  addParticipant,
};
