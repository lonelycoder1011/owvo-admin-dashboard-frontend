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

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): DashboardUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
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
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  setAccessToken(accessToken);
  window.dispatchEvent(new Event("owvo-dashboard-session"));
}

export function clearDashboardSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  setAccessToken(null);
  window.dispatchEvent(new Event("owvo-dashboard-session"));
}

export function hydrateDashboardSession() {
  const token = getStoredToken();
  setAccessToken(token);
  return {
    token,
    user: getStoredUser(),
  };
}
