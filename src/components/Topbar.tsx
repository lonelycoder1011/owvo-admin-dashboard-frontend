"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import { useDashboardDateRange, type DashboardDateRange } from "@/hooks/useDashboardDateRange";
import { SOCKET_URL } from "@/lib/api";
import { clearDashboardSession } from "@/lib/auth-storage";
import { getDashboardSocketOptions } from "@/lib/socket";
import { canAccessMenu } from "@/lib/dashboard-permissions";
import { getAdminNotifications, logoutDashboard } from "@/lib/admin-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, ChevronDown, Database, FileText, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const rangeOptions: Array<{ value: DashboardDateRange; label: string }> = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "yearly", label: "This Year" },
  { value: "all", label: "All Time" },
];

export function Topbar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const dateRange = useDashboardDateRange();
  const [rangeOpen, setRangeOpen] = useState(false);
  const firstName = (user?.name || user?.email || "Admin").split(" ")[0];
  const canReadNotifications = canAccessMenu(user, "notifications");
  const canReadReports = canAccessMenu(user, "reports");
  const canReadDataRequests = canAccessMenu(user, "data-requests");
  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications-topbar", dateRange.queryKey],
    queryFn: () => getAdminNotifications(dateRange.query),
    enabled: canReadNotifications,
    refetchInterval: 30000,
  });
  const count = notificationsQuery.data?.length || 0;

  useEffect(() => {
    if (!canReadNotifications) return;

    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-notifications-topbar"] });
    };

    socket.on("admin_activity_log_created", refresh);
    socket.on("admin_booking_created", refresh);
    socket.on("admin_booking_status_updated", refresh);
    socket.on("admin_payout_updated", refresh);

    return () => {
      socket.off("admin_activity_log_created", refresh);
      socket.off("admin_booking_created", refresh);
      socket.off("admin_booking_status_updated", refresh);
      socket.off("admin_payout_updated", refresh);
      socket.disconnect();
    };
  }, [canReadNotifications, queryClient, user?._id]);

  async function logout() {
    try {
      await logoutDashboard();
    } catch {
      // The local session should still end even if the audit request fails.
    }
    clearDashboardSession();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header className="topbar">
      <div className="greeting">
        <h1>Good morning, {firstName}!</h1>
        <p>Here&apos;s what&apos;s happening with your business today.</p>
      </div>
      <div className="top-actions">
        {canReadDataRequests ? (
          <Link className="report-topbar-button" href="/data-requests">
            <Database size={16} />
            Data Requests
          </Link>
        ) : null}
        {canReadReports ? (
          <Link className="report-topbar-button" href="/issue-reports">
            <FileText size={16} />
            Reports
          </Link>
        ) : null}
        <div className="date-menu">
          <button
            aria-expanded={rangeOpen}
            className="date-button"
            onClick={() => setRangeOpen((open) => !open)}
            type="button"
          >
            <CalendarDays size={17} />
            <span>{dateRange.label}</span>
            <ChevronDown size={15} />
          </button>
          {rangeOpen ? (
            <div className="date-menu-panel">
              {rangeOptions.map((option) => (
                <button
                  className={dateRange.range === option.value ? "date-menu-item active" : "date-menu-item"}
                  key={option.value}
                  onClick={() => {
                    dateRange.setRange(option.value);
                    setRangeOpen(false);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          className={dateRange.range === "all" ? "all-time-button active" : "all-time-button"}
          onClick={() => dateRange.setRange("all")}
          type="button"
        >
          All Time
        </button>
        <Link className="icon-button" aria-label="Notifications" href="/notifications">
          <Bell size={18} />
          {count ? <span className="notification-badge">{Math.min(count, 9)}</span> : null}
        </Link>
        <button className="logout-button" onClick={logout} type="button">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
}




