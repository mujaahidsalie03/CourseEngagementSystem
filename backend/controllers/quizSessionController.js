const quizSessionRepository = require('../repositories/quizSessionRepository');

// @desc    Start a new quiz session for a given quiz
// @route   POST /api/sessions/start
// @access  Public (for demo)
const startSession = async (req, res) => {
  try {
    const { quizId } = req.body;
    if (!quizId) {
      return res.status(400).json({ message: 'Quiz ID is required to start a session.' });
    }

    const session = await quizSessionRepository.create(quizId);
    res.status(201).json(session);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while starting session.' });
  }
};

// @desc    Allow a student to join an active quiz session
// @route   POST /api/sessions/join
// @access  Public (for demo)
const joinSession = async (req, res) => {
  try {
    const { sessionCode, studentId } = req.body;
    if (!sessionCode || !studentId) {
      return res.status(400).json({ message: 'Session code and student ID are required.' });
    }

    const session = await quizSessionRepository.findByCode(sessionCode);
    if (!session) {
      return res.status(404).json({ message: 'Active session with that code not found.' });
    }

    // Add the student to the session's participant list
    await quizSessionRepository.addParticipant(session._id, studentId);

    // In a real app, we would also connect the user to the Socket.IO room here.
    // For now, just return the session details.
    res.json({ message: 'Successfully joined session!', session });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server error while joining session.' });
  }
};

module.exports = {
  startSession,
  joinSession,
};
