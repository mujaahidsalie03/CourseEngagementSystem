// controllers/quizController.js
const Quiz = require('../models/quizModel');
const Course = require('../models/courseModel');

// we will use a helper function that validates the question based on its type
const validateQuestion = (question) => {
  const errors = [] ;

  if (!question.questionText || !question.questionText.trim()){
    errors.push('Question text is required') ; // perhaps more detailed required here?
  }


  switch (question.questionType){
    case 'mcq':
      if (!question.answers || question.answers.length < 2){
        errors.push('MCQ questions must have at LEAST 2 answers.') ;
      }
      else {
        const hasCorrect = question.answers.some(a => a.isCorrect);
        if (!hasCorrect){
          errors.push('MCQ questions must have at LEAST one correct answer.')
        }
      }
      break ;

    case 'pose_and_discuss':
      if (!question.modelAnswer || !question.modelAnswer.trim()) {
        errors.push('Pose and discuss questions must have a model answer') ; 
      } 
      break ;

    case 'word_cloud':
      // there is no 'correct' answer here, we only need the prompt.
      break ; 

    case 'fill_in_the_blank':
      // somendra logic here
      break ; 

    case 'poll':
       // somendra logic here
      break ; 

    default:
      errors.push('Invalid question type.');
  }



  return errors;
};

const normaliseQuestion = (q) => {
  const normalised = {
      questionText : (q.questionText || '').trim(),
      questionType : q.questionType || 'mcq',
      points : typeof q.points == 'number' ? q.points : 1,
      timeLimit : typeof q.timeLimit == 'number' ? q.timeLimit : 30
  };
  
  // mcq normalisation
  if (normalised.questionType === 'mcq') {
    normalised.answers = (q.answers || []).map(a => ({
      answerText: (a.answerText || '').trim(),
      isCorrect: !!a.isCorrect
    }));
  }

  // p_and_d normalisation 
  if (normalised.questionType === 'pose_and_discuss') {
    normalised.modelAnswer = (q.modelAnswer || '').trim();
  }

  // wc normalisation
  if (normalised.questionType === 'word_cloud') {
    normalised.maxSubmissions = typeof q.maxSubmissions === 'number' ? q.maxSubmissions : 1;
    normalised.allowAnonymous = !!q.allowAnonymous;
  }

  return normalised;

};

exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions = [], settings = {} }= req.body;

    if (!courseId || !title){
      return res.status(400).json({message : 'courseId and title are required.'});
    }

    const course = await Course.findById(courseId).lean();
    if (!course){
      return res.status(404).json({ message: 'Course not found'});
    }

    const normalisedQuestions = [] ;
    const allErrors = [] ;

    for (let i = 0 ;i < questions.length ; i++){
      const q = questions[i] ;
      const errors = validateQuestion(q) ;
      if (errors.length > 0){
        allErrors.push(`Question ${i + 1}: ${errors.join(', ')}`);
      }
      else{
        normalisedQuestions.push(normaliseQuestion(q));
      }
    }
  
    if (allErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: allErrors 
      });
    }

    const quiz = await Quiz.create({
      title: title.trim(),
      courseId,
      questions: normalisedQuestions,
      settings: {
        showResultsAfterEach: settings.showResultsAfterEach !== undefined ? settings.showResultsAfterEach : true,
        allowLateJoin: settings.allowLateJoin !== undefined ? settings.allowLateJoin : true,
        shuffleQuestions: !!settings.shuffleQuestions
      },
      isDraft: false,
      createdBy: req.user._id, // get from request body instead of req.user
    });

    res.status(201).json(quiz);  
    
  } catch (e) {
    console.error(e) ;
    res.status(500).json({ message : 'Server error', error: e.message});
  }
};

exports.byCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const quizzes = await Quiz.find({ courseId })
    .select('title createdAt isDraft questions settings')
    .lean();

    const quizzesWithCount = quizzes.map(quiz => ({
      ...quiz, 
      questionCount : quiz.questions ? quiz.questions.length : 0
    }));

    res.json(quizzesWithCount);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.byId = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('courseId', 'name').lean();
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, questions = [], settings = {} } = req.body;

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (questions.length > 0) {
      const normalisedQuestions = [];
      const allErrors = [];
      
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const errors = validateQuestion(q);
        if (errors.length > 0) {
          allErrors.push(`Question ${i + 1}: ${errors.join(', ')}`);
        } else {
          normalisedQuestions.push(normaliseQuestion(q));
        }
      }
      
      if (allErrors.length > 0) {
        return res.status(400).json({ 
          message: 'Validation errors', 
          errors: allErrors 
        });
      }
      
      quiz.questions = normalisedQuestions;
    }

    // Update other fields
    if (title) quiz.title = title.trim();
    if (Object.keys(settings).length > 0) {
      quiz.settings = {
        ...quiz.settings,
        ...settings
      };
    }

    await quiz.save();
    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error', error: e.message });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    
    const quiz = await Quiz.findByIdAndDelete(id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    res.json({ message: 'Quiz deleted successfully', id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getQuizForSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // 'lecturer' or 'student'
    
    const quiz = await Quiz.findById(id).lean();
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // If student, remove correct answers and model answers
    if (role === 'student') {
      const studentQuiz = {
        ...quiz,
        questions: quiz.questions.map(q => {
          const studentQ = { ...q };
          
          // Remove correct answer indicators for MCQ
          if (q.questionType === 'mcq' && q.answers) {
            studentQ.answers = q.answers.map(a => ({
              answerText: a.answerText,
              // Don't send isCorrect to students
            }));
          }
          
          // Remove model answer for pose_and_discuss
          if (q.questionType === 'pose_and_discuss') {
            delete studentQ.modelAnswer;
          }
          
          return studentQ;
        })
      };
      return res.json(studentQuiz);
    }

    res.json(quiz);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};
