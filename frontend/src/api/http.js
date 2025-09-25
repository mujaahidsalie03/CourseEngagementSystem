// src/api/http.js
// One place to define the API base.
// You can set either:
//   VITE_API_URL = "http://localhost:5000/api"  (full URL incl. /api)  ← easiest
//   VITE_API_URL = "/api"                        (relative)
//   VITE_API_BASE = "http://localhost:5000"      (host only; we’ll still work)
// Default falls back to "/api".

const RAW =
  (import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE ||
    "/api").trim();

function normalizeBase(u) {
  if (!u) return "/api";
  // If they passed relative, make sure it starts with "/"
  if (!/^https?:\/\//i.test(u)) {
    if (!u.startsWith("/")) u = "/" + u;
  }
  // strip trailing slashes
  return u.replace(/\/+$/, "");
}

const BASE = normalizeBase(RAW);

// Join BASE + path (path can be "students/..." or "/students/...")
function join(path) {
  if (!path.startsWith("/")) path = "/" + path;
  return BASE + path;
}

// Robust user reader (supports all keys we've used so far)
function getSessionUser() {
  const tryRead = (k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // preferred
  let u = tryRead("ces_user");
  if (!u) {
    // sometimes we stored an "auth" object (with or without .user)
    const a = tryRead("auth");
    if (a?.user) u = a.user;
    else if (a) u = a;
  }
  if (!u) u = tryRead("auth:user");
  if (!u) u = tryRead("user");

  if (!u) return null;

  // normalize id/role shape
  return {
    ...u,
    id: u.id || u._id || u.userId || "",
    role: u.role || "student",
  };
}

// Minimal fetch helper that sends dev auth headers
export async function http(
  path,
  { method = "GET", body, headers = {}, form = false } = {}
) {
  const user = getSessionUser();

  const init = {
    method,
    headers: { ...headers },
    credentials: "include",
  };

  if (form) {
    // FormData → let the browser set Content-Type
    init.body = body;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  // Dev-mode auth: pass user via headers so middleware/auth can set req.user
  if (user?.id) {
    // Don't overwrite explicit headers if caller already set them.
    if (!init.headers["x-user-id"]) init.headers["x-user-id"] = user.id;
    if (!init.headers["x-user-role"] && user.role)
      init.headers["x-user-role"] = user.role;
  }

  const res = await fetch(join(path), init);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch {
      try {
        msg = await res.text();
      } catch {}
    }
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// Optional: export the resolved API base (handy for debugging)
export const apiBase = BASE;

export function setSessionUser(user) {
  if (user) {
    localStorage.setItem("ces_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("ces_user");
  }
}