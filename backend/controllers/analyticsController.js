// backend/controllers/analyticsController.js
const mongoose = require("mongoose");
const QuizSession = require("../models/quizSessionModel");
const Response = require("../models/responseModel");
const Quiz = require("../models/quizModel");
const User = require("../models/userModel");
const Course = require("../models/courseModel");

const OID = (v) =>
  mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null;

// For responses that stored either session or quizSessionId
const SID_PROJECT = {
  $project: {
    sid: {
      $cond: [{ $ifNull: ["$session", false] }, "$session", "$quizSessionId"],
    },
    student: "$student",
    isCorrect: "$isCorrect",
    pointsEarned: { $ifNull: ["$pointsEarned", 0] },
    questionIndex: "$questionIndex",
  },
};

async function quizzesInCourse(courseId) {
  const ids = [];
  const asObj = OID(courseId);
  if (asObj) ids.push(asObj);
  ids.push(courseId);

  // Support both new (courseId) and legacy (course) fields
  const quizzes = await Quiz.find({
    $or: [{ courseId: { $in: ids } }, { course: { $in: ids } }],
  })
    .select("_id title questions")
    .lean();

  return quizzes;
}

function pct(n, d) {
  if (!d) return 0;
  return n / d;
}


 // GET /api/analytics/course/:courseId/summary
 //{
 //  sessionsHeld, activeStudents, avgParticipation, avgMark,
 //  topStudents: [{ studentId, name, avg, quizzesDone }],
 //  atRiskStudents: [...],
//  perQuiz: [{ quizId, title, participants, questions:[{index, difficulty}] }],
//   students: [{_id, name}],
//   registeredCount
// }
 
exports.courseSummary = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId)
      .select("_id students courseName")
      .lean();
    const registeredIds = (course?.students || []).map(String);
    const registeredCount = registeredIds.length;

    // quizzes & sessions
    const quizzes = await quizzesInCourse(courseId);
    const quizIds = quizzes.map((q) => q._id);
    if (quizIds.length === 0) {
      const students = registeredCount
        ? await User.find({ _id: { $in: registeredIds } })
            .select("_id name")
            .lean()
        : [];
      return res.json({
        sessionsHeld: 0,
        activeStudents: 0,
        avgParticipation: 0,
        avgMark: 0,
        topStudents: [],
        atRiskStudents: [],
        perQuiz: [],
        students,
        registeredCount,
      });
    }

    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id quiz participants startedAt endedAt status")
      .lean();

    const sids = sessions.map((s) => s._id);
    const sessionsHeld = sids.length;
    const sessionById = new Map(sessions.map((s) => [String(s._id), s]));
    const quizById = new Map(quizzes.map((q) => [String(q._id), q]));

    // Aggregate by session (responders, totals)
    const respBySession = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: "$sid",
          total: { $sum: 1 },
          correct: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          respondersSet: { $addToSet: "$student" },
        },
      },
      {
        $project: {
          _id: 1,
          total: 1,
          correct: 1,
          respondersCount: { $size: "$respondersSet" },
          respondersSet: 1,
        },
      },
    ]);
    const bySid = new Map(respBySession.map((r) => [String(r._id), r]));

    // active students (participants + responders)
    const activeSet = new Set();
    for (const s of sessions) {
      for (const p of s.participants || [])
        if (p.user) activeSet.add(String(p.user));
      const agg = bySid.get(String(s._id));
      if (agg?.respondersSet)
        for (const u of agg.respondersSet) activeSet.add(String(u));
    }
    const activeStudents = activeSet.size;

    // --- Average participation (responders ÷ registered), averaged across sessions ---
    let partSum = 0,
      partDen = 0;
    for (const s of sessions) {
      const responders = bySid.get(String(s._id))?.respondersCount || 0;
      if (registeredCount > 0) {
        partSum += responders / registeredCount;
        partDen += 1;
      }
    }
    const avgParticipation = partDen ? partSum / partDen : 0;

    // --- Per (session, student, question) -> any-correct, to count correct Qs per quiz ---
    const bySidStudentQ = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: { sid: "$sid", student: "$student", qIndex: "$questionIndex" },
          anyCorrect: { $max: { $cond: ["$isCorrect", 1, 0] } },
        },
      },
      {
        $group: {
          _id: { sid: "$_id.sid", student: "$_id.student" },
          correctQ: { $sum: "$anyCorrect" },
        },
      },
    ]);

    // Build student -> quiz -> {correct, total=quizQuestionCount}
    const stuQuizMap = new Map(); // studentId -> Map(quizId -> {correct,total, did})
    for (const r of bySidStudentQ) {
      const sidStr = String(r._id.sid);
      const stuId = String(r._id.student || "");
      const sess = sessionById.get(sidStr);
      if (!stuId || !sess) continue;

      const quizId = String(sess.quiz);
      const qCount = Array.isArray(quizById.get(quizId)?.questions)
        ? quizById.get(quizId).questions.length
        : 0;

      const byQuiz = stuQuizMap.get(stuId) || new Map();
      const cell = byQuiz.get(quizId) || { correct: 0, total: 0, did: false };
      cell.correct += Number(r.correctQ || 0);
      cell.total = Number(qCount || 0); // denominator is per-quiz Q count
      cell.did = true;
      byQuiz.set(quizId, cell);
      stuQuizMap.set(stuId, byQuiz);
    }

    // Names for display (registered + encountered)
    const idsForNames = new Set([...registeredIds, ...stuQuizMap.keys()]);
    const users = await User.find({ _id: { $in: [...idsForNames] } })
      .select("_id name")
      .lean();
    const nameById = new Map(
      users.map((u) => [String(u._id), u.name || "Student"])
    );

    // list of registered students for UI search
    const students = registeredCount
      ? registeredIds.map((id) => ({
          _id: id,
          name: nameById.get(String(id)) || "Student",
        }))
      : [];

    // --- Per-student average across ALL quizzes (missing quizzes = 0) ---
    const studentRows = registeredIds.map((stuId) => {
      const byQuiz = stuQuizMap.get(String(stuId)) || new Map();
      let sumPct = 0;
      let done = 0;

      for (const q of quizzes) {
        const qid = String(q._id);
        const qCount = Array.isArray(q.questions) ? q.questions.length : 0;
        const cell = byQuiz.get(qid);
        if (cell?.did) done += 1;
        const percent = qCount > 0 && cell ? cell.correct / qCount : 0;
        sumPct += percent;
      }
      const avg = quizzes.length ? sumPct / quizzes.length : 0;

      return {
        studentId: stuId,
        avg,
        quizzesDone: done,
      };
    });

    // Course avg mark = mean of all registered students' averages
    const avgMark = studentRows.length
      ? studentRows.reduce((a, b) => a + (b.avg || 0), 0) / studentRows.length
      : 0;

    const topStudents = studentRows
      .filter((x) => (x.avg || 0) >= 0.8)
      .sort((a, b) => (b.avg || 0) - (a.avg || 0))
      .slice(0, 10)
      .map((x) => ({
        studentId: x.studentId,
        name: nameById.get(String(x.studentId)) || "Student",
        avg: x.avg || 0,
        quizzesDone: x.quizzesDone || 0,
      }));

    const atRiskStudents = studentRows
      .filter((x) => (x.avg || 0) <= 0.5)
      .sort((a, b) => (a.avg || 0) - (b.avg || 0))
      .slice(0, 10)
      .map((x) => ({
        studentId: x.studentId,
        name: nameById.get(String(x.studentId)) || "Student",
        avg: x.avg || 0,
        quizzesDone: x.quizzesDone || 0,
      }));

    // --- Per-quiz difficulty (percent correct among attempts) ---
    const bySidQ = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: { sid: "$sid", qIndex: "$questionIndex" },
          total: { $sum: 1 },
          correct: { $sum: { $cond: ["$isCorrect", 1, 0] } },
        },
      },
    ]);

    const perQuizMap = new Map(); // quizId -> { participants, questions: Map(index->{correct,total}) }
    for (const s of sessions) {
      const k = String(s.quiz);
      const entry = perQuizMap.get(k) || {
        participants: 0,
        questions: new Map(),
      };
      entry.participants += (s.participants || []).length;
      perQuizMap.set(k, entry);
    }

    for (const row of bySidQ) {
      const sidStr = String(row._id.sid);
      const sess = sessionById.get(sidStr);
      if (!sess) continue;
      const qid = String(sess.quiz);
      const entry = perQuizMap.get(qid) || {
        participants: 0,
        questions: new Map(),
      };
      const idx = Number(row._id.qIndex || 0);
      const q = entry.questions.get(idx) || { correct: 0, total: 0 };
      q.correct += row.correct || 0;
      q.total += row.total || 0;
      entry.questions.set(idx, q);
      perQuizMap.set(qid, entry);
    }

    const perQuiz = quizzes.map((q) => {
      const e = perQuizMap.get(String(q._id)) || {
        participants: 0,
        questions: new Map(),
      };
      const questions = [];
      const count = Array.isArray(q.questions) ? q.questions.length : 0;
      for (let i = 0; i < count; i++) {
        const agg = e.questions.get(i) || { correct: 0, total: 0 };
        questions.push({
          index: i,
          difficulty: pct(agg.correct, agg.total), // % correct among attempts
        });
      }
      return {
        quizId: q._id,
        title: q.title,
        participants: e.participants,
        questions,
      };
    });

    res.json({
      sessionsHeld,
      activeStudents,
      avgParticipation,
      avgMark,
      topStudents,
      atRiskStudents,
      perQuiz,
      students,
      registeredCount,
    });
  } catch (e) {
    console.error("courseSummary error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

//
// GET /api/analytics/course/:courseId/trend
// returns { trend: [{ sessionId, startedAt, participation, accuracy }] }
// participation = responders / registeredCount
 
exports.courseTrend = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).select("students").lean();
    const registeredCount = (course?.students || []).length;

    const quizzes = await quizzesInCourse(courseId);
    const quizIds = quizzes.map((q) => q._id);

    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id participants startedAt")
      .sort({ startedAt: 1 })
      .lean();

    const sids = sessions.map((s) => s._id);

    const resp = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: "$sid",
          total: { $sum: 1 },
          correct: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          respondersSet: { $addToSet: "$student" },
        },
      },
      {
        $project: {
          _id: 1,
          total: 1,
          accuracy: {
            $cond: [
              { $gt: ["$total", 0] },
              { $divide: ["$correct", "$total"] },
              0,
            ],
          },
          responders: { $size: "$respondersSet" },
        },
      },
    ]);

    const bySid = new Map(resp.map((r) => [String(r._id), r]));

    const trend = sessions.map((s) => {
      const r = bySid.get(String(s._id));
      const responders = r ? r.responders : 0;
      const participation =
        registeredCount > 0 ? responders / registeredCount : 0;
      return {
        sessionId: s._id,
        startedAt: s.startedAt,
        participation,
        accuracy: r ? r.accuracy : 0,
      };
    });

    res.json({ trend });
  } catch (e) {
    console.error("courseTrend error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};

//
// GET /api/analytics/course/:courseId/quizzes
// returns [{ quizId, title, questionCount, sessionCount }]

exports.courseQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const quizzes = await quizzesInCourse(courseId);
    const quizIds = quizzes.map((q) => q._id);

    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id quiz")
      .lean();

    const byQuiz = new Map();
    for (const s of sessions) {
      const k = String(s.quiz || "");
      if (!k) continue;
      byQuiz.set(k, (byQuiz.get(k) || 0) + 1);
    }

    const out = quizzes.map((q) => ({
      quizId: q._id,
      title: q.title,
      questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
      sessionCount: byQuiz.get(String(q._id)) || 0,
    }));

    res.json({ quizzes: out });
  } catch (e) {
    console.error("courseQuizzes error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};


// GET /api/analytics/quiz/:quizId/summary
 // {
//  participation, completion,
//   scoreHistogram:[10],
//   questions:[{index, difficulty}]
 // }

exports.quizSummary = async (req, res) => {
  try {
    const { quizId } = req.params;
    // NEW: get quiz size for correct denominator
    const quizDoc = await Quiz.findById(quizId).select("questions").lean();
    const questionCountQuiz = Array.isArray(quizDoc?.questions)
      ? quizDoc.questions.length
      : 0;
    const sessions = await QuizSession.find({ quiz: quizId })
      .select("_id participants")
      .lean();
    const sids = sessions.map((s) => s._id);

    const agg = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: { sid: "$sid", qIndex: "$questionIndex" },
          total: { $sum: 1 },
          correct: { $sum: { $cond: ["$isCorrect", 1, 0] } },
          respondersSet: { $addToSet: "$student" },
        },
      },
    ]);

    // per-session responders (among attendees)
    const respondersBySid = new Map();
    for (const row of agg) {
      const sid = String(row._id.sid);
      respondersBySid.set(
        sid,
        Math.max(
          respondersBySid.get(sid) || 0,
          (row.respondersSet || []).length
        )
      );
    }

    let partSum = 0,
      partDen = 0;
    for (const s of sessions) {
      const responders = respondersBySid.get(String(s._id)) || 0;
      const attendees = Math.max((s.participants || []).length, responders);
      if (attendees > 0) {
        partSum += responders / attendees;
        partDen += 1;
      }
    }
    const participation = partDen ? partSum / partDen : 0;

    // difficulty
    const byIdx = new Map();
    for (const row of agg) {
      const idx = Number(row._id.qIndex || 0);
      const e = byIdx.get(idx) || { correct: 0, total: 0 };
      e.correct += row.correct || 0;
      e.total += row.total || 0;
      byIdx.set(idx, e);
    }
    const maxIdx = Math.max(-1, ...[...byIdx.keys()]);
    const questions = [];
    for (let i = 0; i <= maxIdx; i++) {
      const e = byIdx.get(i) || { correct: 0, total: 0 };
      questions.push({ index: i, difficulty: pct(e.correct, e.total) });
    }

    // Student score histogram (0..9 buckets) for this quiz
    // Student score histogram by quiz (0..9 buckets)  // <-- REPLACE OLD BLOCK WITH THIS
    // Each student's score = (# distinct questions they got correct at least once)
    //                        ÷ (total # questions in the quiz)
    const perStudentCorrectQ = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      // for each (student, question), were they ever correct?
      {
        $group: {
          _id: { student: "$student", qIndex: "$questionIndex" },
          anyCorrect: { $max: { $cond: ["$isCorrect", 1, 0] } },
        },
      },
      // sum #correct questions per student
      {
        $group: {
          _id: "$_id.student",
          correctQ: { $sum: "$anyCorrect" },
        },
      },
    ]);

    const scoreHistogram = Array(10).fill(0);
    const denom = questionCountQuiz > 0 ? questionCountQuiz : 1; // avoid /0 if quiz has no questions
    for (const row of perStudentCorrectQ) {
      const acc = (row.correctQ || 0) / denom;
      const bucket = Math.min(9, Math.floor(acc * 10));
      scoreHistogram[bucket] += 1;
    }

    // Completion (answered all questions at least once)
    // Completion rate: answered all questions
    const questionCount = questionCountQuiz || 1; // <-- UPDATED
    const completed = await Response.aggregate([
      {
        $match: {
          $or: [{ session: { $in: sids } }, { quizSessionId: { $in: sids } }],
        },
      },
      SID_PROJECT,
      { $group: { _id: { student: "$student", qIndex: "$questionIndex" } } },
      { $group: { _id: "$_id.student", qAnswered: { $sum: 1 } } },
      {
        $group: {
          _id: null,
          completed: {
            $sum: { $cond: [{ $gte: ["$qAnswered", questionCount] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          rate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $divide: ["$completed", "$total"] },
              0,
            ],
          },
        },
      },
    ]);

    const completion = completed[0]?.rate || 0;

    res.json({
      participation,
      completion,
      scoreHistogram,
      questions,
    });
  } catch (e) {
    console.error("quizSummary error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};


// GET /api/analytics/student/:studentId/course/:courseId/summary
// {
//   student: {_id, name},
//   totalQuizzes, doneCount,
//   avgMark, participationRate,
//   perQuiz: [{quizId, title, percent, correct, answered, total}]
// }

exports.studentCourseSummary = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    const quizzes = await quizzesInCourse(courseId);
    const quizIds = quizzes.map((q) => q._id);
    const quizById = new Map(quizzes.map((q) => [String(q._id), q]));

    const sessions = await QuizSession.find({ quiz: { $in: quizIds } })
      .select("_id quiz")
      .lean();
    const sids = sessions.map((s) => s._id);
    const sessionById = new Map(sessions.map((s) => [String(s._id), s]));

    // (sid, qIndex) -> anyCorrect for this student (also counts answered)
    const rows = await Response.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { session: { $in: sids } },
                { quizSessionId: { $in: sids } },
              ],
            },
            { student: OID(studentId) || studentId },
          ],
        },
      },
      SID_PROJECT,
      {
        $group: {
          _id: { sid: "$sid", qIndex: "$questionIndex" },
          anyCorrect: { $max: { $cond: ["$isCorrect", 1, 0] } },
        },
      },
    ]);

    // Accumulate per quiz: correctQ, answered (unique questions answered), total = quiz Q count
    const perQuizAgg = new Map(); // quizId -> {correct,total,answeredSet, did}
    for (const r of rows) {
      const sidStr = String(r._id.sid);
      const sess = sessionById.get(sidStr);
      if (!sess) continue;
      const qid = String(sess.quiz);
      const qCount = Array.isArray(quizById.get(qid)?.questions)
        ? quizById.get(qid).questions.length
        : 0;

      const cell = perQuizAgg.get(qid) || {
        correct: 0,
        total: qCount,
        answeredSet: new Set(),
        did: false,
      };
      cell.correct += Number(r.anyCorrect || 0);
      cell.total = qCount;
      cell.answeredSet.add(Number(r._id.qIndex));
      cell.did = true;
      perQuizAgg.set(qid, cell);
    }

    const perQuiz = [];
    let sumPct = 0,
      nAll = quizzes.length,
      doneCount = 0;

    for (const q of quizzes) {
      const qid = String(q._id);
      const qCount = Array.isArray(q.questions) ? q.questions.length : 0;
      const cell = perQuizAgg.get(qid) || {
        correct: 0,
        total: qCount,
        answeredSet: new Set(),
        did: false,
      };
      if (cell.did) doneCount += 1;

      const answered = cell.answeredSet.size;
      const percent = qCount ? cell.correct / qCount : 0;
      sumPct += percent;

      perQuiz.push({
        quizId: qid,
        title: q.title || "Quiz",
        percent,
        correct: cell.correct,
        answered,
        total: qCount,
      });
    }

    const totalQuizzes = nAll;
    const participationRate = totalQuizzes ? doneCount / totalQuizzes : 0;
    const avgMark = nAll ? sumPct / nAll : 0;

    const student = await User.findById(studentId).select("_id name").lean();

    res.json({
      student: student
        ? { _id: student._id, name: student.name || "Student" }
        : { _id: studentId, name: "Student" },
      totalQuizzes,
      doneCount,
      avgMark,
      participationRate,
      perQuiz,
    });
  } catch (e) {
    console.error("studentCourseSummary error:", e);
    res.status(500).json({ message: "Server error", error: e.message });
  }
};
