import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Input from "../components/Input.jsx";
import Button from "../components/Button.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginPage() {
  // Local form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth(); // auth action from context
  const nav = useNavigate(); // programmatic navigation
  const location = useLocation(); // used to redirect back after login

  // If we were redirected to login, go back to the original route after success.
  // Fallback to '/courses' if none.
  const from = (location.state && location.state.from && location.state.from.pathname) || "/courses";

  // Handle form submit: attempt login, then navigate to 'from'.
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      nav(from, { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed.");
    }
  };

  return (
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="hero" style={{ marginTop: 18 }}>
          <h1 className="hero-title">Sign in</h1>
          <p className="hero-sub">Use your account credentials to continue.</p>
        </div>

        <form className="card" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label className="field" style={{ marginTop: 10 }}>
            <span>Password</span>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="small" style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}

          <div className="row" style={{ marginTop: 12 }}>
            <Button type="submit">Login</Button>
          </div>
        </form>
      </div>

  );
}
