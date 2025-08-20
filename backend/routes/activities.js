const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Activity = require('../models/Activity');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

router.post('/', auth(), requireRole('lecturer'), async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().min(2).required(),
    questions: Joi.array().items(Joi.object({
      type: Joi.string().valid('mcq', 'truefalse', 'short').default('mcq'),
      text: Joi.string().required(),
      options: Joi.array().items(Joi.string()).default([]),
      correctIndex: Joi.number().optional(),
      points: Joi.number().default(1)
    })).default([])
  });
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const activity = await Activity.create({
    title: value.title,
    createdBy: req.user._id,
    questions: value.questions,
    isDraft: true
  });

  res.json(activity);
});

router.patch('/:id', auth(), requireRole('lecturer'), async (req, res) => {
  const activity = await Activity.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!activity) return res.status(404).json({ error: 'Not found' });

  if (typeof req.body.isDraft === 'boolean') activity.isDraft = req.body.isDraft;
  if (req.body.title) activity.title = req.body.title;
  await activity.save();

  res.json(activity);
});


module.exports = router;
