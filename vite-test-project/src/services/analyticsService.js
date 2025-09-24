import { http } from '../api/http.js';

export const analyticsService = {
  // This function now calls the real backend endpoint
  getStudentAnalyticsForCourse: (courseId, studentId) => {
    // Note: The studentId is already added to the request by our http helper
    return http.get(`/analytics/student/${studentId}/course/${courseId}`);
  }
};