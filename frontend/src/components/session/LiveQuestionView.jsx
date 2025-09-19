import React, { useState } from 'react';
import './LiveQuestionView.css';

//This component receives the current question as a prop
const LiveQuestionView = ({question}) => {
    const [selectedAnswer, setSelectedAnswer] = useState(null);

    const handleSubmit = () => {
        if(selectedAnswer){
            alert(`You submitted: ${selectedAnswer.answerText}`);
      // Later, this will send the answer to the backend
        } else {
            alert("Please select an answer first!");
        }
    };
    return (
    <div className="question-view">
      <div className="question-header">
        <span className="question-number">Question 1/10</span>
        <h2 className="question-text">{question.questionText}</h2>
      </div>
      <div className="answers-grid">
        {question.answers.map((answer, index) => (
          <button
            key={index}
            className={`answer-button ${selectedAnswer === answer ? 'selected' : ''}`}
            onClick={() => setSelectedAnswer(answer)}
          >
            {answer.answerText}
          </button>
        ))}
      </div>
      <button 
        className="submit-button"
        onClick={handleSubmit}
        disabled={!selectedAnswer} // Button is disabled until an answer is chosen
      >
        Submit
      </button>
    </div>
  );
};

export default LiveQuestionView;