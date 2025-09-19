import React from 'react';
import './CourseCard.css';
import { Link } from 'react-router-dom';

//Course card component.
const CourseCard = ({ course }) => {
  return (
    //Wrap card in a Link component, it will navigate to /course/uniqueCourseId
    <Link to={`/course/${course._id}`} className="course-card-link">
        <div className="course-card">
            <h3 className="course-card-title">{course.courseName}</h3>
            <p className="course-card-code">{course.courseCode}</p>
            <p className="course-card-lecturer">Lecturer: {course.lecturerId.name}</p>
        </div>
    </Link>
  );
};

export default CourseCard;