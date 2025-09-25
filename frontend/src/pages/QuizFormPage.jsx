// src/pages/QuizFormPage.jsx
import Header from "../components/Header.jsx";
import Button from "../components/Button.jsx";
import Input from "../components/Input.jsx";
import ImagePicker from "../components/ImagePicker.jsx";
import { nanoid } from "nanoid";
import { createQuiz, getQuiz, updateQuiz } from "../api/appApi";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const TYPE_OPTIONS = [
  { value: "mcq", label: "MCQ" },
  { value: "poll", label: "Poll" },
  { value: "word_cloud", label: "Word Cloud" },
  { value: "pose_and_discuss", label: "Pose & Discuss" },
  { value: "fill_blank", label: "Fill in the Blank" },
];

// ---------- utilities ----------
function parseBlanks(template) {
  const re = /\{([^}]+)\}/g;
  const blanks = [];
  let m;
  while ((m = re.exec(template)) !== null) {
    const alts = m[1].split("|").map((s) => s.trim()).filter(Boolean);
    if (alts.length) blanks.push(alts);
  }
  return blanks;
}

function defaultSettings(type) {
  return {
    points: 1,
    timeLimit: 60,
    shuffleOptions: type === "mcq" || type === "poll",
    allowMultiple: type === "mcq" ? false : undefined,
    // removed: anonymity, moderation, maxWords, requireJustification, wordLimit
    caseSensitive: type === "fill_blank" ? false : undefined,
    trimWhitespace: type === "fill_blank" ? true : undefined,
  };
}

function defaultQuestion(type = "mcq") {
  const base = {
    id: nanoid(),
    type,
    prompt: "",
    settings: defaultSettings(type),
    image: null,
    imageAlt: "",
  };
  if (type === "mcq" || type === "poll") {
    return { ...base, answers: [{ id: nanoid(), text: "", correct: false }] };
  }
  if (type === "fill_blank") {
    return { ...base, template: "", blanks: [] };
  }
  return base;
}

// lightweight client-side validation (friendly messages)
function validateQuizPayloadClient(payload) {
  const errors = [];

  if (!payload.title?.trim()) errors.push("Title is required.");
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    errors.push("Add at least one question.");
    return errors;
  }

  payload.questions.forEach((q, i) => {
    const n = i + 1;
    switch (q.type) {
      case "mcq": {
        const opts = (q.answers || []).filter(a => a.text?.trim());
        if (opts.length < 2) errors.push(`Q${n}: MCQ needs at least 2 options.`);
        if (!opts.some(a => a.correct)) errors.push(`Q${n}: MCQ needs at least one correct option.`);
        if (!q.prompt?.trim()) errors.push(`Q${n}: Prompt is required.`);
        break;
      }
      case "poll": {
        const opts = (q.answers || []).filter(a => a.text?.trim());
        if (opts.length < 2) errors.push(`Q${n}: Poll needs at least 2 options.`);
        if (!q.prompt?.trim()) errors.push(`Q${n}: Prompt is required.`);
        break;
      }
      case "word_cloud": {
        if (!q.prompt?.trim()) errors.push(`Q${n}: Prompt is required.`);
        break;
      }
      case "pose_and_discuss": {
        if (!q.prompt?.trim()) errors.push(`Q${n}: Prompt is required.`);
        break;
      }
      case "fill_blank": {
        const tpl = q.template || "";
        if (!tpl.includes("{")) errors.push(`Q${n}: Add at least one {blank} in the sentence.`);
        break;
      }
      default:
        errors.push(`Q${n}: Unsupported question type.`);
    }
  });

  return errors;
}

// server <-> client type mapping for fill-in-the-blank
const toServerType = (t) => (t === "fill_blank" ? "fill_in_the_blank" : t);
const toClientType = (t) => (t === "fill_in_the_blank" ? "fill_blank" : t);

// ---------- editors ----------
function AnswerEditor({ answers, setAnswers, showCorrect }) {
  const update = (id, patch) =>
    setAnswers(answers.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <>
      {answers.map((a) => (
        <div key={a.id} className="row" style={{ gap: 8, marginBottom: 6 }}>
          <Input
            placeholder="Answer option"
            value={a.text}
            onChange={(e) => update(a.id, { text: e.target.value })}
          />
          {showCorrect && (
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={!!a.correct}
                onChange={(e) => update(a.id, { correct: e.target.checked })}
              />
              <span>Correct</span>
            </label>
          )}
          <Button
            variant="secondary"
            onClick={() => setAnswers(answers.filter((x) => x.id !== a.id))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() =>
          setAnswers([...answers, { id: nanoid(), text: "", correct: false }])
        }
      >
        Add Option
      </Button>
    </>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          className={`seg-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Settings({ q, onChange }) {
  const s = q.settings || {};
  const patch = (p) => onChange({ ...q, settings: { ...s, ...p } });
  return (
    <div className="panel">
      <div className="panel-title">Question Settings</div>
      <div className="settings-grid tight">
        <label className="field">
          <span>Points</span>
          <input
            className="input"
            type="number"
            min="0"
            value={s.points ?? 0}
            onChange={(e) => patch({ points: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Time Limit (sec)</span>
          <input
            className="input"
            type="number"
            min="10"
            step="5"
            value={s.timeLimit ?? 60}
            onChange={(e) => patch({ timeLimit: Number(e.target.value) })}
          />
        </label>

        {(q.type === "mcq" || q.type === "poll") && (
          <div className="field no-label">
            <span className="label-spacer" />
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={!!s.shuffleOptions}
                onChange={(e) => patch({ shuffleOptions: e.target.checked })}
              />
              <span>Shuffle options</span>
            </label>
          </div>
        )}

        {/* Removed:
            - Anonymous responses (all types)
            - Word Cloud: Max words per response, Hold for moderation
            - Pose & Discuss: Word limit, Require justification
        */}

        {q.type === "fill_blank" && (
          <>
            <div className="field no-label">
              <span className="label-spacer" />
              <label className="pill-toggle">
                <input
                  type="checkbox"
                  checked={!!s.caseSensitive}
                  onChange={(e) => patch({ caseSensitive: e.target.checked })}
                />
                <span>Case sensitive</span>
              </label>
            </div>
            <div className="field no-label">
              <span className="label-spacer" />
              <label className="pill-toggle">
                <input
                  type="checkbox"
                  checked={s.trimWhitespace !== false}
                  onChange={(e) => patch({ trimWhitespace: e.target.checked })}
                />
                <span>Trim whitespace</span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- main page ----------
export default function QuizFormPage({ mode }) {
  const { courseId, quizId } = useParams();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  // map server question -> client question
  const toClientQuestion = (srv) => {
    const type = toClientType(srv.questionType || "mcq");
    const base = {
      id: nanoid(),
      type,
      prompt: srv.questionText || "",
      image: srv.image || null,
      imageAlt: srv.imageAlt || "",
      settings: {
        ...defaultSettings(type),
        points: srv.points ?? 1,
        timeLimit: srv.timeLimit ?? 60,
        shuffleOptions: srv.shuffleOptions ?? (type === "mcq" || type === "poll"),
      },
    };

    if (type === "mcq" || type === "poll") {
      base.answers = (srv.answers || []).map((a) => ({
        id: nanoid(),
        text: a.answerText || "",
        correct: !!a.isCorrect,
      }));
      base.settings.shuffleOptions = !!(srv.shuffleOptions ?? base.settings.shuffleOptions);
    }
    if (type === "pose_and_discuss") {
      base.modelAnswer = srv.modelAnswer || "";
      // removed: requireJustification / wordLimit mapping
    }
    if (type === "word_cloud") {
      base.maxSubmissions = srv.maxSubmissions ?? 1;
      // removed: allowAnonymous / moderation / maxWords mapping
    }
    if (type === "fill_blank") {
      base.template = srv.template || "";
      base.blanks = parseBlanks(base.template);
      base.settings.caseSensitive = !!srv.caseSensitive;
      base.settings.trimWhitespace = srv.trimWhitespace !== false;
      // caseSensitive/trimWhitespace are controlled by settings and respected server-side
    }
    return base;
  };

  // map client question -> server question
  const toServerQuestion = (cli) => {
    const questionType = toServerType(cli.type);
    const base = {
      questionType,
      questionText: cli.type === "fill_blank" ? undefined : (cli.prompt || ""),
      points: cli.settings?.points ?? 1,
      timeLimit: cli.settings?.timeLimit ?? 60,
      image: cli.image || null,      // ImagePicker gives {dataUrl,...} in dev
      imageAlt: cli.imageAlt || "",
    };

    if (cli.type === "mcq" || cli.type === "poll") {
      base.answers = (cli.answers || []).map((a) => ({
        answerText: a.text || "",
        isCorrect: !!a.correct,
      }));
      base.shuffleOptions = !!cli.settings?.shuffleOptions;
    }
    if (cli.type === "pose_and_discuss") {
      base.modelAnswer = cli.modelAnswer || "";
      // removed: requireJustification / wordLimit
    }
    if (cli.type === "word_cloud") {
      base.maxSubmissions = cli.maxSubmissions ?? 1;
      // removed: allowAnonymous / moderation / maxWords
    }
    if (cli.type === "fill_blank") {
      base.template = cli.template || "";
      base.blanks = Array.isArray(cli.blanks) ? cli.blanks : parseBlanks(base.template);
      // carry FIB controls via settings flags used by server comparator:
      base.caseSensitive = !!cli.settings?.caseSensitive;
      base.trimWhitespace = cli.settings?.trimWhitespace !== false;
    }
    return base;
  };

  useEffect(() => {
    (async () => {
      if (mode === "edit" && quizId) {
        const q = await getQuiz(quizId);
        setTitle(q.title ?? "");
        setQuestions((q.questions || []).map(toClientQuestion));
      } else if (mode === "create") {
        setQuestions([defaultQuestion("mcq")]); // seed with one question
      }
    })();
  }, [mode, quizId]);

  const addQuestion = (type = "mcq") =>
    setQuestions((prev) => [...prev, defaultQuestion(type)]);
  const removeQuestion = (id) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  const updateQuestion = (id, patch) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const save = async () => {
    if (saving) return;

    const clientPayload = {
      title: title.trim(),
      questions: questions, // validate on client shape first
    };

    const errs = validateQuizPayloadClient(clientPayload);
    if (errs.length) {
      alert(errs.join("\n"));
      return;
    }

    // transform to server shape
    const serverPayload = {
      title: title.trim(),
      questions: questions.map(toServerQuestion),
    };

    setSaving(true);
    try {
      if (mode === "create") {
        const created = await createQuiz(courseId, serverPayload);
        nav(`/courses/${created?.courseId || courseId}`);
      } else {
        await updateQuiz(quizId, serverPayload);
        nav(`/courses/${courseId}`);
      }
    } catch (err) {
      const msg =
        err?.details?.errors
          ? (Array.isArray(err.details.errors) ? err.details.errors.join("\n") : String(err.details.errors))
          : (err?.message || "Save failed");
      alert(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container">
        <h1>{mode === "create" ? "Create Quiz" : "Edit Quiz"}</h1>

        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>Quiz Title</div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Week 3 Agile Principles Quiz"
          />
        </div>

        <div style={{ marginTop: 16 }} className="row">
          <Button onClick={() => addQuestion()}>Add Question</Button>
          <Button variant="secondary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {questions.map((q, idx) => (
            <div key={q.id} className="card panel-lg">
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <h3>Q{idx + 1}</h3>
                <Button variant="secondary" onClick={() => removeQuestion(q.id)}>
                  Delete
                </Button>
              </div>

              <div style={{ marginTop: 6, marginBottom: 8 }}>
                <div style={{ marginBottom: 6 }}>Question Type</div>
                <Segmented
                  value={q.type}
                  onChange={(t) => {
                    const fresh = defaultQuestion(t);
                    updateQuestion(q.id, {
                      type: t,
                      answers: fresh.answers,
                      settings: fresh.settings,
                      image: q.image ?? null,
                      imageAlt: q.imageAlt ?? "",
                      template: fresh.template,
                      blanks: fresh.blanks,
                      prompt: t === "fill_blank" ? "" : q.prompt || "",
                    });
                  }}
                  options={TYPE_OPTIONS}
                />
              </div>

              {q.type !== "fill_blank" && (
                <>
                  <div style={{ marginTop: 6 }}>Prompt</div>
                  <Input
                    value={q.prompt}
                    onChange={(e) =>
                      updateQuestion(q.id, { prompt: e.target.value })
                    }
                    placeholder="Question text or prompt"
                  />
                </>
              )}

              {(q.type === "mcq" || q.type === "poll") && (
                <>
                  <div style={{ marginTop: 10, marginBottom: 6 }}>
                    Answer Options
                  </div>
                  <AnswerEditor
                    answers={q.answers || []}
                    setAnswers={(ans) => updateQuestion(q.id, { answers: ans })}
                    showCorrect={q.type === "mcq"} // hide 'correct' for polls
                  />
                </>
              )}

              {q.type === "pose_and_discuss" && (
                <>
                  <div style={{ marginTop: 10 }}>Model Answer (optional)</div>
                  <textarea
                    className="input"
                    rows={4}
                    value={q.modelAnswer || ""}
                    onChange={(e) =>
                      updateQuestion(q.id, { modelAnswer: e.target.value })
                    }
                  />
                </>
              )}

              {q.type === "fill_blank" && (
                <>
                  <div style={{ marginTop: 6 }}>Sentence with blanks</div>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g., The {heart} pumps {blood} through the body."
                    value={q.template || ""}
                    onChange={(e) => {
                      const template = e.target.value;
                      const blanks = parseBlanks(template);
                      updateQuestion(q.id, { template, blanks });
                    }}
                  />
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Mark blanks with <code>{'{word}'}</code>. Use alternatives
                    with <code>{'{color|colour}'}</code>.
                  </div>
                  <div className="panel" style={{ marginTop: 10 }}>
                    <div className="panel-title">
                      Detected blanks ({q.blanks?.length || 0})
                    </div>
                    <ol className="small">
                      {(q.blanks || []).map((alts, i) => (
                        <li key={i}>
                          <b>Blank {i + 1}:</b> {alts.join(" or ")}
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              )}

              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-title">Media (optional)</div>
                <ImagePicker
                  image={q.image}
                  onChange={(img) => updateQuestion(q.id, { image: img })}
                />
                <div style={{ marginTop: 8 }}>Caption / Description</div>
                <textarea
                  className="input"
                  rows={2}
                  value={q.imageAlt || ""}
                  onChange={(e) =>
                    updateQuestion(q.id, { imageAlt: e.target.value })
                  }
                />
              </div>

              <Settings q={q} onChange={(next) => updateQuestion(q.id, next)} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
