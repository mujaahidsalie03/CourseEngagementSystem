// Mock data for our waiting room
const mockSessionData = {
  courseName: 'Software Engineering',
  quizTitle: 'Week 3 Agile Principles Quiz',
  participants: [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
    { id: '4', name: 'Diana' },
  ]
};

const mockQuestion = {
  questionText: "Which of the following is NOT a core principle of Agile methodology?",
  answers: [
    { answerText: "Individuals and interactions over processes and tools" },
    { answerText: "Working software over comprehensive documentation" },
    { answerText: "Comprehensive documentation over working software" },
    { answerText: "Customer collaboration over contract negotiation" },
  ]
};

export const sessionService = {
  // This simulates fetching the initial state of the session after joining
  getSessionInfo: (sessionId) => {
    console.log(`Fetching info for session ${sessionId}`);
    // We add the current user to the list for this simulation
    const fullParticipants = [...mockSessionData.participants, { id: '5', name: 'You' }];
    return Promise.resolve({ ...mockSessionData, participants: fullParticipants });
  },

  getCurrentQuestion: (sessionId) => {
    console.log(`Fetching question for session ${sessionId}`);
    return Promise.resolve(mockQuestion);
  }
};

