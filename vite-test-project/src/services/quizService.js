import { http } from '../api/http.js';

export const quizService = {
  // Fetches all quizzes for a specific course
  getQuizzesByCourse: (courseId) => {
    return http.get(`/quizzes/course/${courseId}`);
  }
};