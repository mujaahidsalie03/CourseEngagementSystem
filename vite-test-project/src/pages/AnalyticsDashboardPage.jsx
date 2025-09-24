import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsService } from '../services/analyticsService';
import { courseService } from '../services/courseService';
import StatCard from '../components/analytics/StatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './AnalyticsDashboardPage.css';

const AnalyticsDashboardPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [courses, setCourses] = useState([]); //state to hold the list of courses
  const [selectedCourseId, setSelectedCourseId] = useState(''); //state for the selected course
  const [isLoading, setIsLoading] = useState(false); // For a better loading experience

  
  // This effect runs once to fetch the list of courses for the dropdown
  useEffect(() => {
    courseService.getCourses()
      .then(setCourses)
      .catch(err => console.error("Failed to fetch courses:", err));
  }, []);

  // This effect runs whenever the user selects a new course from the dropdown
  useEffect(() => {
    // Don't fetch anything if no course is selected
    if (!selectedCourseId) {
      setAnalytics(null); // Clear previous analytics if a course is deselected
      return;
    }

    setIsLoading(true);
    analyticsService.getStudentAnalyticsForCourse(selectedCourseId, '68d176b3e0785bd70e0c35e1')
      .then(setAnalytics)
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));

  }, [selectedCourseId]); //The dependency array makes this re-run when selectedCourseId changes


  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>My Analytics Dashboard</h1>
        <Link to="/" className="back-link">&larr; Back to Courses</Link>
      </div>

      {/* 5. Add the course selection dropdown */}
      <div className="course-selector-container">
        <label htmlFor="course-select">Select a Course:</label>
        <select 
          id="course-select" 
          value={selectedCourseId} 
          onChange={e => setSelectedCourseId(e.target.value)}
          className="course-select"
        >
          <option value="">-- Please choose a course --</option>
          {courses.map(course => (
            <option key={course._id} value={course._id}>
              {course.courseName} ({course.courseCode})
            </option>
          ))}
        </select>
      </div>

      {/* 6. Conditionally render the analytics based on loading state and data */}
      {isLoading ? (
        <div className="loading-analytics">Loading analytics...</div>
      ) : analytics ? (
        <>
          <div className="stats-grid">
            <StatCard title="Participation Rate" value={Math.round(analytics.summaryStats.participationRate)} unit="%" />
            <StatCard title="Average Score" value={Math.round(analytics.summaryStats.averageScore)} unit="%" />
            <StatCard title="Quizzes Taken" value={analytics.summaryStats.quizzesTaken} />
            <StatCard title="Correct Answers" value={`${analytics.summaryStats.correctAnswers}/${analytics.summaryStats.totalAnswers}`} />
          </div>

          <div className="chart-container">
            <h2>Performance Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.performanceOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="yourScore" stroke="#3498db" strokeWidth={2} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : selectedCourseId ? (
         <div className="loading-analytics">No analytics data found for this course.</div>
      ) : (
        <div className="loading-analytics">Please select a course to view its analytics.</div>
      )}
    </div>
  );
};

export default AnalyticsDashboardPage;