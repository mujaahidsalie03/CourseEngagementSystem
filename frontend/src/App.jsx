import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import CourseListPage from "./pages/CourseListPage.jsx";
import CourseDetailPage from "./pages/CourseDetailPage.jsx";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import QuizFormPage from "./pages/QuizFormPage.jsx";
import LecturerSessionPage from "./pages/LecturerSessionPage.jsx";
import StudentCoursesPage from "./pages/StudentCoursesPage.jsx";
import StudentCourseDetailPage from "./pages/StudentCourseDetailPage.jsx";
import StudentWaitingRoomPage from "./pages/StudentWaitingRoomPage.jsx";
import StudentLivePage from "./pages/StudentLivePage.jsx";
import StudentCongratsPage from "./pages/StudentCongratsPage.jsx";
import StudentQuizReviewPage from "./pages/StudentQuizReviewPage.jsx"; // <-- NEW

import { useAuth } from "./auth/AuthContext.jsx";

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function RequireRole({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && user.role !== role) {
    return (
      <Navigate to={user.role === "student" ? "/s/courses" : "/courses"} replace />
    );
  }
  return children;
}

function HomeGate() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate to={user.role === "student" ? "/s/courses" : "/courses"} replace />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Lecturer (host) views — role-gated */}
      <Route
        path="/courses"
        element={
          <RequireAuth>
            <RequireRole role="lecturer">
              <CourseListPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/courses/:courseId"
        element={
          <RequireAuth>
            <RequireRole role="lecturer">
              <CourseDetailPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/courses/:courseId/quizzes/new"
        element={
          <RequireAuth>
            <RequireRole role="lecturer">
              <QuizFormPage mode="create" />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/courses/:courseId/quizzes/:quizId/edit"
        element={
          <RequireAuth>
            <RequireRole role="lecturer">
              <QuizFormPage mode="edit" />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId"
        element={
          <RequireAuth>
            <RequireRole role="lecturer">
              <LecturerSessionPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Student views */}
      <Route
        path="/s/courses"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentCoursesPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/s/courses/:courseId"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentCourseDetailPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/s/sessions/:sessionId/waiting"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentWaitingRoomPage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/s/sessions/:sessionId/live"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentLivePage />
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route
        path="/s/sessions/:sessionId/done"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentCongratsPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* NEW: Student quiz review */}
      <Route
        path="/s/courses/:courseId/quizzes/:quizId/review"
        element={
          <RequireAuth>
            <RequireRole role="student">
              <StudentQuizReviewPage />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <RequireRole role="lecturer"></RequireRole>
            <AnalyticsDashboardPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
    </Routes>
  );
}
