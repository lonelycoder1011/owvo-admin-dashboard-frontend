"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type DashboardDateRange = "daily" | "weekly" | "monthly" | "yearly" | "all";

type DashboardDateRangeContextValue = {
  range: DashboardDateRange;
  setRange: (range: DashboardDateRange) => void;
  label: string;
  query: Record<string, string>;
  queryKey: string;
};

const STORAGE_KEY = "owvo_dashboard_date_range";
const DateRangeContext = createContext<DashboardDateRangeContextValue | null>(null);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - diff);
  return value;
}

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  return endOfDay(value);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return endOfDay(new Date(date.getFullYear(), 11, 31));
}

function formatDate(date: Date, withYear = false) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  }).format(date);
}

function getBounds(range: DashboardDateRange) {
  const now = new Date();

  if (range === "daily") return { from: startOfDay(now), to: endOfDay(now) };
  if (range === "weekly") return { from: startOfWeek(now), to: endOfWeek(now) };
  if (range === "monthly") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (range === "yearly") return { from: startOfYear(now), to: endOfYear(now) };

  return { from: null, to: null };
}

function getLabel(range: DashboardDateRange) {
  const bounds = getBounds(range);
  if (!bounds.from || !bounds.to) return "All Time";
  if (range === "daily") return formatDate(bounds.from, true);
  if (range === "monthly") {
    return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(bounds.from);
  }
  if (range === "yearly") return bounds.from.getFullYear().toString();
  return `${formatDate(bounds.from)} - ${formatDate(bounds.to, true)}`;
}

function getStoredRange(): DashboardDateRange | null {
  if (typeof window === "undefined") return "weekly";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return ["daily", "weekly", "monthly", "yearly", "all"].includes(stored || "")
    ? (stored as DashboardDateRange)
    : null;
}

export function DashboardDateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRangeState] = useState<DashboardDateRange>("weekly");

  useEffect(() => {
    const stored = getStoredRange();
    if (stored) setRangeState(stored);
  }, []);

  const value = useMemo<DashboardDateRangeContextValue>(() => {
    const bounds = getBounds(range);
    const query: Record<string, string> = { range };
    if (bounds.from) query.from = bounds.from.toISOString();
    if (bounds.to) query.to = bounds.to.toISOString();

    return {
      range,
      setRange: (nextRange) => {
        setRangeState(nextRange);
        window.localStorage.setItem(STORAGE_KEY, nextRange);
      },
      label: getLabel(range),
      query,
      queryKey: `${range}:${query.from || "start"}:${query.to || "end"}`,
    };
  }, [range]);

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDashboardDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error("useDashboardDateRange must be used inside DashboardDateRangeProvider");
  }
  return context;
}
