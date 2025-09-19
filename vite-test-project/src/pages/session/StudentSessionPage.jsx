import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sessionService } from '../../services/sessionService';

import WaitingRoomView from '../../components/session/WaitingRoomView';
import LiveQuestionView from '../../components/session/LiveQuestionView';

const StudentSessionPage = () => {
    const {sessionId} = useParams;

    //This state will control whci view we see
    const [sessionState, setSessionState] = useState('waiting');
    const [sessionInfo, setSessionInfo] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);

    useEffect(() =>{
        //Fetch all session data needed when the page loads
        sessionService.getSessionInfo(sessionId).then(setSessionInfo);
        sessionService.getCurrentQuestion(sessionId).then(setCurrentQuestion);
    }, [sessionId]);

    // A temporary function to simulate the lecturer starting the quiz
    const handleStartQuiz = () => {
        setSessionState('question_active');
    };

    if (!sessionInfo || !currentQuestion) {
        return <div>Loading Session...</div>;
    }

    return (
    <div>
      {/* This is a temporary button for us to test the flow */}
      <button onClick={handleStartQuiz} style={{position: 'absolute', top: 10, right: 10, zIndex: 100}}>
        Simulate Quiz Start
      </button>

      {/* Conditionally render the correct view based on the state */}
      {sessionState === 'waiting' && <WaitingRoomView sessionInfo={sessionInfo} />}
      {sessionState === 'question_active' && <LiveQuestionView question={currentQuestion} />}
    </div>
  );
};

export default StudentSessionPage;