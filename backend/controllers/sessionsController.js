// controllers/sessionsController.js
const Joi = require('joi');
const sessionsService = require('../services/sessionsService');
const ResponseModel = require('../models/responseModel');

// Start a session
exports.startSession = async (req, res) => {
  const schema = Joi.object({ activityId: Joi.string().required() });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json(ResponseModel.error(error.message));

  try {
    const result = await sessionsService.startSession(value.activityId, req.user._id, req.app);
    res.json(ResponseModel.success(result));
  } catch (err) {
    res.status(400).json(ResponseModel.error(err.message));
  }
};

// Stop session
exports.stopSession = async (req, res) => {
  try {
    await sessionsService.stopSession(req.params.id, req.app);
    res.json(ResponseModel.success({ ok: true }));
  } catch (err) {
    res.status(400).json(ResponseModel.error(err.message));
  }
};

// Student join
exports.joinSession = async (req, res) => {
  if (!req.user || req.user.role !== 'student') 
    return res.status(403).json(ResponseModel.error('Students only'));

  const schema = Joi.object({ code: Joi.string().required() });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json(ResponseModel.error(error.message));

  try {
    const session = await sessionsService.joinSession(value.code);
    res.json(ResponseModel.success(session));
  } catch (err) {
    res.status(404).json(ResponseModel.error(err.message));
  }
};

// Submit answer
exports.submitAnswer = async (req, res) => {
  if (!req.user || req.user.role !== 'student')
    return res.status(403).json(ResponseModel.error('Students only'));

  const schema = Joi.object({
    questionIndex: Joi.number().min(0).required(),
    answer: Joi.alternatives().try(Joi.number(), Joi.string()).required()
  });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json(ResponseModel.error(error.message));

  try {
    await sessionsService.submitAnswer(req.params.id, value, req.user._id, req.app);
    res.json(ResponseModel.success({ ok: true }));
  } catch (err) {
    res.status(400).json(ResponseModel.error(err.message));
  }
};

// Aggregates
exports.getAggregate = async (req, res) => {
  try {
    const agg = await sessionsService.getAggregate(req.params.id);
    res.json(ResponseModel.success(agg));
  } catch (err) {
    res.status(404).json(ResponseModel.error(err.message));
  }
};
