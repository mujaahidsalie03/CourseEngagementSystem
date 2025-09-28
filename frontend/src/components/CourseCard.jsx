import React from "react";

// CourseCard.jsx
// Clickable, keyboard-accessible course card with a gradient background.
// Props:
// - course: { courseName, courseCode, ... }
// - visual: { a, b, emoji } where a/b are CSS colors used in the gradient
// - lecturerName: display name for the lecturer
// - onOpen: handler to open/navigate to the course
export default function CourseCard({ course, visual, lecturerName, onOpen }) {
  const { a, b, emoji } = visual;

  return (
    <article
      role="button"
      tabIndex={0}
      className="gcard"                     // <<— just "gcard"
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" ? onOpen() : null)}
      aria-label={`Open ${course.courseName}`}
    >
      <div className="gcard-top">
        <div className="g-emoji" aria-hidden>{emoji}</div>
        <div className="g-code">{course.courseCode}</div>
      </div>

      <h3 className="g-title">{course.courseName}</h3>
      <div className="g-sub small">Lecturer: {lecturerName || "Lecturer"}</div>

      <div className="g-bottom">
        <button
          type="button"
          className="btn secondary"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          Open
        </button>
        <span className="g-arrow" aria-hidden>›</span>
      </div>
    </article>
  );
}

