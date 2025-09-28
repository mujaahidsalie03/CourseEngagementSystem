// src/api/studentApi.js
import { http } from "./http";

// Read the current user from any of the auth keys we've used.
function currentUser() {
  const tryRead = (k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // common shapes we've used in the app
  let u = tryRead("ces_user");
  if (!u) {
    const a = tryRead("auth");
    if (a?.user) u = a.user;
    else if (a) u = a;
  }
  if (!u) u = tryRead("auth:user");
  if (!u) u = tryRead("user");

  return u || {};
}


// GET the courses the logged-in student is enrolled in.
// Backend route: /api/students/me/courses
// pass x-user-id/x-user-role explicitly so this works
// even if http() doesn't find a user in localStorage.
 
export async function getMyCourses() {
  const me = currentUser();
  const uid = me.id || me._id || me.userId || "";
  const role = me.role || "student";

  return http("/students/me/courses", {
    headers: {
      "x-user-id": uid,
      "x-user-role": role,
    },
  });
}
