import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { courseService } from '../services/courseService.js';
import { quizService } from '../services/quizService.js';
import './CourseDetailPage.css';
import { sessionService } from '../services/sessionService.js';

const CourseDetailPage = () => {
    // useParams gets the dynamic part of the URL (the courseId)
  const { courseId } = useParams();
  const navigate = useNavigate(); // Initialize the navigate function

  const [course, setCourse] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [pastQuizzes, setPastQuizzes] = useState([]);

  // This would eventually be the logged-in user's ID
  //const studentId = 'mock-student-123';

  useEffect(() => {
    // Fetch the course details
    courseService.getCourseById(courseId).then(setCourse);

    //Get past quizzes
    // 2. Call the new quizService to fetch real quiz data for this course
    quizService.getQuizzesByCourse(courseId)
      .then(data => {
        setPastQuizzes(data);
      });
  }, [courseId]);

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!sessionCode.trim()) {
      alert("Please enter a session code.");
      return;
    }
    try {
      // 1. Call the service, which makes the real API request
      const response = await sessionService.joinSession(sessionCode);
      
      // 2. On success, navigate using the real sessionId from the backend's response
      navigate(`/session/${response.sessionId}`);

    } catch (error) {
      // 3. If the backend returns an error (e.g., code not found), show it
      alert(error.message);
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
              <li key={quiz._id} className="past-quiz-item">
                <span className="quiz-title">{quiz.title}</span>
                <span className="quiz-date">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                <span className="quiz-score">{quiz.questionCount} Questions</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No Quizzes Found for This Course</p>
        )}
      </div>
    </div>
  );
};
export default CourseDetailPage;