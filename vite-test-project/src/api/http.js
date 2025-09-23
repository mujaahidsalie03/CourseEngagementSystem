// The base URL of your running backend server
const BASE_URL = 'http://localhost:5000/api';

// TODO: Replace this with a real student ID from your MongoDB database.
// You can find one by looking in the 'users' collection.
const MOCK_USER_ID = '68a5962a55e44d61986c5dce';

// This helper function will handle all our API requests
const apiFetch = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  

  // The backend's auth middleware expects userId and role in the body
  const authPayload = { userId: MOCK_USER_ID, role: 'student' };
  let url = `${BASE_URL}${endpoint}`;

  if (method === 'GET') {
    // For GET requests, add user info as URL query parameters.
    const params = new URLSearchParams(authPayload);
    // Ensure the endpoint doesn't already have query params.
    url.includes('?') ? url += `&${params.toString()}` : url += `?${params.toString()}`;
  } else {
    // For POST, PUT, etc., add user info to the request body.
    options.body = JSON.stringify({ ...body, ...authPayload });
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An API error occurred');
  }

  return data;
};

export const http = {
  get: (endpoint) => apiFetch(endpoint, 'GET'),
  post: (endpoint, body) => apiFetch(endpoint, 'POST', body),
  put: (endpoint, body) => apiFetch(endpoint, 'PUT', body),
  delete: (endpoint) => apiFetch(endpoint, 'DELETE'),
};