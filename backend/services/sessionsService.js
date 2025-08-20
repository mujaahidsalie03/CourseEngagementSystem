// services/sessionsService.js
const sessionsRepo = require('../repositories/sessionsRepository');
const Response = require('../models/responseModel');

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

exports.startSession = async (activityId, lecturerId, app) => {
  const activity = await sessionsRepo.findActivityByLecturer(activityId, lecturerId);
  if (!activity) throw new Error('Activity not found');

  const session = await sessionsRepo.createSession({
    activity: activity._id,
    status: 'live',
    joinCode: makeCode(),
    startedAt: new Date()
  });

  app.get('io').to(`session:${session._id}`).emit('status', { status: 'live' });
  return { sessionId: session._id, joinCode: session.joinCode };
};

exports.stopSession = async (sessionId, app) => {
  const session = await sessionsRepo.findSessionById(sessionId);
  if (!session) throw new Error('Not found');

  session.status = 'stopped';
  session.endedAt = new Date();
  await session.save();

  app.get('io').to(`session:${session._id}`).emit('status', { status: 'stopped' });
};

exports.joinSession = async (code) => {
  const session = await sessionsRepo.findLiveSessionByCode(code.toUpperCase());
  if (!session) throw new Error('Session not live or code invalid');
  return { sessionId: session._id, activity: session.activity };
};

exports.submitAnswer = async (sessionId, value, studentId, app) => {
  const session = await sessionsRepo.findSessionWithActivity(sessionId);
  if (!session || session.status !== 'live') throw new Error('Session not live');

  await sessionsRepo.upsertResponse(session._id, value.questionIndex, studentId, value.answer);

  const agg = await sessionsRepo.getAggregates(session._id);
  app.get('io').to(`session:${session._id}`).emit('aggregate', agg);
};

exports.getAggregate = async (sessionId) => {
  const session = await sessionsRepo.findSessionById(sessionId);
  if (!session) throw new Error('Not found');
  return sessionsRepo.getAggregates(session._id);
};
