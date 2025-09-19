import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseService } from '../services/courseService.js';
import './CourseDetailPage.css';

const CourseDetailPage = () => {
    // useParams gets the dynamic part of the URL (the courseId)
  const { courseId } = useParams();
  const navigate = useNavigate(); // Initialize the navigate function

  const [course, setCourse] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [pastQuizzes, setPastQuizzes] = useState([]);

  // This would eventually be the logged-in user's ID
  const studentId = 'mock-student-123';

  useEffect(() => {
    // Fetch the course details
    courseService.getCourseById(courseId).then(data => {
      setCourse(data);
    });

    //Get past quizzes
    courseService.getPastQuizzesForStudent(courseId, studentId)
    .then(data => {
        setPastQuizzes(data);
      });
  }, [courseId]); // Re-run if the courseId changes

  const handleJoinSession = (e) => {
    e.preventDefault();
    if (sessionCode.trim()) {
      // For now, just show an alert. Later this will call the API.
      // The backend has a POST /api/sessions/join endpoint for this.
      // In a real app, you would first call the API to validate the code,
      // and on success, the API would return a sessionId.
      const mockSessionId = 'ABCDE12345'; // Using a mock ID for now
      navigate(`/session/${mockSessionId}`);
    }
  };

  // Show a loading message while course data is being fetched
  if (!course) {
    return <div>Loading course...</div>;
  }

  return (
    <div className="course-detail-page">
      <div className="page-header-detail">
        <button onClick={() => navigate(-1)} className="back-button">
          &larr; Back to Courses
        </button>
        <h1 className="course-title-header">{course.courseName}</h1>
      </div>
      <div className="join-session-container">
        <h2>Join a Live Session</h2>
        <form onSubmit={handleJoinSession} className="join-form">
          <input
            type="text"
            placeholder="Enter Session Code"
            className="session-code-input"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
          />
          <button type="submit" className="join-button">Join</button>
        </form>
      </div>

      <div className="past-quizzes-container">
        <h2>Past Quizzes</h2>
        {pastQuizzes.length > 0 ? (
          <ul className="past-quizzes-list">
            {pastQuizzes.map(quiz => (
              <li key={quiz.sessionId} className="past-quiz-item">
                <span className="quiz-title">{quiz.title}</span>
                <span className="quiz-date">{quiz.date}</span>
                <span className="quiz-score">Score: {quiz.score}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>You have not participated in any quizzes for this course yet.</p>
        )}
      </div>
    </div>
  );
};
export default CourseDetailPage;