import { api } from "@/lib/api";
import type { DashboardUser } from "@/lib/auth-storage";

export type AuthResponse = {
  user: Omit<DashboardUser, "role"> & { role?: string };
  accessToken: string;
  refreshToken?: string;
  role: "admin" | "staff" | "user" | "provider";
  _id: string;
};

export type DashboardOverview = {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalBookings: number;
  weekBookings: number;
  activeWashers: number;
  pendingReports: number;
  pendingPayouts: {
    amount: number;
    count: number;
  };
  platformBalance: number;
  commissionRate: number;
};

export type DashboardRevenuePoint = {
  date: string;
  label?: string;
  revenue: number;
  bookings: number;
};

export type DateRangeQuery = {
  range?: "daily" | "weekly" | "monthly" | "yearly" | "all";
  from?: string;
  to?: string;
};

export type AdminBooking = {
  _id: string;
  status: string;
  finalPrice: number;
  currency?: string;
  bookingDate?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    _id: string;
    name?: string;
    email?: string;
    photo?: { url?: string };
  };
  provider?: {
    _id: string;
    name?: string;
    email?: string;
    photo?: { url?: string };
  };
  service?: {
    _id: string;
    title?: string;
    serviceType?: string;
  };
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type ProviderVerification = {
  _id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  serviceArea?: string;
  nationalInsuranceNumber?: string;
  accountStatus?: "active" | "disabled";
  isOnline?: boolean;
  photo?: { url?: string };
  providerAddress?: {
    streetAddress?: string;
    city?: string;
    country?: string;
    postcode?: string;
  };
  identityVerification?: {
    documentType?: string;
    documentNumber?: string;
    status?: "pending" | "approved" | "rejected";
    idFile?: { url?: string };
    passportOrDrivingLicenseFile?: { url?: string };
  };
  bankDetails?: {
    accountHolderName?: string;
    address?: string;
    city?: string;
    postcode?: string;
    dateOfBirth?: string;
    accountNumber?: string;
    sortCode?: string;
  };
  insurance?: {
    document?: { url?: string };
  };
  adminVerification?: {
    status: "not_submitted" | "pending" | "approved" | "rejected";
    rejectionReason?: string;
    notes?: string;
  };
  enforcement?: {
    status?: "clear" | "warned" | "suspended" | "banned";
    reason?: string;
  };
};

export type AdminUser = Omit<DashboardUser, "role"> & {
  role: "user" | "provider" | "admin" | "staff";
  phoneNumber?: string;
  photo?: { public_id?: string; url?: string };
  isOnline?: boolean;
  isBusy?: boolean;
  serviceArea?: string;
  customerRatingAverage?: number;
  customerRatingCount?: number;
  recentReviews?: Array<{
    _id: string;
    rating: number;
    review?: string;
    createdAt?: string;
    provider?: AdminUser;
  }>;
  adminVerification?: ProviderVerification["adminVerification"];
  enforcement?: ProviderVerification["enforcement"];
  stripeConnect?: {
    accountId?: string;
    payoutsEnabled?: boolean;
    onboardingComplete?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPayment = {
  _id: string;
  userId?: AdminUser;
  providerId?: AdminUser;
  bookingId?: AdminBooking;
  price: number;
  currency?: string;
  paymentStatus?: "complete" | "pending" | "failed";
  status?: "success" | "failed" | "pending";
  paymentMethod?: string;
  transactionId?: string;
  type?: "booking" | "tips" | "donation";
  createdAt?: string;
};

export type EarningsEntry = {
  bookingId: string;
  date: string;
  customer?: AdminUser;
  provider?: AdminUser;
  service?: { title?: string; serviceType?: string };
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  currency?: string;
  status: string;
};

export type AdminEarnings = {
  commissionRate: number;
  summary: {
    today: { grossAmount: number; commissionAmount: number; netAmount: number };
    week: { grossAmount: number; commissionAmount: number; netAmount: number };
    month: { grossAmount: number; commissionAmount: number; netAmount: number };
    period?: { grossAmount: number; commissionAmount: number; netAmount: number };
    netProfit?: number;
    pendingNet: number;
    paidOut: number;
  };
  entries: EarningsEntry[];
};

export type AdminPayout = {
  _id: string;
  provider?: AdminUser;
  amount: number;
  currency?: string;
  status: "pending" | "processing" | "paid" | "failed";
  payoutDate?: string;
  paidAt?: string;
  failureReason?: string;
  stripeTransferId?: string;
  stripeDestinationAccountId?: string;
  stripeMode?: "manual" | "stripe_transfer";
  manualAdjustmentReason?: string;
  createdAt?: string;
};

export type StripeBalanceSnapshot = {
  configured: boolean;
  available: number;
  pending: number;
  currency: string;
  liveMode: boolean | null;
  error?: string;
};

export type AdminPayouts = {
  payouts: AdminPayout[];
  providerBalances: Array<{
    provider?: AdminUser | null;
    jobs: number;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    paidOut: number;
    pendingOut: number;
    payableAmount: number;
  }>;
  statusTotals: Record<string, number>;
  manualTotals?: {
    unpaidAmount: number;
    paidAmount: number;
    unpaidProviders: number;
    paidProviders: number;
  };
  commissionRate: number;
  stripe: {
    dashboardUrl?: string;
    accountId?: string;
    payoutsEnabled?: boolean;
    balance?: StripeBalanceSnapshot;
  };
};

export type AdminReport = {
  _id: string;
  reporter?: AdminUser;
  reporterRole: string;
  reportedUser?: AdminUser;
  booking?: AdminBooking;
  type: "general" | "payment" | "service_quality" | "safety" | "provider_conduct";
  description: string;
  photo?: { public_id?: string; url?: string };
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolutionNote?: string;
  createdAt?: string;
};

export type AdminService = {
  _id: string;
  provider?: AdminUser | string | null;
  catalogKey?: string;
  serviceType: "basic" | "standard" | "premium";
  title?: string;
  price: number;
  carSize: "small" | "medium" | "high";
  carName: string;
  carModel: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminServicesPricing = {
  catalogServices: AdminService[];
  providerSummaries: Array<{
    provider: AdminUser;
    counts: {
      total: number;
      active: number;
      inactive: number;
    };
  }>;
  providerServices: AdminService[];
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
  createdAt?: string;
};

export type ActivityLog = {
  _id: string;
  actor?: AdminUser;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type PlatformSettings = {
  _id: string;
  commissionRate: number;
  providerVerificationRequired: boolean;
  autoPayoutEnabled: boolean;
  nextPayoutDay: string;
  supportEmail: string;
  stripeDashboardUrl?: string;
  stripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
};

export type AdminCommissionWithdrawal = {
  _id: string;
  amount: number;
  currency?: string;
  status: "requested" | "processing" | "paid" | "failed";
  stripePayoutId?: string;
  stripeAccountId?: string;
  stripeDashboardUrl?: string;
  failureReason?: string;
  requestedBy?: DashboardUser;
  createdAt?: string;
};

export type AdminCommissionWithdrawals = {
  summary: {
    commissionRate: number;
    periodCommission: number;
    periodWithdrawn: number;
    availableCommission: number;
    allCommission: number;
    allWithdrawn: number;
  };
  stripe: {
    dashboardUrl?: string;
    accountId?: string;
    payoutsEnabled?: boolean;
    balance?: StripeBalanceSnapshot;
  };
  withdrawals: AdminCommissionWithdrawal[];
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function buildQuery(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, value.toString());
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function loginDashboard(email: string, password: string) {
  const response = await api.post<ApiEnvelope<AuthResponse>>("/auth/login", {
    email,
    password,
  });
  return response.data.data;
}

export async function logoutDashboard() {
  const response = await api.post<ApiEnvelope<null>>("/auth/logout");
  return response.data;
}

export async function getAdminMe() {
  const response = await api.get<ApiEnvelope<DashboardUser>>("/admin/me");
  return response.data.data;
}

export async function updateAdminMe(payload: { name?: string; email?: string }) {
  const response = await api.patch<ApiEnvelope<DashboardUser>>("/admin/me", payload);
  return response.data.data;
}

export async function getDashboardOverview(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<DashboardOverview>>(
    `/admin/dashboard/overview${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getDashboardRevenue(range: DateRangeQuery["range"], dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<DashboardRevenuePoint[]>>(
    `/admin/dashboard/revenue${buildQuery({ ...dateRange, range })}`
  );
  return response.data.data;
}

export async function getRecentBookings(limit = 4, dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminBooking[]>>(
    `/admin/dashboard/recent-bookings${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getUpcomingBookings(limit = 3, dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminBooking[]>>(
    `/admin/dashboard/upcoming-bookings${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getAdminBookings(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<PaginatedResponse<AdminBooking>>>(
    `/admin/bookings${query}`
  );
  return response.data.data;
}

export async function updateAdminBookingStatus(bookingId: string, status: string) {
  const response = await api.patch<ApiEnvelope<AdminBooking>>(
    `/admin/bookings/${bookingId}/status`,
    { status }
  );
  return response.data.data;
}

export async function getProviderVerifications(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<ProviderVerification[]>>(
    `/admin/provider-verifications${query}`
  );
  return response.data.data;
}

export async function updateProviderVerification(
  providerId: string,
  payload: {
    status: "pending" | "approved" | "rejected";
    rejectionReason?: string;
    notes?: string;
  }
) {
  const response = await api.patch<ApiEnvelope<ProviderVerification>>(
    `/admin/providers/${providerId}/verification`,
    payload
  );
  return response.data.data;
}

export async function updateProviderEnforcement(
  providerId: string,
  payload: { status: "clear" | "warned" | "suspended" | "banned"; reason?: string }
) {
  const response = await api.patch<ApiEnvelope<ProviderVerification>>(
    `/admin/providers/${providerId}/enforcement`,
    payload
  );
  return response.data.data;
}

export async function getWashers(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/providers${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getCustomers(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/customers${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getAdminPayments(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<AdminPayment[]>>(`/admin/payments${query}`);
  return response.data.data;
}

export async function getAdminEarnings(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminEarnings>>(
    `/admin/earnings${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getAdminPayouts(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminPayouts>>(
    `/admin/payouts${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createAdminPayout(payload: {
  providerId: string;
  amount: number;
  currency?: string;
  payoutDate?: string;
  status?: "pending" | "processing" | "paid" | "failed";
  manualAdjustmentReason?: string;
  stripeDestinationAccountId?: string;
  useStripe?: boolean;
}) {
  const response = await api.post<ApiEnvelope<AdminPayout>>("/admin/payouts", payload);
  return response.data.data;
}

export async function updateAdminPayoutStatus(
  payoutId: string,
  status: "pending" | "processing" | "paid" | "failed"
) {
  const response = await api.patch<ApiEnvelope<AdminPayout>>(`/admin/payouts/${payoutId}/status`, {
    status,
  });
  return response.data.data;
}

export async function getAdminReports(status = "all", type = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({
    ...dateRange,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
  });
  const response = await api.get<ApiEnvelope<PaginatedResponse<AdminReport>>>(
    `/admin/reports${query}`
  );
  return response.data.data;
}

export async function getAdminReportPhotoBlob(reportId: string) {
  const response = await api.get<Blob>(`/admin/reports/${reportId}/photo`, {
    responseType: "blob",
  });
  return response.data;
}

export async function updateAdminReportStatus(
  reportId: string,
  payload: { status: "open" | "reviewing" | "resolved" | "dismissed"; resolutionNote?: string }
) {
  const response = await api.patch<ApiEnvelope<AdminReport>>(
    `/admin/reports/${reportId}/status`,
    payload
  );
  return response.data.data;
}

export async function getAdminServicesPricing() {
  const response = await api.get<ApiEnvelope<AdminServicesPricing>>("/admin/services-pricing");
  return response.data.data;
}

export async function updateAdminCatalogService(
  serviceId: string,
  payload: Partial<Pick<AdminService, "title" | "price" | "serviceType" | "carSize" | "carName" | "carModel" | "description" | "isActive">>
) {
  const response = await api.patch<ApiEnvelope<AdminService>>(
    `/admin/services-pricing/catalog/${serviceId}`,
    payload
  );
  return response.data.data;
}

export async function updateAdminProviderService(
  providerId: string,
  serviceId: string,
  payload: Pick<AdminService, "isActive">
) {
  const response = await api.patch<ApiEnvelope<AdminService>>(
    `/admin/services-pricing/providers/${providerId}/services/${serviceId}`,
    payload
  );
  return response.data.data;
}

export async function getStaffAccounts(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/staff${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createStaffAccount(payload: {
  name: string;
  email: string;
  password: string;
  staffPermissions: { menus: string[]; actions: string[] };
}) {
  const response = await api.post<ApiEnvelope<AdminUser>>("/admin/staff", payload);
  return response.data.data;
}

export async function updateStaffAccount(
  staffId: string,
  payload: Partial<Pick<AdminUser, "name" | "accountStatus" | "staffPermissions">>
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(`/admin/staff/${staffId}`, payload);
  return response.data.data;
}

export async function deleteStaffAccount(staffId: string) {
  const response = await api.delete<ApiEnvelope<{ staffId: string }>>(`/admin/staff/${staffId}`);
  return response.data.data;
}

export async function getAdminNotifications(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminNotification[]>>(
    `/admin/notifications${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getActivityLogs(dateRange?: DateRangeQuery, limit = 200) {
  const response = await api.get<ApiEnvelope<ActivityLog[]>>(
    `/admin/activity-logs${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getDashboardSettings() {
  const response = await api.get<ApiEnvelope<PlatformSettings>>("/admin/settings");
  return response.data.data;
}

export async function updateDashboardSettings(payload: Partial<PlatformSettings>) {
  const response = await api.patch<ApiEnvelope<PlatformSettings>>("/admin/settings", payload);
  return response.data.data;
}

export async function getAdminCommissionWithdrawals(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminCommissionWithdrawals>>(
    `/admin/commission-withdrawals${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createAdminCommissionWithdrawal(payload: {
  amount: number;
  currency?: string;
}) {
  const response = await api.post<ApiEnvelope<AdminCommissionWithdrawal>>(
    "/admin/commission-withdrawals",
    payload
  );
  return response.data.data;
}
