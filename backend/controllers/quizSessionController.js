const quizSessionService = require('../services/quizSessionService');

const startSession = async (req, res) => {
  try {
    const { quizId } = req.body;
    const lecturerId = req.user._id;
    const result = await quizSessionService.startSession(quizId, lecturerId);
    
    // The controller is still responsible for real-time events
    req.app.get('io').to(`lecturer:${lecturerId}`).emit('session_started', result);
    
    res.status(201).json(result);
  } catch (error) {
    // The service throws an error, the controller catches it and sends the response
    res.status(403).json({ message: error.message });
  }
};

const stopSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await quizSessionService.stopSession(sessionId);
    
    // Notify all clients in the session room
    req.app.get('io').to(`session:${sessionId}`).emit('session_status', { status: 'finished' });

    res.json({ message: 'Session stopped successfully.' });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const joinSession = async (req, res) => {
  try {
    const { sessionCode } = req.body;
    const studentId = req.user._id;
    const result = await quizSessionService.joinSession(sessionCode, studentId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user._id;
    
    await quizSessionService.submitAnswer(sessionId, studentId, req.body);

    // After an answer is submitted, get the new results and broadcast them
    const results = await quizSessionService.getResults(sessionId);
    req.app.get('io').to(`session:${sessionId}`).emit('results_update', results);
    
    res.json({ message: 'Answer submitted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getSessionResults = async (req, res) => {
    try {
        const results = await quizSessionService.getResults(req.params.sessionId);
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

module.exports = { startSession, stopSession, joinSession, submitAnswer, getSessionResults };

