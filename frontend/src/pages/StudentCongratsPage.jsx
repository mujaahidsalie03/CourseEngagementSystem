//when lecturer clicks end session gets redirected here.

import { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../components/Header.jsx";

function Fireworks() {
  const ref = useRef(null);
  const raf = useRef(0);
  const bursts = useRef([]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const spawnBurst = (x = Math.random() * w, y = h * (0.25 + Math.random() * 0.35)) => {
      const particles = [];
      const count = 100;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 60 + Math.random() * 40,
          size: 2 + Math.random() * 2,
          hue: Math.floor(Math.random() * 360),
        });
      }
      bursts.current.push(particles);
    };

    // a few initial bursts + random ones
    for (let i = 0; i < 3; i++) setTimeout(() => spawnBurst(), 250 * i);
    const burstTimer = setInterval(spawnBurst, 900);

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      bursts.current = bursts.current.filter(particles => {
        let alive = false;
        for (const p of particles) {
          // gravity + friction
          p.vy += 0.03;
          p.vx *= 0.995;
          p.vy *= 0.995;
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 1;

          if (p.life > 0) {
            alive = true;
            ctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        return alive;
      });

      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf.current);
      clearInterval(burstTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
      }}
    />
  );
}

export default function StudentCongratsPage() {
  const { sessionId } = useParams();

  return (
    <>
      <Header />
      <div
        className="container"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          minHeight: "60vh",
          textAlign: "center",
        }}
      >
        <div className="card" style={{ padding: 28, background: "rgba(255,255,255,0.9)" }}>
          <h1 style={{ marginTop: 0 }}>You’ve completed the quiz! 🎉</h1>
          <p className="muted" style={{ fontSize: 16, marginBottom: 18 }}>
            Thanks for coming to class and participating.
          </p>
          <div className="row" style={{ justifyContent: "center", gap: 10 }}>
            <Link to="/s/courses" className="btn">Back to My Courses</Link>
          </div>
        </div>
      </div>

      <Fireworks />
    </>
  );
}
