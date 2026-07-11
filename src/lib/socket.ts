"use client";

import { getStoredToken } from "@/lib/auth-storage";

export function getDashboardSocketOptions(userId?: string) {
  const token = getStoredToken();
  const auth = {
    ...(userId ? { userId } : {}),
    ...(token ? { token } : {}),
  };

  return {
    query: userId ? { userId } : undefined,
    auth,
    transports: ["websocket"],
  };
}

