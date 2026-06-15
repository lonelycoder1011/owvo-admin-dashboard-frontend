"use client";

import {
  getAdminBookings,
  updateAdminBookingStatus,
  type AdminBooking,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth-storage";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Loader2, Navigation, PlayCircle, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Requested" },
  { value: "accepted", label: "Accepted" },
  { value: "arrived", label: "Arrived" },
  { value: "ongoing", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusLabels: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const actionButtons = [
  { status: "accepted", label: "Accept", icon: CheckCircle2 },
  { status: "arrived", label: "Arrived", icon: Navigation },
  { status: "ongoing", label: "Start", icon: PlayCircle },
  { status: "completed", label: "Complete", icon: CheckCircle2 },
  { status: "cancelled", label: "Cancel", icon: XCircle },
];

function BookingRow({
  booking,
  canSeeMoney,
  onUpdate,
  updating,
}: {
  booking: AdminBooking;
  canSeeMoney: boolean;
  onUpdate: (bookingId: string, status: string) => void;
  updating: boolean;
}) {
  const date = booking.bookingDate ? new Date(booking.bookingDate) : null;

  return (
    <tr>
      <td>
        <strong>#{booking._id.slice(-6).toUpperCase()}</strong>
        <span>{date ? format(date, "dd MMM yyyy, hh:mm a") : "No date"}</span>
      </td>
      <td>
        <strong>{booking.user?.name || "Customer"}</strong>
        <span>{booking.user?.email || "No email"}</span>
      </td>
      <td>
        <strong>{booking.provider?.name || "Washer"}</strong>
        <span>{booking.service?.title || booking.service?.serviceType || "Wash Service"}</span>
      </td>
      <td>
        <span className={`table-status ${booking.status}`}>
          {statusLabels[booking.status] || booking.status}
        </span>
      </td>
      {canSeeMoney ? <td className="numeric-cell">{money(booking.finalPrice)}</td> : null}
      <td>
        <div className="row-actions">
          {actionButtons.map((action) => {
            const Icon = action.icon;
            return (
              <button
                aria-label={`${action.label} booking`}
                className="mini-icon-button"
                disabled={updating || booking.status === action.status}
                key={action.status}
                onClick={() => onUpdate(booking._id, action.status)}
                title={action.label}
                type="button"
              >
                {updating ? <Loader2 size={15} /> : <Icon size={15} />}
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function BookingsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const user = useMemo(() => getStoredUser(), []);
  const canSeeMoney = user?.role === "admin";

  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings", status, dateRange.queryKey],
    queryFn: () => getAdminBookings(status, dateRange.query),
  });

  const statusMutation = useMutation({
    mutationFn: ({ bookingId, nextStatus }: { bookingId: string; nextStatus: string }) =>
      updateAdminBookingStatus(bookingId, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-bookings"] });
    },
  });

  const bookings = bookingsQuery.data?.items ?? [];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Bookings</h1>
          <p>Live operational booking control connected to the OWVO backend.</p>
        </div>
        <div className="filter-pills">
          {statusOptions.map((option) => (
            <button
              className={status === option.value ? "filter-pill active" : "filter-pill"}
              key={option.value}
              onClick={() => setStatus(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Washer / Service</th>
              <th>Status</th>
              {canSeeMoney ? <th className="numeric-cell">Amount</th> : null}
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <BookingRow
                booking={booking}
                canSeeMoney={canSeeMoney}
                key={booking._id}
                onUpdate={(bookingId, nextStatus) =>
                  statusMutation.mutate({ bookingId, nextStatus })
                }
                updating={statusMutation.isPending}
              />
            ))}
          </tbody>
        </table>
        {bookingsQuery.isLoading ? (
          <div className="empty-state">
            <Clock3 size={22} />
            Loading bookings...
          </div>
        ) : null}
        {!bookingsQuery.isLoading && bookings.length === 0 ? (
          <div className="empty-state">No bookings found for this filter.</div>
        ) : null}
        {bookingsQuery.isError ? (
          <div className="error-state">Could not load bookings. Check backend and login token.</div>
        ) : null}
      </div>
    </section>
  );
}
