import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Import the new service
import { courseService } from '../services/courseService.js'; 
import CourseCard from '../components/CourseCard';
import './CourseListPage.css';

// The mock data has been removed from this file.

const CourseListPage = () => {
  const [courses, setCourses] = useState([]);
  
  useEffect(() => {
    // Call the service to get the courses.
    // The .then() part handles the Promise we created in the service.
    courseService.getCourses()
      .then(data => {
        // Step 3: Update our component's state with the data from the service.
        setCourses(data);
      });
  }, []); // The empty array ensures this runs only once when the component loads.

  return (
    <div className="course-list-page">
      <header className="page-header">
        <h2>Welcome, Student!</h2>
        <h1>Your Courses</h1>
        <Link to="/analytics" className="analytics-link">View My Analytics</Link>
      </header>
      <div className="course-grid">
        {courses.map(course => (
          <CourseCard key={course._id} course={course} />
        ))}
      </div>
    </div>
  );
};

export default CourseListPage;