"use client";

import {
  getProviderVerifications,
  updateProviderEnforcement,
  updateProviderVerification,
  type ProviderVerification,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert, FileText, Loader2, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { useState } from "react";

const verificationFilters = [
  { value: "all", label: "All" },
  { value: "not_approved", label: "Not Approved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function hasUrl(value?: { url?: string }) {
  return Boolean(value?.url);
}

function resolvePhotoUrl(url?: string) {
  const value = url?.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${SOCKET_URL}${path}`;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={done ? "check-item done" : "check-item"}>
      {done ? <BadgeCheck size={14} /> : <CircleAlert size={14} />}
      {label}
    </span>
  );
}

function DocumentLink({ label, url }: { label: string; url?: string }) {
  return (
    <a
      className={url ? "doc-link ready" : "doc-link"}
      href={url || "#"}
      onClick={(event) => {
        if (!url) event.preventDefault();
      }}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <span>{url ? "Open" : "Missing"}</span>
    </a>
  );
}

function formatBankDate(value?: string) {
  if (!value) return "Not added";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BankDetailsReview({ provider }: { provider: ProviderVerification }) {
  const bank = provider.bankDetails || {};
  const rows = [
    ["Account holder", bank.accountHolderName],
    ["Address", bank.address],
    ["City", bank.city],
    ["Postcode", bank.postcode],
    ["Date of birth", formatBankDate(bank.dateOfBirth)],
    ["Account number", bank.accountNumber],
    ["Sort code", bank.sortCode],
  ];

  return (
    <div className="bank-details-review">
      {rows.map(([label, value]) => (
        <p key={label}>
          <strong>{label}</strong>
          <span>{value || "Not added"}</span>
        </p>
      ))}
    </div>
  );
}

function ProviderCard({
  provider,
  onApprove,
  onBlock,
  onReject,
  onRestore,
  busy,
}: {
  provider: ProviderVerification;
  onApprove: (providerId: string) => void;
  onBlock: (providerId: string) => void;
  onReject: (providerId: string) => void;
  onRestore: (providerId: string) => void;
  busy: boolean;
}) {
  const status = provider.adminVerification?.status || "not_submitted";
  const statusLabel = status === "not_submitted" ? "not approved" : status.replace("_", " ");
  const providerPhotoUrl = resolvePhotoUrl(provider.photo?.url);
  const enforcementStatus = provider.enforcement?.status || "clear";
  const isBlocked = ["suspended", "banned"].includes(enforcementStatus);
  const address = provider.providerAddress;
  const [showBankDetails, setShowBankDetails] = useState(false);
  const bank = provider.bankDetails || {};
  const hasBankDetails = Boolean(
    bank.accountHolderName &&
      bank.address &&
      bank.city &&
      bank.postcode &&
      bank.dateOfBirth &&
      bank.accountNumber &&
      bank.sortCode
  );

  return (
    <article className="verification-card">
      <div className="verification-card-top">
        {providerPhotoUrl ? (
          <span className="provider-avatar provider-avatar-image">
            <span>{(provider.name || "W").slice(0, 1).toUpperCase()}</span>
            <img
              alt={provider.name || "Provider"}
              src={providerPhotoUrl}
              onError={(event) => {
                event.currentTarget.remove();
              }}
            />
          </span>
        ) : (
          <div className="provider-avatar">{(provider.name || "W").slice(0, 1).toUpperCase()}</div>
        )}
        <div>
          <h2>{provider.name || "Unnamed washer"}</h2>
          <p>{provider.email || "No email"} · {provider.phoneNumber || "No phone"}</p>
          <div className="status-row">
            <span className={`table-status ${status}`}>{statusLabel}</span>
            {status === "approved" ? (
              <span className={`table-status ${isBlocked ? enforcementStatus : "approved"}`}>
                {isBlocked ? enforcementStatus : "active"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="verification-meta">
        <p>
          <strong>Service area</strong>
          <span>{provider.serviceArea || "Not added"}</span>
        </p>
        <p>
          <strong>Address</strong>
          <span>
            {[address?.streetAddress, address?.city, address?.postcode].filter(Boolean).join(", ") ||
              "Not added"}
          </span>
        </p>
      </div>
      <div className="verification-checklist">
        <ChecklistItem done={hasUrl(provider.photo)} label="Selfie photo" />
        <ChecklistItem
          done={hasUrl(provider.identityVerification?.passportOrDrivingLicenseFile)}
          label="Passport / licence"
        />
        <ChecklistItem done={hasBankDetails} label="Bank details" />
      </div>
      <div className="document-grid">
        <DocumentLink label="Selfie" url={provider.photo?.url} />
        <DocumentLink
          label="Passport / Licence"
          url={provider.identityVerification?.passportOrDrivingLicenseFile?.url}
        />
        <button
          className={hasBankDetails ? "doc-link ready doc-link-button" : "doc-link doc-link-button"}
          onClick={() => setShowBankDetails((value) => !value)}
          type="button"
        >
          Bank Details
          <span>{hasBankDetails ? (showBankDetails ? "Hide" : "View") : "Missing"}</span>
        </button>
      </div>
      {showBankDetails ? <BankDetailsReview provider={provider} /> : null}
      <div className="verification-actions">
        {status === "approved" ? (
          isBlocked ? (
            <button
              className="approve-action"
              disabled={busy}
              onClick={() => onRestore(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <Undo2 size={15} />}
              Restore Access
            </button>
          ) : (
            <button
              className="outline-action"
              disabled={busy}
              onClick={() => onBlock(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <XCircle size={15} />}
              Block Provider
            </button>
          )
        ) : (
          <>
            <button
              className="outline-action"
              disabled={busy}
              onClick={() => onReject(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <XCircle size={15} />}
              Reject
            </button>
            <button
              className="approve-action"
              disabled={busy}
              onClick={() => onApprove(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <ShieldCheck size={15} />}
              Approve
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function ProviderVerificationPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");

  const providersQuery = useQuery({
    queryKey: ["provider-verifications", status, dateRange.queryKey],
    queryFn: () => getProviderVerifications(status, dateRange.query),
  });

  const verificationMutation = useMutation({
    mutationFn: ({
      providerId,
      nextStatus,
    }: {
      providerId: string;
      nextStatus: "approved" | "rejected";
    }) =>
      updateProviderVerification(providerId, {
        status: nextStatus,
        rejectionReason: nextStatus === "rejected" ? "Rejected by OWVO admin review." : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });

  const enforcementMutation = useMutation({
    mutationFn: ({
      providerId,
      nextStatus,
      reason,
    }: {
      providerId: string;
      nextStatus: "clear" | "suspended";
      reason?: string;
    }) =>
      updateProviderEnforcement(providerId, {
        status: nextStatus,
        reason: nextStatus === "suspended" ? reason || "Blocked by OWVO admin." : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["washers"] });
    },
  });

  const providers = providersQuery.data ?? [];
  const isMutating = verificationMutation.isPending || enforcementMutation.isPending;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Providers Verification</h1>
          <p>Review washer documents and approve or reject launch access.</p>
        </div>
        <div className="filter-pills">
          {verificationFilters.map((filter) => (
            <button
              className={status === filter.value ? "filter-pill active" : "filter-pill"}
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {providersQuery.isError ? (
        <div className="error-state">Could not load provider verification queue.</div>
      ) : null}

      <div className="verification-grid">
        {providers.map((provider) => (
          <ProviderCard
            busy={isMutating}
            key={provider._id}
            onApprove={(providerId) =>
              verificationMutation.mutate({ providerId, nextStatus: "approved" })
            }
            onBlock={(providerId) =>
              enforcementMutation.mutate({
                providerId,
                nextStatus: "suspended",
                reason: "Blocked by OWVO admin from provider verification dashboard.",
              })
            }
            onReject={(providerId) =>
              verificationMutation.mutate({ providerId, nextStatus: "rejected" })
            }
            onRestore={(providerId) =>
              enforcementMutation.mutate({ providerId, nextStatus: "clear" })
            }
            provider={provider}
          />
        ))}
      </div>

      {providersQuery.isLoading ? (
        <div className="empty-state">
          <FileText size={22} />
          Loading verification queue...
        </div>
      ) : null}
      {!providersQuery.isLoading && providers.length === 0 ? (
        <div className="empty-state">No providers found for this filter.</div>
      ) : null}
    </section>
  );
}
