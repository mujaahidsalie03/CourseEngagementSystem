import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import LecturerHome from './pages/LecturerHome';
import StudentHome from './pages/StudentHome';
import LecturerCoursePage from './pages/LecturerCoursePage';
import CreateQuizPage from './pages/CreateQuizPage';
import JoinSessionPage from './pages/JoinSessionPage';
import LiveSessionPage from './pages/LiveSessionPage';
import StudentQuizPage from './pages/StudentQuizPage';
import NotFound from './pages/NotFound';
import { useAuthCtx } from './auth/AuthContext';

function Private({ children }: { children: JSX.Element }) {
  const { user } = useAuthCtx();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthCtx();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          user ? (
            user.role === 'lecturer' ? (
              <Navigate to="/lecturer" replace />
            ) : (
              <Navigate to="/student" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* lecturer */}
      <Route
        path="/lecturer"
        element={
          <Private>
            <LecturerHome />
          </Private>
        }
      />
      <Route
        path="/lecturer/course/:id"
        element={
          <Private>
            <LecturerCoursePage />
          </Private>
        }
      />
      <Route
        path="/lecturer/create"
        element={
          <Private>
            <CreateQuizPage />
          </Private>
        }
      />
      <Route
        path="/lecturer/session/:sessionId"
        element={
          <Private>
            <LiveSessionPage />
          </Private>
        }
      />

      {/* student */}
      <Route
        path="/student"
        element={
          <Private>
            <StudentHome />
          </Private>
        }
      />
      <Route
        path="/student/course/:id/join"
        element={
          <Private>
            <JoinSessionPage />
          </Private>
        }
      />
      <Route
        path="/student/session/:sessionId"
        element={
          <Private>
            <StudentQuizPage />
          </Private>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
