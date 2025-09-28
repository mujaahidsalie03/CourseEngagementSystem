// src/api/appApi.js
// Thin browser-side API wrapper around your Express routes.
// Relies on a shared `http` helper for fetch, and `setSessionUser` to cache the user in session.
import { http, setSessionUser } from "./http";

// auth
 //Register a new user.
 //NOTE: Defaults role to 'lecturer' for convenience in dev.
 //The server returns `{ user }`; we store it in session.
export async function register({ name, email, password, role = "lecturer" }) {
  const { user } = await http("/auth/register", {
    method: "POST",
    body: { name, email, password, role },
  });
  setSessionUser(user);
  return user;
}

//Log in with email/password.
// On success, persists user to session storage.
export async function login(email, password) {
  const { user } = await http("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setSessionUser(user);
  return user;
}

//Clear the in-memory/session user (client-side logout).
export function logout() {
  setSessionUser(null);
}

// courses
//List courses for the current user (lecturer: mine; student: enrolled).
export async function listMyCourses() {
  return http("/courses");
}

//Fetch a single course by id.
export async function getCourse(courseId) {
  return http(`/courses/${courseId}`);
}

// quizzes
//List quizzes for a given course (student view includes my status/score).
export async function listQuizzesByCourse(courseId) {
  return http(`/quizzes/course/${courseId}`);
}

//Fetch a quiz by id (lecturer gets full; student-safe version otherwise).
export async function getQuiz(quizId) {
  return http(`/quizzes/${quizId}`);
}

//Create a quiz in a course. `payload` holds title/questions/settings.
export async function createQuiz(courseId, payload) {
  return http(`/quizzes`, { method: "POST", body: { courseId, ...payload } });
}

//Update an existing quiz. Partial `payload` allowed.
export async function updateQuiz(quizId, payload) {
  return http(`/quizzes/${quizId}`, { method: "PUT", body: payload });
}

// session
//Create a live session for a quiz.
// `userId` is passed so the dev auth middleware can identify the lecturer.
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

//Get session snapshot; student receives current question if active.
export async function getSession(sessionId) {
  return http(`/sessions/${sessionId}`);
}

//Start a session (lecturer-only).
export async function startSession(sessionId, userId) {
  return http(`/sessions/${sessionId}/start`, {
    method: "POST",
    body: { userId },
  });
}

//End a session (lecturer-only).
export async function endSession(sessionId, userId) {
  return http(`/sessions/${sessionId}/end`, {
    method: "POST",
    body: { userId },
  });
}

//pause a session (lect only)
export async function pauseSession(sessionId) {
  return http(`/sessions/${sessionId}/pause`, { method: "POST", body: {} });
}

//resume a session (lect only)
export async function resumeSession(sessionId) {
  return http(`/sessions/${sessionId}/resume`, { method: "POST", body: {} });
}

//Advance to a specific question index (or next if server treats undefined).
// Typically used by lecturer controls.
export async function nextQuestion(sessionId, nextIndex) {
  return http(`/sessions/${sessionId}/next`, {
    method: "POST",
    body: { nextIndex },
  });
}

//Submit an answer for the current question.
 //`answer` can be a string, array (FIB), or object, matching server normalization.
 //`timeSpent` is client-measured seconds (optional).
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

//Placeholder: accepting all late joins currently mocked client-side.
export async function acceptAllLate() {
  return { ok: true };
}

// images
//Read a File into a data URL and probe its intrinsic dimensions client-side.
export async function uploadImage(file) {
  if (!file) return null;
  // Convert file -> data URL
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  // Read natural dimensions (if image decodes)
  const { width, height } = await new Promise((resolve) => {
    const i = new Image();
    i.onload = () =>
      resolve({ width: i.naturalWidth || 0, height: i.naturalHeight || 0 });
    i.onerror = () => resolve({ width: 0, height: 0 });
    i.src = dataUrl;
  });

  // Return a client-side descriptor (you may POST this with your quiz payload)
  return {
    dataUrl,
    name: file.name || "",
    type: file.type || "",
    size: file.size || 0,
    width,
    height,
  };
}

//sessionHelpers
// Resolve a session by join code (used by students).
export async function resolveSessionByCode(code) {
  return http(`/sessions/by-code/${encodeURIComponent(code)}`);
}

//List current participants from the server's in-memory presence. 
export async function getParticipants(sessionId) {
  const { participants } = await http(`/sessions/${sessionId}/participants`);
  return participants || [];
}

// Join a session using a short code and the courseId context (server validates match).
// For dev auth, the backend reads `x-user-id`/`x-user-role` headers or body.
export async function joinSessionByCode(sessionCode, courseId) {
  return http("/sessions/join", {
    method: "POST",
    body: { sessionCode, courseId },
  });
}

//Get a per-question review of the latest answers for the logged-in student.
export async function getMyQuizReview(quizId) {
  return http(`/quizzes/${quizId}/my-review`);
}

// analytics
//Course summary metrics.
export async function getCourseAnalytics(courseId) {
  return http(`/analytics/course/${courseId}/summary`);
}

//Course trend over time.
export async function getCourseTrend(courseId) {
  return http(`/analytics/course/${courseId}/trend`);
}

//Quiz-level summary metrics.
export async function getQuizAnalytics(quizId) {
  return http(`/analytics/quiz/${quizId}/summary`);
}

//Student’s performance within a course. 
export async function getStudentCourseAnalytics(studentId, courseId) {
  return http(`/analytics/student/${studentId}/course/${courseId}/summary`);
}
