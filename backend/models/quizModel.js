const mongoose = require('mongoose');

// all items to schema's to be used within a quiz ; all static contents of a quiz
const QuestionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['mcq', 'truefalse', 'short'], 
    default: 'mcq' 
  },
  text: { 
    type: String, 
    required: true 
  },
  options: [String],

  correctIndex: { 
    type: Number 
  },
  points: { 
    type: Number, 
    default: 1 // test here, init value incorect
  }
});

// we should also create a 'QuizTypeSchema' here to be used in the acitivty, 
// which will allow the person to select the type of question.
const QuizTypeSchema = new mongoose.Schema({

})

const ActivitySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', required: true 
  },
  questions: [QuestionSchema],

  isDraft: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Activity', ActivitySchema);  // <-- MUST be a model
