"use client";

import { getStoredUser, type DashboardUser } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

export function useDashboardUser() {
  const [user, setUser] = useState<DashboardUser | null>(null);

  useEffect(() => {
    const refresh = () => setUser(getStoredUser());
    refresh();
    window.addEventListener("owvo-dashboard-session", refresh);
    return () => window.removeEventListener("owvo-dashboard-session", refresh);
  }, []);

  return user;
}
