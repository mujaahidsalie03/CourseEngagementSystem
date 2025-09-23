import { http } from '../api/http.js';

// We export an object containing our service's functions.
export const courseService = {
  getCourses: () => {
    return http.get('/courses/');
  },

  getCourseById: (courseId) => {
    return http.get(`/courses/${courseId}`);
  }
};

