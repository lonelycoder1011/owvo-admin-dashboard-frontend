import type { DashboardUser } from "@/lib/auth-storage";

export type DashboardMenuKey =
  | "dashboard"
  | "bookings"
  | "washers"
  | "customers"
  | "provider-verification"
  | "payouts-payments"
  | "earnings"
  | "reports"
  | "staff-management"
  | "notifications"
  | "settings"
  | "system-logs";

export const dashboardMenuOrder: Array<{ key: DashboardMenuKey; href: string }> = [
  { key: "dashboard", href: "/dashboard" },
  { key: "bookings", href: "/bookings" },
  { key: "washers", href: "/washers" },
  { key: "customers", href: "/customers" },
  { key: "provider-verification", href: "/provider-verification" },
  { key: "payouts-payments", href: "/payouts-payments" },
  { key: "earnings", href: "/earnings" },
  { key: "reports", href: "/reports" },
  { key: "staff-management", href: "/staff-management" },
  { key: "notifications", href: "/notifications" },
  { key: "settings", href: "/settings" },
  { key: "system-logs", href: "/system-logs" },
];

const routeMenuMap: Record<string, DashboardMenuKey> = {
  "/dashboard": "dashboard",
  "/bookings": "bookings",
  "/washers": "washers",
  "/customers": "customers",
  "/provider-verification": "provider-verification",
  "/payouts-payments": "payouts-payments",
  "/earnings": "earnings",
  "/reports": "reports",
  "/issue-reports": "reports",
  "/staff-management": "staff-management",
  "/notifications": "notifications",
  "/settings": "settings",
  "/system-logs": "system-logs",
};

export function getStaffMenus(user: DashboardUser | null | undefined) {
  return user?.staffPermissions?.menus?.filter(Boolean) || [];
}

export function canAccessMenu(user: DashboardUser | null | undefined, menuKey: DashboardMenuKey) {
  if (user?.role === "admin") return true;
  if (user?.role !== "staff") return false;
  return getStaffMenus(user).includes(menuKey);
}

export function canAccessPath(user: DashboardUser | null | undefined, pathname: string) {
  if (user?.role === "admin") return true;
  if (user?.role !== "staff") return false;

  const route = Object.keys(routeMenuMap)
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));

  if (!route) return false;
  return canAccessMenu(user, routeMenuMap[route]);
}

export function getDefaultDashboardHref(user: DashboardUser | null | undefined) {
  if (user?.role === "admin") return "/dashboard";

  const menus = getStaffMenus(user);
  const firstMenu = dashboardMenuOrder.find((item) => menus.includes(item.key));
  return firstMenu?.href || "/login";
}
