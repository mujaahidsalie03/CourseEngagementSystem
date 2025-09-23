import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WaitingRoomView.css'; // Make sure the CSS file is also renamed and path is correct

// The component now receives sessionInfo as a prop
const WaitingRoomView = ({ sessionInfo, participants }) => {
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
        {/* Use the length from the live participants prop */}
        <h2>Participants ({participants.length})</h2>
        <ul className="participants-list">
          {/* Map over the live participants prop */}
          {participants.map(p => <li key={p.user._id}>{p.user.name}</li>)}
        </ul>
      </div>
      <button onClick={() => navigate(-1)} className="leave-button">Leave Session</button>
    </div>
  );
};

export default WaitingRoomView;
