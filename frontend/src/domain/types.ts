export type Role = 'lecturer' | 'student';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface Course {
  _id: string;
  courseName: string;
  courseCode?: string;
  lecturerId?: string;
  students?: string[];
}

export interface QuizAnswer { answerText: string; isCorrect: boolean; }
export interface QuizQuestion { questionText: string; answers: QuizAnswer[]; points?: number; }
export interface Quiz { _id: string; title: string; courseId: string; questions: QuizQuestion[]; }

export type SessionStatus = 'not_started' | 'active' | 'finished';
export interface QuizSession {
  _id: string;
  quizId: string;
  sessionCode: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  participants?: string[];
}

export interface LiveBin { option: number; count: number; } // option is answer index
export interface LeaderboardRow { name: string; total: number; }
