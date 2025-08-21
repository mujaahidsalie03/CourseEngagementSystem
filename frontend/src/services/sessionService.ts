import { http } from '../api/http';
import { endpoints } from '../api/endpoints';

export async function startSession(quizId: string) {
  const { data } = await http.post<{ sessionId: string; sessionCode: string }>(
    endpoints.sessions.start,
    { quizId }
  );
  return data;
}

export async function joinSession(code: string) {
  const { data } = await http.post<{ sessionId: string; quiz: any }>(
    endpoints.sessions.join,
    { code }
  );
  return data;
}

export async function submitAnswer(sessionId: string, questionIndex: number, selectedAnswerIndex: number) {
  const { data } = await http.post(endpoints.sessions.answer(sessionId), {
    questionIndex,
    selectedAnswerIndex,
  });
  return data;
}

export async function stopSession(sessionId: string) {
  const { data } = await http.post(endpoints.sessions.stop(sessionId), {});
  return data;
}
