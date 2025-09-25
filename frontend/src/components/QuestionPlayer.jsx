// src/components/QuestionPlayer.jsx
import { useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
const qType = (q) =>
  String(q?.type || q?.questionType || "")
    .toLowerCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const getAnswers = (q) =>
  Array.isArray(q?.answers)
    ? q.answers.map((a, i) => ({
        id: a.id ?? `opt_${i}`,
        text: a.text ?? a.answerText ?? String(a ?? ""),
        img: a.imageUrl || a.img || null,
        correct: !!(a.correct ?? a.isCorrect),
      }))
    : [];

const getImage = (q) => q?.imageUrl || q?.image || null;
const getRef = (q) => q?.reference ?? q?.referenceText ?? q?.hint ?? "";
const getPrompt = (q) => q?.prompt ?? q?.questionText ?? q?.text ?? "Question";

/* Parse single-brace blanks: "{a|b}" -> [["a","b"], ...] */
const parseBlanks = (tpl = "") => {
  const re = /\{([^}]+)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const alts = m[1].split("|").map((s) => s.trim()).filter(Boolean);
    out.push(alts.length ? alts : [""]);
  }
  return out;
};

/* Tokenize a template into text and blank markers so we can render inline inputs */
function tokenizeTemplate(tpl = "") {
  if (!tpl) return [{ type: "text", text: "" }];
  const parts = [];
  let i = 0;
  let bIndex = 0;
  while (i < tpl.length) {
    const open = tpl.indexOf("{", i);
    if (open === -1) {
      parts.push({ type: "text", text: tpl.slice(i) });
      break;
    }
    // text before {
    if (open > i) parts.push({ type: "text", text: tpl.slice(i, open) });

    const close = tpl.indexOf("}", open + 1);
    if (close === -1) {
      // unmatched brace — treat rest as text
      parts.push({ type: "text", text: tpl.slice(open) });
      break;
    }
    // blank token (we ignore the content; alternatives are only for validation)
    parts.push({ type: "blank", index: bIndex++ });
    i = close + 1;
  }
  return parts;
}

/* Robust key-points normalizer for Pose & Discuss */
const splitBullets = (s) =>
  String(s)
    .split(/\r?\n|;|•/g)
    .map((t) => t.trim())
    .filter(Boolean);

const normalizeKP = (x) => {
  if (!x) return [];
  if (Array.isArray(x)) return x.map((v) => String(v).trim()).filter(Boolean);
  if (typeof x === "string") return splitBullets(x);
  if (typeof x === "object") {
    const fromArrays = ["bullets", "points", "items"].flatMap((k) =>
      Array.isArray(x[k]) ? x[k] : []
    );
    if (fromArrays.length) return fromArrays.map((v) => String(v).trim()).filter(Boolean);
    const single =
      x.text || x.content || x.value || x.note || x.answer || x.expectedAnswer || x.modelAnswer;
    return single ? splitBullets(single) : [];
  }
  return [];
};

const getKeyPoints = (q) => {
  const cands = [
    q?.modelAnswer,
    q?.expectedAnswer,
    q?.keyPoints,
    q?.keypoints,
    q?.key_points,
    q?.discussionPoints,
    q?.guide,
    q?.notes,
    q?.settings?.modelAnswer,
    q?.settings?.expectedAnswer,
    q?.settings?.keyPoints,
    q?.settings?.keypoints,
    q?.settings?.key_points,
    q?.settings?.discussionPoints,
    q?.settings?.guide,
    q?.settings?.notes,
  ];
  const all = cands.flatMap((x) => normalizeKP(x));
  const seen = new Set();
  return all.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
};

/* ========================================================= */

export default function QuestionPlayer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const type = qType(question);
 // Keep the original list (with stable ids)
const baseAnswers = useMemo(() => getAnswers(question), [question]);

// Shuffle only for display when enabled; ids remain the same
const answers = useMemo(() => {
  const shuffle = (question?.settings?.shuffleOptions ?? question?.shuffleOptions) === true;
  if (!shuffle) return baseAnswers;

  // Fisher–Yates, executed once per question change
  const arr = baseAnswers.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
  // Depend on baseAnswers + the flag + question id so it stays stable while answering
}, [baseAnswers, question?.settings?.shuffleOptions, question?.shuffleOptions]);
  const img = getImage(question);
  const refText = getRef(question);

  // --- All hooks at top (avoid hook-order errors) ---
  const [local, setLocal] = useState(value ?? null); // generic bound value fallback
  const [showKP, setShowKP] = useState(false);       // pose & discuss: reveal toggle

  const mergedValue = value === undefined ? local : value;
  const setVal = (v) => {
    onChange?.(v);
    if (value === undefined) setLocal(v);
  };

  useEffect(() => {
    setShowKP(false);
  }, [question?.id, type]);

  // Fill-blank prep
  const template = question?.template ?? "";
  const blanks = useMemo(
    () =>
      (Array.isArray(question?.blanks) && question.blanks.length
        ? question.blanks
        : parseBlanks(template)) || [],
    [question?.blanks, template]
  );
  const tokens = useMemo(() => tokenizeTemplate(template), [template]);

  /* ---------- shared media block ---------- */
  const Media = () => {
    if (!img && !refText) return null;
    return (
      <div className="qp-media">
        {img && (
          <img
            className="qp-image"
            src={typeof img === "string" ? img : img?.dataUrl}
            alt="question visual"
            loading="lazy"
          />
        )}
        {refText && <div className="qp-ref small muted">Reference: {refText}</div>}
      </div>
    );
  };

  /* ---------- MCQ / POLL (card style) ---------- */
  if (type === "mcq" || type === "poll") {
    const allowMultiple = !!question?.settings?.allowMultiple && type === "poll";
    const ensureSet = (v) =>
      new Set(Array.isArray(v) ? v.map(String) : v != null ? [String(v)] : []);
    const selected = ensureSet(mergedValue);

    const toggle = (id) => {
      if (disabled) return;
      const sid = String(id);
      if (allowMultiple) {
        const next = new Set(selected);
        next.has(sid) ? next.delete(sid) : next.add(sid);
        setVal(Array.from(next));
      } else {
        setVal(sid);
      }
    };

    return (
      <div>
        <Media />
        <div className="choice-grid">
          {answers.map((opt, i) => {
            const picked = selected.has(String(opt.id));
            return (
              <button
                key={opt.id ?? i}
                type="button"
                disabled={disabled}
                className={`choice-card ${picked ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                onClick={() => toggle(opt.id)}
                aria-pressed={picked}
              >
                <div className="choice-letter">{String.fromCharCode(65 + i)}</div>
                <div className="choice-body">
                  <div className="choice-text">{opt.text}</div>
                  {opt.img && <img className="choice-thumb" src={opt.img} alt="" loading="lazy" />}
                </div>
              </button>
            );
          })}
        </div>
        {!answers.length && <div className="muted small" style={{ marginTop: 8 }}>No options provided.</div>}
        <Styles />
      </div>
    );
  }

  /* ---------- WORD CLOUD ---------- */
  if (type === "word_cloud") {
    return (
      <div>
        <Media />
        <input
          className="inp"
          type="text"
          maxLength={60}
          placeholder="One or two words…"
          disabled={disabled}
          value={mergedValue ?? ""}
          onChange={(e) => setVal(e.target.value)}
        />
        <div className="tiny muted" style={{ marginTop: 6 }}>
          Keep it concise — we’ll build a word cloud.
        </div>
        <Styles />
      </div>
    );
  }

  /* ---------- POSE & DISCUSS (Notes + Key Points reveal) ---------- */
  if (type === "pose_and_discuss") {
    const keyPoints = getKeyPoints(question);

    return (
      <div>
        <Media />
        <div className="pad-grid">
          {/* Notes (answer) */}
          <div className="pad-col">
            <div className="pad-title">Your notes</div>
            <textarea
              className="inp"
              rows={6}
              placeholder="Jot your thoughts here…"
              disabled={disabled}
              value={typeof mergedValue === "string" ? mergedValue : mergedValue?.text ?? ""}
              onChange={(e) => setVal(e.target.value)}
            />
            {question?.settings?.wordLimit && (
              <div className="tiny muted" style={{ marginTop: 6 }}>
                Word limit: {question.settings.wordLimit}
              </div>
            )}
          </div>

          {/* Key points */}
          <div className="pad-col">
            <div className="pad-title row" style={{ justifyContent: "space-between" }}>
              <span>Key points</span>
              <button type="button" className="kp-btn" onClick={() => setShowKP((s) => !s)}>
                {showKP ? "Hide key points" : "Reveal key points"}
              </button>
            </div>

            <div className={`kp-panel ${showKP ? "open" : ""}`} aria-hidden={!showKP}>
              {keyPoints.length ? (
                <ul className="kp-list">
                  {keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : (
                <div className="tiny muted">No key points were provided for this prompt.</div>
              )}
            </div>
          </div>
        </div>

        <Styles />
      </div>
    );
  }

  /* ---------- FILL IN THE BLANK (inline blanks) ---------- */
  if (type === "fill_in_the_blank" || type === "fill_blank") {
    // Ensure an array the size of blanks for the user's answers
    const current = Array.isArray(mergedValue)
      ? mergedValue.slice(0, blanks.length).concat(Array(Math.max(0, blanks.length - (mergedValue?.length || 0))).fill(""))
      : Array(blanks.length).fill("");

    const update = (idx, text) => {
      if (disabled) return;
      const next = current.slice();
      next[idx] = text;
      setVal(next);
    };

    return (
      <div>
        <Media />

        {/* If template present, render inline sentence with blanks; else fall back to separate inputs */}
        {template ? (
          <div className="fib-bubble">
            {tokens.map((t, i) =>
              t.type === "text" ? (
                <span key={`t_${i}`} className="fib-text">{t.text}</span>
              ) : (
                <input
                  key={`b_${t.index}`}
                  className="fib-input"
                  type="text"
                  disabled={disabled}
                  value={current[t.index] ?? ""}
                  onChange={(e) => update(t.index, e.target.value)}
                  placeholder=" "
                />
              )
            )}
          </div>
        ) : (
          <>
            <div className="tiny muted" style={{ marginBottom: 8 }}>
              Fill each blank below.
            </div>
            <ol className="blank-list">
              {blanks.map((_, i) => (
                <li key={i} className="blank-item">
                  <b>Blank {i + 1}:</b>
                  <input
                    className="inp"
                    style={{ marginLeft: 8 }}
                    type="text"
                    disabled={disabled}
                    value={current[i] ?? ""}
                    onChange={(e) => update(i, e.target.value)}
                  />
                </li>
              ))}
            </ol>
          </>
        )}

        <Styles />
      </div>
    );
  }

  /* ---------- fallback text ---------- */
  return (
    <div>
      <Media />
      <textarea
        className="inp"
        rows={3}
        placeholder="Your answer…"
        disabled={disabled}
        value={typeof mergedValue === "string" ? mergedValue : mergedValue?.text ?? ""}
        onChange={(e) => setVal(e.target.value)}
      />
      <Styles />
    </div>
  );
}

/* Inline style helper (blue theme + Pose&Discuss + FIB bubbles) */
function Styles() {
  return (
    <style>{`
      /* --- QuestionPlayer styling (blue theme) --- */

      :root {
        --accent:  #60a5fa; /* blue-400 */
        --accent2: #2563eb; /* blue-600 */
      }

      /* media */
      .qp-media { margin: 8px 0 14px; }
      .qp-image {
        width: 100%;
        max-width: 680px;
        border-radius: 14px;
        display: block;
        box-shadow: 0 6px 22px rgba(0,0,0,.06);
      }
      .qp-ref { margin-top: 6px; }

      /* generic inputs */
      .inp {
        width: min(720px, 100%);
        border: 1px solid #eaeaea;
        border-radius: 12px;
        padding: 10px 12px;
        font: inherit;
        background: #fff;
      }

      /* MCQ/POLL card grid */
      .choice-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(260px, 1fr));
        gap: 12px;
      }
      @media (max-width: 820px) {
        .choice-grid { grid-template-columns: 1fr; }
      }

      .choice-card {
        border: 1px solid rgba(0,0,0,.06);
        background: #fff;
        border-radius: 16px;
        padding: 16px 16px 16px 14px;
        display: grid;
        grid-template-columns: 44px 1fr;
        align-items: center;
        gap: 14px;
        text-align: left;
        cursor: pointer;
        transition:
          transform .08s ease,
          box-shadow .14s ease,
          border-color .14s ease,
          background .14s ease,
          color .14s ease;
      }
      .choice-card:hover:not(.disabled) {
        transform: translateY(-1px);
        box-shadow: 0 10px 26px rgba(0,0,0,.06);
        border-color: color-mix(in oklab, var(--accent) 45%, #0000);
      }
      .choice-card.selected {
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        color: #fff;
        border-color: transparent;
        box-shadow: 0 14px 28px color-mix(in oklab, var(--accent) 28%, #0000);
      }
      .choice-card.disabled { cursor: not-allowed; opacity: .8; }

      .choice-letter {
        width: 44px; height: 44px; border-radius: 12px;
        display: grid; place-items: center;
        font-weight: 800;
        background: rgba(0,0,0,.06);
        color: #333;
      }
      .choice-card.selected .choice-letter {
        background: rgba(255,255,255,.25);
        color: #fff;
      }

      .choice-body { display: flex; align-items: center; gap: 12px; }
      .choice-text { font-weight: 700; line-height: 1.25; }
      .choice-thumb {
        width: 54px; height: 54px; object-fit: cover; flex: none;
        border-radius: 10px; border: 1px solid rgba(255,255,255,.4);
      }

      /* blanks (fallback list) */
      .blank-list { margin: 0; padding-left: 18px; }
      .blank-item + .blank-item { margin-top: 10px; }

      /* Pose & Discuss */
      .pad-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 14px;
      }
      @media (max-width: 900px) {
        .pad-grid { grid-template-columns: 1fr; }
      }
      .pad-col {
        background: #fff;
        border: 1px solid #eee;
        border-radius: 14px;
        padding: 12px;
      }
      .pad-title {
        font-weight: 700;
        margin-bottom: 8px;
      }

      .kp-btn {
        border: 1px solid color-mix(in oklab, var(--accent) 55%, #0000);
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        color: #fff;
        border-radius: 10px;
        font-weight: 600;
        padding: 6px 10px;
        cursor: pointer;
      }

      .kp-panel {
        overflow: hidden;
        max-height: 0;
        transition: max-height .22s ease;
      }
      .kp-panel.open { max-height: 480px; }
      .kp-list { margin: 8px 0 0; padding-left: 18px; }

      /* FIB inline bubble styling */
      .fib-bubble {
        line-height: 1.8;
        font-size: 1.06rem;
      }
      .fib-text { white-space: pre-wrap; }
      .fib-input {
        display: inline-block;
        min-width: 110px;
        max-width: 260px;
        padding: 6px 10px;
        margin: 0 6px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: #fff;
        box-shadow: 0 1px 0 rgba(0,0,0,.02);
        font: inherit;
        vertical-align: baseline;
      }
      .fib-input:focus {
        outline: 2px solid color-mix(in oklab, var(--accent) 40%, #0000);
        border-color: color-mix(in oklab, var(--accent) 60%, #0000);
      }

      /* small utility */
      .tiny { font-size: 12px; }
    `}</style>
  );
}
