const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Activity = require('../models/Activity');
const Session = require('../models/Session');
const Response = require('../models/Response');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// Start a session
router.post('/', auth(), requireRole('lecturer'), async (req, res) => {
  const schema = Joi.object({ activityId: Joi.string().required() });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const activity = await Activity.findOne({ _id: value.activityId, createdBy: req.user._id });
  if (!activity) return res.status(404).json({ error: 'Activity not found' });

  const session = await Session.create({
    activity: activity._id,
    status: 'live',
    joinCode: makeCode(),
    startedAt: new Date()
  });

  req.app.get('io').to(`session:${session._id}`).emit('status', { status: 'live' });
  res.json({ sessionId: session._id, joinCode: session.joinCode });
});

// Stop session
router.post('/:id/stop', auth(), requireRole('lecturer'), async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  session.status = 'stopped';
  session.endedAt = new Date();
  await session.save();
  req.app.get('io').to(`session:${session._id}`).emit('status', { status: 'stopped' });
  res.json({ ok: true });
});

// Student join by code
router.post('/join', auth(), async (req, res) => {
  if (!req.user || req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const schema = Joi.object({ code: Joi.string().required() });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const session = await Session.findOne({ joinCode: value.code.toUpperCase(), status: 'live' })
    .populate('activity');
  if (!session) return res.status(404).json({ error: 'Session not live or code invalid' });

  res.json({ sessionId: session._id, activity: session.activity });
});

// Submit answer
router.post('/:id/answer', auth(), async (req, res) => {
  if (!req.user || req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const schema = Joi.object({
    questionIndex: Joi.number().min(0).required(),
    answer: Joi.alternatives().try(Joi.number(), Joi.string()).required()
  });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const session = await Session.findById(req.params.id).populate('activity');
  if (!session || session.status !== 'live') return res.status(400).json({ error: 'Session not live' });

  await Response.findOneAndUpdate(
    { session: session._id, questionIndex: value.questionIndex, student: req.user._id },
    { $set: { answer: value.answer, answeredAt: new Date() } },
    { upsert: true, new: true }
  );

  // Aggregate + push live
  const agg = await Response.aggregate([
    { $match: { session: session._id } },
    { $group: { _id: { q: '$questionIndex', a: '$answer' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.q', options: { $push: { answer: '$_id.a', count: '$count' } } } },
    { $sort: { _id: 1 } }
  ]);

  req.app.get('io').to(`session:${session._id}`).emit('aggregate', agg);
  res.json({ ok: true });
});

// Lecturer pulls aggregates once (e.g. on refresh)
router.get('/:id/aggregate', auth(), requireRole('lecturer'), async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });

  const agg = await Response.aggregate([
    { $match: { session: session._id } },
    { $group: { _id: { q: '$questionIndex', a: '$answer' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.q', options: { $push: { answer: '$_id.a', count: '$count' } } } },
    { $sort: { _id: 1 } }
  ]);
  res.json(agg);
});
router.get('/ping', (req, res) => res.json({ ok: true, route: 'sessions' }));
module.exports = router;
