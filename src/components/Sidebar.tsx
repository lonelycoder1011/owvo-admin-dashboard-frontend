"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import {
  canAccessMenu,
  type DashboardMenuKey,
} from "@/lib/dashboard-permissions";
import { initials } from "@/lib/format";
import {
  Bell,
  BadgePoundSterling,
  BookOpenCheck,
  CalendarCheck,
  ChevronRight,
  Gauge,
  Landmark,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

const navItems: Array<{
  key: DashboardMenuKey;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: Gauge },
  { key: "bookings", label: "Bookings", href: "/bookings", icon: CalendarCheck },
  { key: "washers", label: "Washers", href: "/washers", icon: UserRoundCheck },
  { key: "customers", label: "Customers", href: "/customers", icon: UsersRound },
  { key: "provider-verification", label: "Providers Verification", href: "/provider-verification", icon: ShieldCheck },
  { key: "payouts-payments", label: "Payouts & Payments", href: "/payouts-payments", icon: WalletCards },
  { key: "earnings", label: "Earnings", href: "/earnings", icon: Landmark },
  { key: "reports", label: "Services & Pricing", href: "/reports", icon: BadgePoundSterling },
  { key: "staff-management", label: "Staff Management", href: "/staff-management", icon: UsersRound },
  { key: "notifications", label: "Notifications", href: "/notifications", icon: Bell },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings },
  { key: "system-logs", label: "System Logs", href: "/system-logs", icon: BookOpenCheck }
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useDashboardUser();
  const visibleItems =
    user?.role === "staff"
      ? navItems.filter((item) => canAccessMenu(user, item.key))
      : navItems;

  return (
    <aside className="sidebar">
      <div className="brand" aria-label="OWVO">
        <span className="brand-mark" />
        <span className="brand-word">owvo</span>
      </div>

      <div className="sidebar-section-label">Main</div>
      <nav className="sidebar-nav" aria-label="Primary">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              className={active ? "sidebar-link active" : "sidebar-link"}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Link className="sidebar-profile" href="/settings">
        <div className="avatar">{initials(user?.name || user?.email, "A")}</div>
        <div className="profile-copy">
          <p className="profile-name">{user?.name || user?.email || "OWVO Admin"}</p>
          <p className="profile-role">{user?.role === "staff" ? "Staff Operator" : "Admin"}</p>
          <p className="profile-status">
            <span className="online-dot" />
            Online
          </p>
        </div>
        <ChevronRight size={18} color="#dce5ef" />
      </Link>
    </aside>
  );
}
