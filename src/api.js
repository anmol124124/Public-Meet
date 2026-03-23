// Backend URL injected at runtime via entrypoint.sh → /config.js → window.BACKEND_URL
const BASE = window.BACKEND_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const authHeader = () => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Public meeting ─────────────────────────────────────────────────────────

export const createMeeting = (name) =>
  request("POST", "/api/v1/public/meetings", { name });

export const listMeetings = () =>
  request("GET", "/api/v1/public/meetings");

export const getMeeting = (roomCode) =>
  request("GET", `/api/v1/public/meetings/${roomCode}`);

export const getGuestToken = (roomCode, name) =>
  request("POST", `/api/v1/public/meetings/${roomCode}/guest-token`, { name });

export const getHostToken = (roomCode) =>
  request("POST", `/api/v1/public/meetings/${roomCode}/host-token`);

// ── Auth ───────────────────────────────────────────────────────────────────

export const login = async (email, password) => {
  const data = await request("POST", "/api/v1/auth/login", { email, password });
  localStorage.setItem("access_token", data.access_token);
  return data;
};

export const signup = async (name, email, password) => {
  // signup returns user object (no token), so login after
  await request("POST", "/api/v1/auth/signup", { name, email, password });
  return login(email, password);
};

export const logout = () => localStorage.removeItem("access_token");

export const isLoggedIn = () => !!localStorage.getItem("access_token");

export const backendWsUrl = () =>
  BASE.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
