// src/components/Header.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Header({ title = "Course Engagement System" }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const baseCoursesPath = user?.role === "student" ? "/s/courses" : "/courses";
  const isActive = (p) => pathname.startsWith(p);
  const canSeeAnalytics = user && user.role !== "student"; // <- only staff see Analytics

  const handleLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  // Optional: while logged out, show just the brand (no nav)
  if (!user) {
    return (
      <header className="topbar">
        <div className="container topbar-inner">
          <h1 className="brand">{title}</h1>
        </div>
      </header>
    );
  }

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <h1 className="brand">{title}</h1>
        <nav className="nav" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to={baseCoursesPath} className={`navlink ${isActive(baseCoursesPath) ? "active" : ""}`}>
            Courses
          </Link>

          {canSeeAnalytics && (
            <Link to="/analytics" className={`navlink ${isActive("/analytics") ? "active" : ""}`}>
              Analytics
            </Link>
          )}

          <button className="navlink" type="button" onClick={handleLogout} title="Log out">
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
