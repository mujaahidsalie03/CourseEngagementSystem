const responseRepository = require('../repositories/responseRepository');

// @desc    Submit an answer for a quiz question
// @route   POST /api/responses
// @access  Public (for demo)
const submitResponse = async (req, res) => {
  try {
    const { quizSessionId, studentId, questionIndex, selectedAnswerIndex } = req.body;

    if (quizSessionId === undefined || studentId === undefined || questionIndex === undefined || selectedAnswerIndex === undefined) {
      return res.status(400).json({ message: 'Missing required fields for response submission.' });
    }

    const newResponse = await responseRepository.create(req.body);

    // In the real app, this is where we would use Socket.IO to send a live update
    // to the lecturer's dashboard.
    // For now, just confirm the submission.
    res.status(201).json({ message: 'Response submitted successfully', response: newResponse });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while submitting response.' });
  }
};

module.exports = {
  submitResponse,
};
