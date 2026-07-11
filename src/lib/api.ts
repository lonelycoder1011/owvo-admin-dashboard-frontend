import axios from "axios";

const TOKEN_KEY = "owvo_dashboard_access_token";
const REFRESH_TOKEN_KEY = "owvo_dashboard_refresh_token";
const USER_KEY = "owvo_dashboard_user";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:5006/api/v1"
    : "https://owvo-backend.onrender.com/api/v1");

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

export function setAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.sessionStorage.removeItem(USER_KEY);
      setAccessToken(null);

      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

