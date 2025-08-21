export const endpoints = {
  auth: {
    login: '/auth/login',
  },
  courses: {
    mine: '/courses', // role-aware: lecturer (teach), student (enrolled)
  },
  quizzes: {
    byCourse: (courseId: string) => `/quizzes/course/${courseId}`,
    create: '/quizzes',
  },
  sessions: {
    start: '/sessions/start', // POST { quizId }
    join: '/sessions/join',   // POST { code }
    answer: (id: string) => `/sessions/${id}/answer`,
    stop: (id: string) => `/sessions/${id}/stop`,
  },
};
