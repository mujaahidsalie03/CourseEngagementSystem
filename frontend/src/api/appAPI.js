// src/api/appApi.js
import { http, setSessionUser } from "./http";

// ---------- Auth ----------
export async function register({ name, email, password, role = "lecturer" }) {
  const { user } = await http("/auth/register", {
    method: "POST",
    body: { name, email, password, role },
  });
  setSessionUser(user);
  return user;
}
export async function login(email, password) {
  const { user } = await http("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setSessionUser(user);
  return user;
}
export function logout() {
  setSessionUser(null);
}

// ---------- Courses ----------
export async function listMyCourses() {
  return http("/courses");
}
export async function getCourse(courseId) {
  return http(`/courses/${courseId}`);
}

// ---------- Quizzes ----------
export async function listQuizzesByCourse(courseId) {
  return http(`/quizzes/course/${courseId}`);
}
export async function getQuiz(quizId) {
  return http(`/quizzes/${quizId}`);
}
export async function createQuiz(courseId, payload) {
  return http(`/quizzes`, { method: "POST", body: { courseId, ...payload } });
}
export async function updateQuiz(quizId, payload) {
  return http(`/quizzes/${quizId}`, { method: "PUT", body: payload });
}

// ---------- Sessions ----------
export async function createSession({
  quizId,
  courseId,
  userId,
  allowLateJoin = true,
  autoAdvance = false,
}) {
  return http("/sessions", {
    method: "POST",
    body: { quizId, courseId, allowLateJoin, autoAdvance, userId },
  });
}

export async function getSession(sessionId) {
  return http(`/sessions/${sessionId}`);
}

export async function startSession(sessionId, userId) {
  return http(`/sessions/${sessionId}/start`, {
    method: "POST",
    body: { userId },
  });
}
export async function endSession(sessionId, userId) {
  return http(`/sessions/${sessionId}/end`, {
    method: "POST",
    body: { userId },
  });
}
export async function pauseSession(sessionId) {
  return http(`/sessions/${sessionId}/pause`, { method: "POST", body: {} });
}
export async function resumeSession(sessionId) {
  return http(`/sessions/${sessionId}/resume`, { method: "POST", body: {} });
}
export async function nextQuestion(sessionId, nextIndex) {
  return http(`/sessions/${sessionId}/next`, {
    method: "POST",
    body: { nextIndex },
  });
}
export async function submitAnswer(
  sessionId,
  questionIndex,
  answer,
  timeSpent = 0
) {
  return http(`/sessions/${sessionId}/answer`, {
    method: "POST",
    body: { questionIndex, answer, timeSpent },
  });
}
export async function acceptAllLate() {
  return { ok: true };
}

// ---------- Images ----------
export async function uploadImage(file) {
  if (!file) return null;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const { width, height } = await new Promise((resolve) => {
    const i = new Image();
    i.onload = () =>
      resolve({ width: i.naturalWidth || 0, height: i.naturalHeight || 0 });
    i.onerror = () => resolve({ width: 0, height: 0 });
    i.src = dataUrl;
  });
  return {
    dataUrl,
    name: file.name || "",
    type: file.type || "",
    size: file.size || 0,
    width,
    height,
  };
}

export async function resolveSessionByCode(code) {
  return http(`/sessions/by-code/${encodeURIComponent(code)}`);
}

export async function getParticipants(sessionId) {
  const { participants } = await http(`/sessions/${sessionId}/participants`);
  return participants || [];
}

export async function joinSessionByCode(sessionCode, courseId) {
  return http("/sessions/join", {
    method: "POST",
    body: { sessionCode, courseId },
  });
}

export async function getMyQuizReview(quizId) {
  return http(`/quizzes/${quizId}/my-review`);
}

// ---------- Analytics ----------
export async function getCourseAnalytics(courseId) {
  return http(`/analytics/course/${courseId}/summary`);
}
export async function getCourseTrend(courseId) {
  return http(`/analytics/course/${courseId}/trend`);
}
export async function getQuizAnalytics(quizId) {
  return http(`/analytics/quiz/${quizId}/summary`);
}
export async function getStudentCourseAnalytics(studentId, courseId) {
  return http(`/analytics/student/${studentId}/course/${courseId}/summary`);
}
