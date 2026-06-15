import { money } from "@/lib/format";
import { Banknote, CalendarDays, PiggyBank } from "lucide-react";
import Link from "next/link";

export type BookingListItem = {
  id?: string;
  name: string;
  service: string;
  status: string;
  statusClass?: string;
  time: string;
  amount: string;
  avatar: string;
  avatarClass?: string;
};

export type UpcomingBookingListItem = {
  id?: string;
  time: string;
  name: string;
  service: string;
  amount: string;
  avatar: string;
  avatarClass?: string;
};

export type PendingPayoutListItem = {
  id?: string;
  name: string;
  jobs: string;
  amount: number;
  avatar: string;
  avatarClass?: string;
};

export type CashoutOverview = {
  totalProviders: number;
  totalPaidOut: number;
  autoCashOutEnabled: boolean;
  thisWeek: number;
  thisMonth: number;
  totalBalance: number;
};

function PanelEmpty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export function RecentBookingsPanel({ bookings = [] }: { bookings?: BookingListItem[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Recent Bookings</h2>
        <Link className="view-all-button" href="/bookings">
          View All
        </Link>
      </div>
      <div className="list-stack">
        {bookings.map((booking, index) => (
          <div
            className="booking-row"
            key={booking.id || `${booking.name}-${booking.time}-${booking.amount}-${index}`}
          >
            <div className={`person-avatar ${booking.avatarClass ?? ""}`}>{booking.avatar}</div>
            <div>
              <p className="row-title">{booking.name}</p>
              <p className="row-sub">{booking.service}</p>
            </div>
            <span className={`status-pill ${booking.statusClass ?? "ongoing"}`}>{booking.status}</span>
            <span className="time-text">{booking.time}</span>
            <span className="amount">{booking.amount}</span>
          </div>
        ))}
      </div>
      {!bookings.length ? <PanelEmpty text="No recent bookings found." /> : null}
    </section>
  );
}

export function UpcomingBookingsPanel({
  bookings = [],
}: {
  bookings?: UpcomingBookingListItem[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Upcoming Bookings</h2>
        <Link className="view-all-button" href="/bookings">
          View All
        </Link>
      </div>
      <div className="list-stack">
        {bookings.map((booking, index) => (
          <div
            className="upcoming-row"
            key={booking.id || `${booking.time}-${booking.name}-${booking.amount}-${index}`}
          >
            <span className="time-text">{booking.time}</span>
            <div className={`person-avatar ${booking.avatarClass ?? ""}`}>{booking.avatar}</div>
            <div>
              <p className="row-title">{booking.name}</p>
              <p className="row-sub">{booking.service}</p>
            </div>
            <span className="tag-today">Today</span>
            <span className="amount">{booking.amount}</span>
          </div>
        ))}
      </div>
      {!bookings.length ? <PanelEmpty text="No upcoming bookings found." /> : null}
    </section>
  );
}

export function PendingPayoutsPanel({
  payouts = [],
  totalPending = 0,
}: {
  payouts?: PendingPayoutListItem[];
  totalPending?: number;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Pending Payouts</h2>
        <Link className="view-all-button" href="/payouts-payments">
          View All
        </Link>
      </div>
      <div className="list-stack">
        {payouts.map((payout, index) => (
          <div className="payout-row" key={payout.id || `${payout.name}-${payout.amount}-${index}`}>
            <div className={`person-avatar ${payout.avatarClass ?? ""}`}>{payout.avatar}</div>
            <div>
              <p className="row-title">{payout.name}</p>
              <p className="row-sub">{payout.jobs}</p>
            </div>
            <span className="amount">{money(payout.amount, 0)}</span>
          </div>
        ))}
      </div>
      {!payouts.length ? <PanelEmpty text="No pending payout balances." /> : null}
      <div className="panel-total">
        <span>Total Pending</span>
        <strong>{money(totalPending, 0)}</strong>
      </div>
    </section>
  );
}

export function CashoutOverviewPanel({ overview }: { overview: CashoutOverview }) {
  const items = [
    {
      label: "Total Providers",
      value: overview.totalProviders.toString(),
      icon: PiggyBank,
      iconClass: "",
    },
    {
      label: "Total Paid Out",
      value: money(overview.totalPaidOut, 0),
      icon: Banknote,
      iconClass: "green",
    },
    {
      label: "Auto Cash Out",
      value: overview.autoCashOutEnabled ? "Enabled" : "Disabled",
      icon: CalendarDays,
      iconClass: "blue",
      valueClass: "blue",
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Provider Cash Out Overview</h2>
        <Link className="view-all-button" href="/payouts-payments">
          View All
        </Link>
      </div>
      <div className="cashout-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div className="cashout-item" key={item.label}>
              <Icon className={`cashout-icon ${item.iconClass}`} size={24} />
              <p className="cashout-label">{item.label}</p>
              <p className={`cashout-value ${item.valueClass ?? ""}`}>{item.value}</p>
            </div>
          );
        })}
      </div>
      <div className="cashout-bottom">
        <div className="cashout-bottom-item">
          <p>This Week</p>
          <strong className="green">{money(overview.thisWeek, 0)}</strong>
        </div>
        <div className="cashout-bottom-item">
          <p>This Month</p>
          <strong className="blue">{money(overview.thisMonth, 0)}</strong>
        </div>
        <div className="cashout-bottom-item">
          <p>Total Balance</p>
          <strong className="blue">{money(overview.totalBalance, 0)}</strong>
        </div>
      </div>
    </section>
  );
}
