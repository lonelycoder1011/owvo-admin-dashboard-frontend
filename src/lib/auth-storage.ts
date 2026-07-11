"use client";

import { setAccessToken } from "@/lib/api";

const TOKEN_KEY = "owvo_dashboard_access_token";
const REFRESH_TOKEN_KEY = "owvo_dashboard_refresh_token";
const USER_KEY = "owvo_dashboard_user";

export type DashboardUser = {
  _id: string;
  name?: string;
  email?: string;
  role: "admin" | "staff";
  accountStatus?: "active" | "disabled";
  staffPermissions?: {
    menus?: string[];
    actions?: string[];
  };
};

function browserSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function clearLegacyLocalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredToken() {
  return browserSessionStorage()?.getItem(TOKEN_KEY) || null;
}

export function getStoredUser(): DashboardUser | null {
  const raw = browserSessionStorage()?.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as DashboardUser;
  } catch {
    return null;
  }
}

export function storeDashboardSession({
  accessToken,
  refreshToken,
  user,
}: {
  accessToken: string;
  refreshToken?: string;
  user: DashboardUser;
}) {
  const storage = browserSessionStorage();
  if (!storage) return;

  clearLegacyLocalSession();
  storage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  storage.setItem(USER_KEY, JSON.stringify(user));
  setAccessToken(accessToken);
  window.dispatchEvent(new Event("owvo-dashboard-session"));
}

export function clearDashboardSession() {
  const storage = browserSessionStorage();
  clearLegacyLocalSession();
  storage?.removeItem(TOKEN_KEY);
  storage?.removeItem(REFRESH_TOKEN_KEY);
  storage?.removeItem(USER_KEY);
  setAccessToken(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("owvo-dashboard-session"));
  }
}

export function hydrateDashboardSession() {
  clearLegacyLocalSession();
  const token = getStoredToken();
  setAccessToken(token);
  return {
    token,
    user: getStoredUser(),
  };
}
