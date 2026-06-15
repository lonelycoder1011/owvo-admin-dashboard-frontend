"use client";

import {
  CashoutOverviewPanel,
  PendingPayoutsPanel,
  RecentBookingsPanel,
  UpcomingBookingsPanel,
  type BookingListItem,
  type UpcomingBookingListItem,
} from "@/components/DashboardLists";
import { MetricCard } from "@/components/MetricCard";
import { RevenueChart } from "@/components/RevenueChart";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { SOCKET_URL } from "@/lib/api";
import {
  AdminBooking,
  getDashboardOverview,
  getDashboardRevenue,
  getAdminPayouts,
  getDashboardSettings,
  getRecentBookings,
  getUpcomingBookings,
  getWashers,
} from "@/lib/admin-api";
import { hydrateDashboardSession } from "@/lib/auth-storage";
import { metrics as fallbackMetrics } from "@/lib/dashboard-data";
import { compactMoney, money } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: "Requested", className: "ongoing" },
  accepted: { label: "Accepted", className: "ongoing" },
  arrived: { label: "Arrived", className: "progress" },
  ongoing: { label: "In Progress", className: "progress" },
  completed: { label: "Completed", className: "completed" },
  cancelled: { label: "Cancelled", className: "progress" },
};

function mapRecentBooking(booking: AdminBooking): BookingListItem {
  const status = statusLabels[booking.status] ?? {
    label: booking.status,
    className: "ongoing",
  };
  const createdAt = booking.createdAt ? new Date(booking.createdAt) : new Date();

  return {
    id: booking._id,
    name: booking.user?.name || "Customer",
    service: booking.service?.title || booking.service?.serviceType || "Wash Service",
    status: status.label,
    statusClass: status.className,
    time: formatDistanceToNow(createdAt, { addSuffix: true }).replace("about ", ""),
    amount: money(booking.finalPrice),
    avatar: (booking.user?.name || "C").slice(0, 1).toUpperCase(),
  };
}

function mapUpcomingBooking(booking: AdminBooking): UpcomingBookingListItem {
  const bookingDate = booking.bookingDate ? new Date(booking.bookingDate) : new Date();

  return {
    id: booking._id,
    time: format(bookingDate, "hh:mm a"),
    name: booking.user?.name || "Customer",
    service: booking.service?.title || booking.service?.serviceType || "Wash Service",
    amount: money(booking.finalPrice),
    avatar: (booking.user?.name || "C").slice(0, 1).toUpperCase(),
  };
}

export function DashboardPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [hasToken, setHasToken] = useState(false);
  const [socketUserId, setSocketUserId] = useState<string | null>(null);

  useEffect(() => {
    const session = hydrateDashboardSession();
    setHasToken(Boolean(session.token));
    setSocketUserId(session.user?._id || null);
  }, []);

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", dateRange.queryKey],
    queryFn: () => getDashboardOverview(dateRange.query),
    enabled: hasToken,
  });

  const revenueQuery = useQuery({
    queryKey: ["dashboard-revenue", dateRange.queryKey],
    queryFn: () => getDashboardRevenue(dateRange.range, dateRange.query),
    enabled: hasToken,
  });

  const recentQuery = useQuery({
    queryKey: ["dashboard-recent-bookings", dateRange.queryKey],
    queryFn: () => getRecentBookings(4, dateRange.query),
    enabled: hasToken,
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts", dateRange.queryKey],
    queryFn: () => getAdminPayouts(dateRange.query),
    enabled: hasToken,
  });

  const washersQuery = useQuery({
    queryKey: ["washers", dateRange.queryKey],
    queryFn: () => getWashers(dateRange.query),
    enabled: hasToken,
  });

  const settingsQuery = useQuery({
    queryKey: ["dashboard-settings"],
    queryFn: getDashboardSettings,
    enabled: hasToken,
  });

  const upcomingQuery = useQuery({
    queryKey: ["dashboard-upcoming-bookings", dateRange.queryKey],
    queryFn: () => getUpcomingBookings(3, dateRange.query),
    enabled: hasToken,
  });

  useEffect(() => {
    if (!hasToken) return;

    const socket = io(SOCKET_URL, {
      query: socketUserId ? { userId: socketUserId } : undefined,
      transports: ["websocket"],
    });

    const invalidateDashboard = () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
    };

    socket.on("admin_booking_created", invalidateDashboard);
    socket.on("admin_booking_status_updated", invalidateDashboard);
    socket.on("admin_payment_received", invalidateDashboard);
    socket.on("admin_payout_updated", invalidateDashboard);

    return () => {
      socket.off("admin_booking_created", invalidateDashboard);
      socket.off("admin_booking_status_updated", invalidateDashboard);
      socket.off("admin_payment_received", invalidateDashboard);
      socket.off("admin_payout_updated", invalidateDashboard);
      socket.disconnect();
    };
  }, [hasToken, queryClient, socketUserId]);

  const metricItems = useMemo(() => {
    const overview = overviewQuery.data;
    const revenue = overview ?? {
      totalRevenue: 0,
      weekRevenue: 0,
      monthRevenue: 0,
      totalBookings: 0,
      weekBookings: 0,
      activeWashers: 0,
      pendingPayouts: { amount: 0, count: 0 },
      platformBalance: 0,
    };

    return [
      {
        ...fallbackMetrics[0],
        value: compactMoney(revenue.totalRevenue),
        sub: dateRange.label,
        change: "",
      },
      {
        ...fallbackMetrics[1],
        value: revenue.totalBookings.toString(),
        sub: dateRange.label,
        change: "",
      },
      {
        ...fallbackMetrics[2],
        value: revenue.activeWashers.toString(),
        sub: "Online",
        change: "",
      },
      {
        ...fallbackMetrics[3],
        value: compactMoney(revenue.pendingPayouts.amount),
        sub: `${revenue.pendingPayouts.count} Pending`,
        change: "",
      },
      {
        ...fallbackMetrics[4],
        value: compactMoney(revenue.platformBalance),
        sub: "Available",
        change: "",
      },
    ];
  }, [dateRange.label, overviewQuery.data]);

  const recentBookings = recentQuery.data?.map(mapRecentBooking) || [];
  const upcomingBookings = upcomingQuery.data?.map(mapUpcomingBooking) || [];
  const pendingPayouts =
    payoutsQuery.data?.providerBalances
      .filter((balance) => balance.netAmount > 0)
      .slice(0, 3)
      .map((balance) => ({
        id: balance.provider?._id,
        name: balance.provider?.name || balance.provider?.email || "Washer",
        jobs: `${balance.jobs} ${balance.jobs === 1 ? "Job" : "Jobs"}`,
        amount: balance.netAmount,
        avatar: (balance.provider?.name || balance.provider?.email || "W").slice(0, 1).toUpperCase(),
      })) || [];
  const totalPending =
    payoutsQuery.data?.providerBalances.reduce((sum, balance) => sum + balance.netAmount, 0) || 0;
  const cashoutOverview = {
    totalProviders: washersQuery.data?.length || 0,
    totalPaidOut: payoutsQuery.data?.statusTotals.paid || 0,
    autoCashOutEnabled: settingsQuery.data?.autoPayoutEnabled || false,
    thisWeek: (overviewQuery.data?.weekRevenue || 0) * 0.75,
    thisMonth: (overviewQuery.data?.monthRevenue || 0) * 0.75,
    totalBalance: totalPending,
  };

  return (
    <>
      <section className="metric-grid" aria-label="Dashboard metrics">
        {metricItems.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="dashboard-grid">
        <RevenueChart
          data={revenueQuery.data || []}
          isLoading={revenueQuery.isLoading}
          onRangeChange={dateRange.setRange}
          range={dateRange.range}
        />
        <RecentBookingsPanel bookings={recentBookings} />
      </section>
      <section className="bottom-grid">
        <UpcomingBookingsPanel bookings={upcomingBookings} />
        <PendingPayoutsPanel payouts={pendingPayouts} totalPending={totalPending} />
        <CashoutOverviewPanel overview={cashoutOverview} />
      </section>
    </>
  );
}
