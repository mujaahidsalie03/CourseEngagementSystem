// The mock data now lives inside the service, hidden from the UI component.
const mockCourses = [
  { _id: '1', courseName: 'Software Engineering', courseCode: 'CSC3003S', lecturerId: { name: 'Gary Stewart' } },
  { _id: '2', courseName: 'Computer Architecture', courseCode: 'CSC3025F', lecturerId: { name: 'John Doe' } },
  { _id: '3', courseName: 'Data Structures', courseCode: 'CSC2001F', lecturerId: { name: 'Jane Smith' } },
  { _id: '4', courseName: 'Artificial Intelligence', courseCode: 'CSC4021W', lecturerId: { name: 'Alan Turing' } },
];

// We export an object containing our service's functions.
export const courseService = {
  // This function simulates fetching data from an API.
  // We wrap the mock data in a Promise to mimic a real network request.
  getCourses: () => {
    return Promise.resolve(mockCourses);
  },

  getCourseById: (courseId) => {
    // In a real app, this would be a network request like GET /api/courses/:courseId
    // For now, we find it in our mock data array.
    const course = mockCourses.find(c => c._id === courseId);
    return Promise.resolve(course);
  },

  // This function simulates fetching the quiz history for a specific student and course
getPastQuizzesForStudent: (courseId, studentId) => {
    console.log(`Fetching past quizzes for course ${courseId} and student ${studentId}`);
    // In a real app, this would be a network request.
    const mockHistory = [
        { sessionId: 'session1', title: 'Week 2 MERN Stack Quiz', date: '2025-08-22', score: '8/10' },
        { sessionId: 'session2', title: 'Week 1 Intro Quiz', date: '2025-08-15', score: '5/5' }
    ];
    return Promise.resolve(mockHistory);
}
};

