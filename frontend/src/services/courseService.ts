import { http } from '../api/http';
import { endpoints } from '../api/endpoints';
import type { Course } from '../domain/types';

export async function listMyCourses(): Promise<Course[]> {
  const { data } = await http.get<Course[]>(endpoints.courses.mine);
  return data;
}
