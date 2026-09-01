import axios from "axios";

const TOKEN_KEY = "owvo_dashboard_access_token";
const REFRESH_TOKEN_KEY = "owvo_dashboard_refresh_token";
const USER_KEY = "owvo_dashboard_user";

const RETIRED_RENDER_ORIGIN = "https://owvo-backend.onrender.com";
const CURRENT_RENDER_ORIGIN = "https://owvo-backend-new.onrender.com";

const normalizeBackendUrl = (value: string) => {
  const normalizedValue = value.trim();
  if (
    normalizedValue === RETIRED_RENDER_ORIGIN ||
    normalizedValue.startsWith(`${RETIRED_RENDER_ORIGIN}/`)
  ) {
    return `${CURRENT_RENDER_ORIGIN}${normalizedValue.slice(RETIRED_RENDER_ORIGIN.length)}`;
  }
  return normalizedValue;
};

const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const configuredSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
const defaultApiBaseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5006/api/v1"
    : `${CURRENT_RENDER_ORIGIN}/api/v1`;

export const API_BASE_URL = normalizeBackendUrl(
  configuredApiBaseUrl || defaultApiBaseUrl
);

export const SOCKET_URL = normalizeBackendUrl(
  configuredSocketUrl || API_BASE_URL.replace(/\/api\/v1\/?$/, "")
);

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Render can take longer than 15 seconds to wake after an idle period.
  timeout: 60000,
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

