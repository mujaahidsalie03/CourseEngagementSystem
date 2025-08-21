const Response = require('../models/responseModel');
const QuizSession = require('../models/quizSessionModel');
const Quiz = require('../models/quizModel');

const createOrUpdate = async (responseData) => {
  const { quizSessionId, studentId, questionIndex, answer } = responseData;

  const session = await QuizSession.findById(quizSessionId).populate('quizId');
  if (!session) throw new Error('Session not found or not active.');

  const question = session.quizId.questions[questionIndex];
  if (!question) throw new Error('Question index is out of bounds');
  
  let isCorrect = false;
  
  if (question.questionType === 'mcq') {
      const selectedAnswer = question.answers.find(a => a.answerText === answer);
      isCorrect = selectedAnswer ? selectedAnswer.isCorrect : false;
  }
  // Add logic for other question types here if needed

  // This upsert logic is great for allowing answer changes
  return Response.findOneAndUpdate(
    { quizSessionId, studentId, questionIndex },
    { $set: { answer, isCorrect, answeredAt: new Date() } },
    { upsert: true, new: true }
  );
};

module.exports = { createOrUpdate };
