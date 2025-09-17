// repositories/quizRepository.js
const Quiz = require('../models/quizModel');
const mongoose = require('mongoose');

class QuizRepository {
  
  // Create a new quiz
  async create(quizData) {
    try {
      const quiz = new Quiz(quizData);
      return await quiz.save();
    } catch (error) {
      throw new Error(`Failed to create quiz: ${error.message}`);

    }
  }

  // Find quiz by ID
  async findById(quizId, populateOptions = null) {
    try {
      const query = Quiz.findById(quizId);
      if (populateOptions) {
        query.populate(populateOptions);
      }
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find quiz: ${error.message}`);
    }
  }

  // Find all quizzes for a course
  async findByCourseId(courseId, options = {}) {
    try {
      const { 
        includeQuestions = false, 
        onlyPublished = false, // show drafts too.
        sortBy = 'createdAt',
        sortOrder = -1 
      } = options;

      const query = Quiz.find({ courseId });
      
      if (onlyPublished) {
        query.where({ isDraft: false });
      }

      if (!includeQuestions) {
        query.select('-questions');
      }

      query.sort({ [sortBy]: sortOrder });
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find quizzes for course: ${error.message}`);
    }
  }

  // Update quiz
  async update(quizId, updateData) {
    try {
      const quiz = await Quiz.findByIdAndUpdate(
        quizId, 
        updateData, 
        { new: true, runValidators: true }
      );
      return quiz;
    } catch (error) {
      throw new Error(`Failed to update quiz: ${error.message}`);
    }
  }

  // Delete quiz
  async delete(quizId) {
    try {
      return await Quiz.findByIdAndDelete(quizId);
    } catch (error) {
      throw new Error(`Failed to delete quiz: ${error.message}`);
    }
  }

  // Get quiz statistics
  async getQuizStats(quizId) {
    try {
      const pipeline = [
        { $match: { _id: new mongoose.Types.ObjectId(quizId) } },
        {
          $project: {
            title: 1,
            questionCount: { $size: '$questions' },
            totalPoints: {
              $sum: '$questions.points'
            },
            questionTypes: {
              $reduce: {
                input: '$questions.questionType',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    { [`$$this`]: { $add: [{ $ifNull: [`$$value.$$this`, 0] }, 1] } }
                  ]
                }
              }
            },
            avgTimeLimit: { $avg: '$questions.timeLimit' },
            createdAt: 1,
            isDraft: 1
          }
        }
      ];

      const result = await Quiz.aggregate(pipeline);
      return result[0] || null;
    } catch (error) {
      throw new Error(`Failed to get quiz statistics: ${error.message}`);
    }
  }

  // Search quizzes
  async search(searchTerm, courseId = null, options = {}) {
    try {
      const { limit = 10, skip = 0 } = options;
      
      const searchConditions = {
        $text: { $search: searchTerm }
      };

      if (courseId) {
        searchConditions.courseId = courseId;
      }

      return await Quiz.find(searchConditions)
        .select('title courseId createdAt isDraft')
        .limit(limit)
        .skip(skip)
        .sort({ score: { $meta: 'textScore' } })
        .exec();
    } catch (error) {
      throw new Error(`Failed to search for quizzes: ${error.message}`);
    }
  }

  // Get quiz for live session (student view)
  async getQuizForSession(quizId, userRole = 'student') {
    try {
      const quiz = await Quiz.findById(quizId).lean();
      if (!quiz) return null;

      // If lecturer, return full quiz
      if (userRole == 'lecturer') {
        return quiz;
      }

      // For students, remove sensitive information
      return {
        ...quiz,
        questions: quiz.questions.map((question, index) => {
          const studentQuestion = {
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            timeLimit: question.timeLimit,
            index
          };

          // Handle different question types
          switch (question.questionType) {
            case 'mcq':
              // Remove isCorrect flags
              studentQuestion.answers = question.answers.map(answer => ({
                answerText: answer.answerText
              }));
              break;
              
            case 'word_cloud':
              studentQuestion.maxSubmissions = question.maxSubmissions;
              studentQuestion.allowAnonymous = question.allowAnonymous;
              break;
              
            case 'pose_and_discuss':
              // Don't send model answer to students
              break;
          }

          return studentQuestion;
        })
      };
    } catch (error) {
      throw new Error(`Failed to get quiz for session: ${error.message}`);
    }
  }

  // Get questions by type
  async getQuestionsByType(courseId, questionType) {
    try {
      const pipeline = [
        { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
        { $unwind: '$questions' },
        { $match: { 'questions.questionType': questionType } },
        {
          $project: {
            _id: 0,
            quizTitle: '$title',
            quizId: '$_id',
            question: '$questions'
          }
        }
      ];

      return await Quiz.aggregate(pipeline);
    } catch (error) {
      throw new Error(`Failed to get questions by type: ${error.message}`);
    }
  }

  // Duplicate quiz
  async duplicate(quizId, newTitle = null) {
    try {
      const originalQuiz = await Quiz.findById(quizId).lean();
      if (!originalQuiz) {
        throw new Error('Quiz not found');
      }

      const duplicatedQuiz = {
        ...originalQuiz,
        _id: undefined, // Remove the original ID
        title: newTitle || `${originalQuiz.title} (Copy)`,
        isDraft: true, // New quiz starts as draft
        createdAt: undefined,
        updatedAt: undefined
      };

      return await this.create(duplicatedQuiz);
    } catch (error) {
      throw new Error(`Failed to duplicate quiz: ${error.message}`);
    }
  }

  // Bulk operations
  async bulkDelete(quizIds) {
    try {
      const result = await Quiz.deleteMany({
        _id: { $in: quizIds.map(id => new mongoose.Types.ObjectId(id)) }
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to bulk delete quizzes: ${error.message}`);
    }
  }

  // Check if user has permission to modify quiz
  async checkPermission(quizId, userId) {
    try {
      const quiz = await Quiz.findById(quizId).populate('courseId');
      if (!quiz) return false;

      // Check if user is the creator or the course lecturer
      return quiz.createdBy?.toString() === userId.toString() || 
             quiz.courseId?.lecturerId?.toString() === userId.toString();
    } catch (error) {
      throw new Error(`Failed to check permission: ${error.message}`);
    }
  }
}

module.exports = new QuizRepository();