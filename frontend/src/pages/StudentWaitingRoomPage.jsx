import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import Card from "../components/Card.jsx";
import Spinner from "../components/Spinner.jsx";

import { getSession, getParticipants } from "../api/appApi";
import { connectSession, getSocket } from "../realtime/sessionClient";
import { useAuth } from "../auth/AuthContext.jsx";

export default function StudentWaitingRoomPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [starting, setStarting] = useState(false);

  const cssVars = {
    "--accent": session?.visual?.a || "#B8C6FF",
    "--accent2": session?.visual?.b || "#F0ABFC",
  };

  // 1) Initial fetch (do NOT redirect unless we clearly see started state)
  useEffect(() => {
    (async () => {
      try {
        const s = await getSession(sessionId);
        setSession(s);

        // Only skip waiting room if both signals say "started"
        if (s?.status === "active" && typeof s?.currentIndex === "number") {
          navigate(`/s/sessions/${sessionId}/live`, { replace: true });
          return;
        }

        const list = await getParticipants(sessionId);
        if (Array.isArray(list)) setParticipants(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, navigate]);

  // 2) Presence: tell the server who joined this waiting room (so lecturer sees names)
  useEffect(() => {
    const socket = getSocket();
    // basic identity to show in participants
    if (user) {
      socket.emit("joinSessionRoom", {
        sessionId,
        user: { id: user.id || user._id, name: user.name || user.fullName || user.email, role: "student" },
      });
    }
    return () => {
      // optionally notify leave; backend support
      socket.emit("leaveSessionRoom", { sessionId });
    };
  }, [sessionId, user]);

  // 3) Live socket events: ONLY redirect when we're sure the quiz started
  useEffect(() => {
    const off = connectSession(sessionId, (evt) => {
      // Strict start detection:
      //  - explicit quiz_started
      //  - OR a patch/snapshot that includes BOTH status:"active" AND numeric currentIndex
      const isExplicitStart = evt?.type === "quiz_started";
      const isPatchStart =
        (evt?.type === "patch" || evt?.type === "snapshot") &&
        evt?.data &&
        evt.data.status === "active" &&
        typeof evt.data.currentIndex === "number";

      if ((isExplicitStart || isPatchStart) && !starting) {
        setStarting(true);
        setTimeout(() => {
          navigate(`/s/sessions/${sessionId}/live`, { replace: true });
        }, 120);
      }

      // Lightweight presence refresh if backend sends these
      if (evt?.type === "participant_joined" || evt?.type === "participant_left") {
        // We can re-fetch participants if you want real-time list updates:
        // (Uncomment if you need it and your API is cheap)
        // getParticipants(sessionId).then((list) => {
        //   if (Array.isArray(list)) setParticipants(list);
        // });
      }
    });
    return () => off && off();
  }, [sessionId, navigate, starting]);

  if (loading || !session) {
    return (
      <>
        <Header />
        <div className="container">
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container" style={cssVars}>
        {/* Hero */}
        <section className="course-hero colored">
          <div className="course-hero-left">
            <div className="course-mark" aria-hidden>⏳</div>
            <div>
              <h1 className="course-title" style={{ margin: 0 }}>You're in!</h1>
              <div className="meta">
                <span className={`chip ${starting ? "accent" : ""}`}>
                  {starting ? "Starting…" : "Waiting for the lecturer to start…"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Participants */}
        <div className="grid">
          <Card title="Participants">
            <div className="small" style={{ marginBottom: 10 }}>
              {participants.length} joined
            </div>
            {participants.length === 0 ? (
              <div className="small muted">
                Stay on this page. When the session starts, you’ll be moved automatically.
              </div>
            ) : (
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                {participants.map((p) => (
                  <span key={p.id} className="pill">
                    <span className="dot" aria-hidden />
                    {p.name || "Student"}
                  </span>
                ))}
              </div>
            )}
            <div className="small muted" style={{ marginTop: 12 }}>
              Stay on this page. When the session starts, you’ll be moved automatically.
            </div>
          </Card>
        </div>
      </div>

      {/* small styles to match your existing look */}
      <style>{`
        .pill {
          display:inline-flex; align-items:center; gap:8px;
          padding:8px 10px; border-radius:999px; background:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,.05); font-size:14px;
        }
        .pill .dot { width:10px; height:10px; border-radius:50%;
          background: var(--accent, #60a5fa); display:inline-block; }
      `}</style>
    </>
  );
}
