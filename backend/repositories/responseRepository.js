const Response = require('../models/responseModel');
const QuizSession = require('../models/quizSessionModel');
const Quiz = require('../models/quizModel'); // We need the Quiz model to check if the answer is correct

/**
 * Creates a new response document and links it to the quiz session.
 * @param {object} responseData - Data for the response (quizSessionId, studentId, etc.).
 * @returns {Promise<Document>} The saved response document.
 */
const create = async (responseData) => {
  const { quizSessionId, studentId, questionIndex, selectedAnswerIndex } = responseData;

  // --- Logic to determine if the answer was correct ---
  // 1. Find the session to get the original quizId
  const session = await QuizSession.findById(quizSessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // 2. Find the original quiz to access the questions and answers
  const quiz = await Quiz.findById(session.quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  // 3. Check if the selected answer is the correct one
  const question = quiz.questions[questionIndex];
  const selectedAnswer = question.answers[selectedAnswerIndex];
  const isCorrect = selectedAnswer.isCorrect;
  // --- End of correctness logic ---

  // Create the new response document with the calculated 'isCorrect' value
  const response = new Response({
    quizSessionId,
    studentId,
    questionIndex,
    selectedAnswerIndex,
    isCorrect // Add the result of our check
  });

  const savedResponse = await response.save();

  // Also, add this response's ID to the session's 'responses' array
  await QuizSession.findByIdAndUpdate(quizSessionId, { $push: { responses: savedResponse._id } });

  return savedResponse;
};

module.exports = {
  create,
};
