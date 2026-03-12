"use client";

const STORAGE_KEY = "GTS_SESSION_ROLE";

export function getSessionRole() {
  if (typeof window === "undefined") return { role: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { role: null };
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.role === "admin" || parsed.role === "user")) {
      return parsed;
    }
    return { role: null };
  } catch {
    return { role: null };
  }
}

export function setSessionRole(role, userId) {
  if (typeof window === "undefined") return;
  const value =
    role === "user"
      ? { role: "user", userId: String(userId || "").trim() }
      : { role: "admin" };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearSessionRole() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

