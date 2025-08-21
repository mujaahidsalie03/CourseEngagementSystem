import { http } from '../api/http';
import { endpoints } from '../api/endpoints';
import type { Quiz, QuizQuestion } from '../domain/types';

export async function listQuizzesByCourse(courseId: string): Promise<Quiz[]> {
  const { data } = await http.get<Quiz[]>(endpoints.quizzes.byCourse(courseId));
  return data;
}

export async function createQuiz(courseId: string, title: string, questions: QuizQuestion[]) {
  const { data } = await http.post<Quiz>(endpoints.quizzes.create, { courseId, title, questions });
  return data;
}
