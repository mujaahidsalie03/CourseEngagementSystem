import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { sessionService } from '../../services/sessionService';
import { socket } from '../../realtime/socket';

import WaitingRoomView from '../../components/session/WaitingRoomView';
import LiveQuestionView from '../../components/session/LiveQuestionView';

const StudentSessionPage = () => {
    const {sessionId} = useParams;

    //This state will control whci view we see
    const [sessionState, setSessionState] = useState('waiting');
    const [sessionInfo, setSessionInfo] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [participants, setParticipants] = useState([]);

    useEffect(() =>{
      if (!sessionId) {
      return;
    }
        // 1. Fetch initial session details via normal API call
        sessionService.getSessionInfo(sessionId).then(initialData => {
        setSessionInfo(initialData);
        setParticipants(initialData.participants || []); // Set initial participant list
    });

    // Connect to the socket server
    socket.connect();

    // Tell the server we are joining this session's "room"
    socket.emit('join_session', { sessionId });

    // Set up listeners for live events from the server
    // Listen for updates to the participant list
    const onParticipantUpdate = (updatedParticipants) => {
      console.log('Participant list updated:', updatedParticipants);
      setParticipants(updatedParticipants);
    };
    socket.on('participant_list_updated', onParticipantUpdate);

    // Listen for the lecturer to start the quiz
    const onQuizStart = ({ question }) => {
      console.log('Quiz is starting!', question);
      setCurrentQuestion(question);
      setSessionState('question_active');
    };
    socket.on('quiz_started', onQuizStart);

    //Clean up when the component is unmounted
    return () => {
      console.log("Leaving session, disconnecting socket.");
      socket.off('participant_list_updated', onParticipantUpdate);
      socket.off('quiz_started', onQuizStart);
      socket.disconnect();
    };
    }, [sessionId]);

    // A temporary function to simulate the lecturer starting the quiz
    const handleStartQuiz = () => {
        setSessionState('question_active');
    };

    if (!sessionInfo) {
        return <div>Loading Session...</div>;
    }

    return (
    <div>
      {/* This is a temporary button for us to test the flow */}
      <button onClick={handleStartQuiz} style={{position: 'absolute', top: 10, right: 10, zIndex: 100}}>
        Simulate Quiz Start
      </button>

      {/* Conditionally render the correct view based on the state */}
      {/* Pass the live participant list to the waiting room */}
      {sessionState === 'waiting' && (<WaitingRoomView sessionInfo={sessionInfo} participants={participants} />)}
      {sessionState === 'question_active' && <LiveQuestionView question={currentQuestion} />}
    </div>
  );
};

export default StudentSessionPage;