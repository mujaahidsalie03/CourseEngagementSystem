const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  answerText: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
}, { _id: false });

// question types and their individual logic.
const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: {
    type : String,
    enum : ['mcq','word_cloud','pose_and_discuss'],
    required: true,
    default : 'mcq' 
  },
  points: { type: Number, default: 1 }, // defaults to 1 point allocated. 
  // mcq logic
  
  answers: { type: [answerSchema], validate : { 
    validator: function(v) { 
      if (this.questionType == 'mcq') { 
        return Array.isArray(v) && v.length >= 2;
          } 
      return true
        }, 
        message: 'MCQ questions must have at least 2 answers'
      }
}, 
  // pose and discuss logic for model answers
  modelAnswer : {
    type : String ,
    validate : {
      validator : function(v){
        return this.questionType != 'pose_and_discuss' || (v && v.trim().length > 0);
      },
    message : 'Pose and discuss type questions must have a model answer'
    }
  },

  // time limit for each question (in seconds)
  timeLimit: { type: Number, default: 30 },
  
  // for word cloud - max submissions per student
  maxSubmissions: { type: Number, default: 1 },
  
  // for word cloud - anonymous submissions
  allowAnonymous: { type: Boolean, default: false }
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  questions: { type: [questionSchema], default: [] },
  isDraft: { type: Boolean, default: false },

  // quiz level settings, to ease management.
  settings: {
    showResultsAfterEach : {type : Boolean, default : true},
    allowLateJoin : {type: Boolean, default: true},
    shuffleQuestions : {type: Boolean, default: false}
  },

  // createdBy removed from required checks (can be null)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
  
}, { timestamps: true });

// Adding some validation, which ensures MCQ questions have at least one correct answer.

quizSchema.pre('save', function(next) {
  for (let question of this.questions) {
    if (question.questionType == 'mcq') {
      const hasCorrectAnswer = question.answers && question.answers.some(answer => answer.isCorrect);
      if (!hasCorrectAnswer) {
        return next(new Error(`MCQ question "${question.questionText}" must have at least one correct answer`));
      }
    }
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
