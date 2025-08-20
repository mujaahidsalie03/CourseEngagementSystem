import React, { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/**
 * Drop this file in your Vite React app as src/App.jsx
 * npm i axios socket.io-client react-router-dom recharts
 * .env: VITE_API_BASE=http://localhost:5000/api  (or your deployed API)
 * optional: VITE_WS_BASE=http://localhost:5000
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
const WS_BASE = import.meta.env.VITE_WS_BASE || API_BASE.replace(/\/api$/, "");

// --------------- axios instance with auth header ---------------
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --------------- Auth Context ---------------
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const value = { user, login, logout };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

function RequireAuth({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

// --------------- UI Helpers ---------------
function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between px-6 py-3 shadow bg-white">
        <Link to="/" className="font-bold text-lg">Course Engagement MVP</Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.role === "lecturer" && (
            <>
              <Link to="/lecturer/create" className="hover:underline">Create Activity</Link>
            </>
          )}
          {user?.role === "student" && (
            <Link to="/student/join" className="hover:underline">Join Session</Link>
          )}
          {user ? (
            <button onClick={logout} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Logout</button>
          ) : (
            <Link to="/login" className="px-3 py-1 rounded bg-black text-white">Login</Link>
          )}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  );
}

function Card({ title, children, footer }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6">
      {title && <h2 className="text-xl font-semibold mb-3">{title}</h2>}
      <div>{children}</div>
      {footer && <div className="mt-4 border-t pt-3 text-sm text-gray-600">{footer}</div>}
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-700 mb-1">{label}</span>
      <input
        className="w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [] }) {
  return (
    <label className="block mb-3">
      <span className="block text-sm text-gray-700 mb-1">{label}</span>
      <select
        className="w-full border rounded-xl px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// --------------- Pages ---------------
function Home() {
  const { user } = useAuth();
  return (
    <Shell>
      <Card title="Welcome">
        <p className="text-gray-700">
          This is a minimal frontend for in-lecture activities. Log in as a <b>lecturer</b> to
          create and start sessions; log in as a <b>student</b> to join via a code and submit
          answers.
        </p>
        <ul className="list-disc ml-5 mt-3 text-gray-700">
          <li>Lecturer flow: Create Activity → Start Session → Share join code → Watch live analytics</li>
          <li>Student flow: Join with code → Answer each question</li>
        </ul>
      </Card>
    </Shell>
  );
}

function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (user) nav("/");
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/");
    } catch (e) {
      setErr(e?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="max-w-md mx-auto">
        <Card title="Login">
          <form onSubmit={submit}>
            <TextInput label="Email" value={email} onChange={setEmail} placeholder="you@university.edu" />
            <TextInput label="Password" value={password} onChange={setPassword} type="password" />
            {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
            <button className="w-full py-2 rounded-xl bg-black text-white disabled:opacity-50" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="text-sm text-gray-600 mt-3">
            Tip: Seed users via your existing /api/auth/register or database. Roles: <code>lecturer</code> or <code>student</code>.
          </div>
        </Card>
      </div>
    </Shell>
  );
}

// -------- Lecturer: Create Activity & Start Live Session --------
function LecturerCreateActivityPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([
    { type: "mcq", text: "2 + 2?", options: ["3", "4", "5"], correctIndex: 1, points: 1 },
  ]);
  const [created, setCreated] = useState(null); // activity object
  const [session, setSession] = useState(null); // { sessionId, joinCode }
  const [err, setErr] = useState("");

  const addQuestion = () => setQuestions((q) => [...q, { type: "mcq", text: "", options: ["A", "B"], points: 1 }]);
  const updateQ = (i, patch) => setQuestions((q) => q.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const updateOption = (qi, oi, v) => setQuestions((q) => q.map((x, idx) => (idx === qi ? { ...x, options: x.options.map((o, j) => (j === oi ? v : o)) } : x)));
  const addOption = (qi) => setQuestions((q) => q.map((x, idx) => (idx === qi ? { ...x, options: [...x.options, "New option"] } : x)));

  const createActivity = async () => {
    setErr("");
    try {
      const { data } = await api.post("/activities", { title, questions });
      setCreated(data);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to create");
    }
  };

  const startSession = async () => {
    if (!created?._id) return;
    try {
      const { data } = await api.post("/sessions", { activityId: created._id });
      setSession(data);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to start session");
    }
  };

  return (
    <Shell>
      <Card title="Create Activity">
        <TextInput label="Title" value={title} onChange={setTitle} placeholder="Week 1 Live Quiz" />
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="border rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Select
                  label="Type"
                  value={q.type}
                  onChange={(v) => updateQ(i, { type: v })}
                  options={[
                    { value: "mcq", label: "Multiple Choice" },
                    { value: "truefalse", label: "True/False" },
                    { value: "short", label: "Short Answer" },
                  ]}
                />
                <TextInput label="Points" value={q.points || 1} onChange={(v) => updateQ(i, { points: Number(v) || 1 })} />
              </div>
              <TextInput label={`Q${i + 1} Text`} value={q.text} onChange={(v) => updateQ(i, { text: v })} />
              {(q.type === "mcq" || q.type === "truefalse") && (
                <div className="mt-2">
                  <div className="text-sm text-gray-700 mb-1">Options</div>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2 mb-2">
                      <input className="flex-1 border rounded-xl px-3 py-2" value={opt} onChange={(e) => updateOption(i, oi, e.target.value)} />
                      <label className="text-sm flex items-center gap-1">
                        <input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => updateQ(i, { correctIndex: oi })} />
                        correct
                      </label>
                    </div>
                  ))}
                  <button onClick={() => addOption(i)} className="text-sm px-2 py-1 rounded bg-gray-100">+ add option</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={addQuestion} className="px-3 py-2 rounded bg-gray-100">+ Add Question</button>
        </div>
        {err && <div className="text-red-600 mt-3">{err}</div>}
        <div className="flex gap-2 mt-4">
          <button onClick={createActivity} className="px-4 py-2 rounded bg-black text-white">Save Activity</button>
          {created && !session && (
            <button onClick={startSession} className="px-4 py-2 rounded bg-green-600 text-white">Start Live Session</button>
          )}
          {session && (
            <Link to={`/lecturer/session/${session.sessionId}`} state={{ joinCode: session.joinCode }} className="px-4 py-2 rounded bg-blue-600 text-white">
              Open Live Panel
            </Link>
          )}
        </div>
        {created && (
          <div className="text-sm text-gray-700 mt-3">Saved as ID: <code>{created._id}</code></div>
        )}
        {session && (
          <div className="text-sm text-gray-700 mt-3">Share Join Code: <span className="font-mono text-xl">{session.joinCode}</span></div>
        )}
      </Card>
    </Shell>
  );
}

// -------- Lecturer: Live Session Analytics --------
function LecturerLiveSessionPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const joinCode = state?.joinCode;

  const [agg, setAgg] = useState([]); // [{ _id: 0, options:[{answer, count}]}]
  const [questionIndex, setQuestionIndex] = useState(0);
  const socketRef = useRef(null);

  const loadOnce = async () => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}/aggregate`);
      setAgg(data || []);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadOnce();
    const s = io(WS_BASE, { transports: ["websocket", "polling"] });
    socketRef.current = s;
    s.emit("joinSessionRoom", sessionId);
    s.on("aggregate", (data) => setAgg(data || []));
    s.on("status", (payload) => {
      if (payload?.status === "stopped") {
        // could show a banner
      }
    });
    return () => {
      s.emit("leaveSessionRoom", sessionId);
      s.disconnect();
    };
  }, [sessionId]);

  const currentData = useMemo(() => {
    const item = agg.find((x) => String(x._id) === String(questionIndex));
    if (!item) return [];
    // recharts expects [{name, value}]
    return (item.options || []).map((o) => ({ name: String(o.answer), value: o.count }));
  }, [agg, questionIndex]);

  const stop = async () => {
    try { await api.post(`/sessions/${sessionId}/stop`); } catch {}
  };

  const maxQIndex = agg.reduce((m, x) => Math.max(m, Number(x._id)), 0);
  const qOptions = Array.from({ length: maxQIndex + 1 }, (_, i) => ({ value: String(i), label: `Question ${i + 1}` }));

  return (
    <Shell>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card title="Live Responses">
            <div className="flex items-center gap-4 mb-4">
              <Select label="Question" value={String(questionIndex)} onChange={(v) => setQuestionIndex(Number(v))} options={qOptions.length ? qOptions : [{ value: "0", label: "Question 1" }]} />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div>
          <Card title="Session Controls">
            {joinCode && (
              <div className="mb-4">
                <div className="text-sm text-gray-600">Join Code</div>
                <div className="font-mono text-3xl tracking-widest">{joinCode}</div>
              </div>
            )}
            <button onClick={stop} className="px-4 py-2 rounded bg-red-600 text-white">Stop Session</button>
            <div className="text-sm text-gray-600 mt-3">Students can still see their last screen after you stop, but submissions will be blocked.</div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

// -------- Student: Join --------
function StudentJoinPage() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const join = async () => {
    setErr("");
    try {
      const { data } = await api.post("/sessions/join", { code });
      nav(`/student/session/${data.sessionId}`, { state: { activity: data.activity } });
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not join");
    }
  };

  return (
    <Shell>
      <div className="max-w-md mx-auto">
        <Card title="Join Live Session">
          <TextInput label="Code" value={code} onChange={setCode} placeholder="e.g. ABC123" />
          {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
          <button onClick={join} className="w-full py-2 rounded bg-black text-white">Join</button>
        </Card>
      </div>
    </Shell>
  );
}

// -------- Student: Quiz --------
function StudentQuizPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const activity = state?.activity; // provided by join

  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [msg, setMsg] = useState("");

  if (!activity) {
    return (
      <Shell>
        <Card title="Missing Activity">
          <p className="text-gray-700">Open this page by joining a session first. (Student → Join)</p>
        </Card>
      </Shell>
    );
  }

  const q = activity.questions[idx];

  const submit = async () => {
    setMsg("");
    try {
      await api.post(`/sessions/${sessionId}/answer`, { questionIndex: idx, answer });
      setMsg("Answer submitted!");
    } catch (e) {
      setMsg(e?.response?.data?.error || "Could not submit");
    }
  };

  const next = () => {
    if (idx < activity.questions.length - 1) {
      setIdx(idx + 1);
      setAnswer(null);
      setMsg("");
    }
  };

  return (
    <Shell>
      <Card title={`Question ${idx + 1} of ${activity.questions.length}`}>
        <div className="mb-3 text-lg">{q.text}</div>

        {(q.type === "mcq" || q.type === "truefalse") && (
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name="ans" checked={String(answer) === String(i)} onChange={() => setAnswer(i)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        )}
        {q.type === "short" && (
          <TextInput label="Your answer" value={answer || ""} onChange={setAnswer} />
        )}

        {msg && <div className="text-sm mt-2 {msg.includes('submitted') ? 'text-green-600' : 'text-red-600'}">{msg}</div>}

        <div className="flex gap-2 mt-4">
          <button onClick={submit} className="px-4 py-2 rounded bg-black text-white">Submit</button>
          <button onClick={next} disabled={idx >= activity.questions.length - 1} className="px-4 py-2 rounded bg-gray-100 disabled:opacity-50">Next</button>
        </div>
      </Card>
    </Shell>
  );
}

// --------------- Main App (Router) ---------------
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/lecturer/create"
            element={
              <RequireAuth role="lecturer">
                <LecturerCreateActivityPage />
              </RequireAuth>
            }
          />
          <Route
            path="/lecturer/session/:sessionId"
            element={
              <RequireAuth role="lecturer">
                <LecturerLiveSessionPage />
              </RequireAuth>
            }
          />

          <Route
            path="/student/join"
            element={
              <RequireAuth role="student">
                <StudentJoinPage />
              </RequireAuth>
            }
          />
          <Route
            path="/student/session/:sessionId"
            element={
              <RequireAuth role="student">
                <StudentQuizPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
