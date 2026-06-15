"use client";

import { getAdminMe } from "@/lib/admin-api";
import {
  clearDashboardSession,
  hydrateDashboardSession,
  storeDashboardSession,
} from "@/lib/auth-storage";
import {
  canAccessPath,
  getDefaultDashboardHref,
} from "@/lib/dashboard-permissions";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (pathname === "/login") {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    const session = hydrateDashboardSession();
    if (!session.token) {
      router.replace("/login");
      return () => {
        cancelled = true;
      };
    }
    const token = session.token;

    setReady(false);

    getAdminMe()
      .then((user) => {
        if (cancelled) return;
        storeDashboardSession({
          accessToken: token,
          user,
        });

        if (!canAccessPath(user, pathname)) {
          router.replace(getDefaultDashboardHref(user));
          return;
        }

        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearDashboardSession();
        router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return null;
  }

  return children;
}
