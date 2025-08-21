import axios from 'axios';
import { getToken } from '../auth/token';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE, // e.g. http://localhost:5000/api
});

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
