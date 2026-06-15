import {
  BadgePoundSterling,
  Building2,
  ClipboardCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const metrics = [
  {
    label: "Total Revenue",
    value: "\u00a30",
    sub: "This Week",
    change: "\u00a30",
    icon: BadgePoundSterling,
    tone: "green",
  },
  {
    label: "Total Bookings",
    value: "0",
    sub: "This Week",
    change: "+0",
    icon: ClipboardCheck,
    tone: "blue",
  },
  {
    label: "Active Washers",
    value: "0",
    sub: "Online",
    change: "",
    icon: UsersRound,
    tone: "purple",
  },
  {
    label: "Pending Payouts",
    value: "\u00a30",
    sub: "0 Pending",
    change: "",
    icon: WalletCards,
    tone: "amber",
  },
  {
    label: "Platform Balance",
    value: "\u00a30",
    sub: "Available",
    change: "",
    icon: Building2,
    tone: "bank",
  },
] as const;
