import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WaitingRoomView.css'; // Make sure the CSS file is also renamed and path is correct

// The component now receives sessionInfo as a prop
const WaitingRoomView = ({ sessionInfo }) => {
  const navigate = useNavigate();

  return (
    <div className="waiting-room">
      <div className="session-header">
        <p>{sessionInfo.courseName}</p>
        <h3>{sessionInfo.quizTitle}</h3>
      </div>
      <div className="status-container">
        <h1>You're in!</h1>
        <div className="status-message">
          <div className="spinner"></div>
          <p>Waiting for the lecturer to start the session...</p>
        </div>
      </div>
      <div className="participants-card">
        <h2>Participants ({sessionInfo.participants.length})</h2>
        <ul className="participants-list">
          {sessionInfo.participants.map(p => <li key={p.id}>{p.name}</li>)}
        </ul>
      </div>
      <button onClick={() => navigate(-1)} className="leave-button">Leave Session</button>
    </div>
  );
};

export default WaitingRoomView;