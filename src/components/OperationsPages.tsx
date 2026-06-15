"use client";

import {
  ActivityLog,
  AdminNotification,
  AdminPayment,
  AdminPayout,
  AdminReport,
  AdminService,
  AdminUser,
  createAdminPayout,
  createStaffAccount,
  deleteStaffAccount,
  getActivityLogs,
  getAdminEarnings,
  getAdminNotifications,
  getAdminPayments,
  getAdminPayouts,
  getAdminReportPhotoBlob,
  getAdminReports,
  getAdminServicesPricing,
  getCustomers,
  getDashboardSettings,
  getStaffAccounts,
  getWashers,
  updateAdminMe,
  updateAdminReportStatus,
  updateAdminCatalogService,
  updateAdminProviderService,
  updateDashboardSettings,
  updateStaffAccount,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import { hydrateDashboardSession, storeDashboardSession } from "@/lib/auth-storage";
import { initials, money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BadgePoundSterling,
  Download,
  FileText,
  Loader2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { io } from "socket.io-client";

const menuOptions = [
  { key: "dashboard", label: "Dashboard" },
  { key: "bookings", label: "Bookings" },
  { key: "washers", label: "Washers" },
  { key: "customers", label: "Customers" },
  { key: "provider-verification", label: "Provider Verification" },
  { key: "payouts-payments", label: "Payouts & Payments" },
  { key: "earnings", label: "Earnings" },
  { key: "reports", label: "Services & Pricing" },
  { key: "notifications", label: "Notifications" },
  { key: "system-logs", label: "System Logs" },
];

const reportTypes = [
  { value: "all", label: "All Types" },
  { value: "general", label: "General" },
  { value: "payment", label: "Payment" },
  { value: "service_quality", label: "Service Quality" },
  { value: "safety", label: "Safety" },
  { value: "provider_conduct", label: "Provider Conduct" },
];

function formatReportType(type?: string) {
  return reportTypes.find((item) => item.value === type)?.label || (type || "general").replace(/[_-]+/g, " ");
}

function moneyWithCurrency(amount: number | undefined, currency = "GBP", digits = 2) {
  const value = Number(amount) || 0;
  const code = (currency || "GBP").toUpperCase();

  try {
    return new Intl.NumberFormat("en-GB", {
      currency: code,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      style: "currency",
    }).format(value);
  } catch {
    return `${code} ${new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)}`;
  }
}

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Something went wrong.";

  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const responseMessage = response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  const directMessage = (error as { message?: unknown }).message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  return "Something went wrong.";
}

const statusText: Record<string, string> = {
  not_submitted: "not approved",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  open: "open",
  reviewing: "reviewing",
  resolved: "resolved",
  dismissed: "dismissed",
  success: "success",
  failed: "failed",
  paid: "paid",
  processing: "processing",
};

function relativeDate(value?: string) {
  if (!value) return "No date";
  return formatDistanceToNow(new Date(value), { addSuffix: true }).replace("about ", "");
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="table-card">{children}</div>;
}

function AvatarName({ user, fallback }: { user?: AdminUser | null; fallback: string }) {
  const photoUrl = resolveReportPhotoUrl(user?.photo?.url);
  const initial = initials(user?.name || user?.email, fallback);

  return (
    <div className="inline-person">
      {photoUrl ? (
        <span className="small-avatar person-photo-shell">
          <span>{initial}</span>
          <img
            alt={user?.name || fallback}
            src={photoUrl}
            onError={(event) => {
              event.currentTarget.remove();
            }}
          />
        </span>
      ) : (
        <span className="small-avatar">{initial}</span>
      )}
      <span>
        <strong>{user?.name || fallback}</strong>
        <small>{user?.email || "No email"}</small>
      </span>
    </div>
  );
}

function RatingSummary({ average, count }: { average?: number; count?: number }) {
  return (
    <div className="rating-summary">
      <strong>{Number(average || 0).toFixed(1)}</strong>
      <span>{count || 0} ratings</span>
    </div>
  );
}

function CustomerReviewsSummary({ customer }: { customer: AdminUser }) {
  const reviews = customer.recentReviews || [];

  return (
    <div className="review-summary">
      <RatingSummary average={customer.customerRatingAverage} count={customer.customerRatingCount} />
      {reviews.length ? (
        <span className="review-snippet">
          {reviews[0].review || `${reviews[0].rating}/5 from ${reviews[0].provider?.name || "washer"}`}
        </span>
      ) : (
        <span className="review-snippet muted">No reviews yet</span>
      )}
    </div>
  );
}

function EmptyState({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      {text}
    </div>
  );
}

function safePdfText(value?: unknown, fallback = "Not provided") {
  const text = value === undefined || value === null || value === "" ? fallback : String(value);
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 ? char : " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveReportPhotoUrl(url?: string) {
  const value = url?.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  const path = value.startsWith("/") ? value : `/${value}`;
  return `${SOCKET_URL}${path}`;
}

function escapePdfText(value: string) {
  return safePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatPdfDate(value?: string) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPdfMoneyValue(value?: number, currency = "GBP") {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not provided";
  return `${currency} ${value.toFixed(2)}`;
}

function wrapPdfLines(value: unknown, maxChars: number) {
  const words = safePdfText(value)
    .split(" ")
    .flatMap((word) => {
      if (word.length <= maxChars) return [word];
      const chunks: string[] = [];
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
      return chunks;
    })
    .filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    if (!line) {
      line = word;
      return;
    }
    if (`${line} ${word}`.length <= maxChars) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : ["Not provided"];
}

function limitPdfLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = visible[maxLines - 1];
  visible[maxLines - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : "...";
  return visible;
}

async function loadReportPhotoForPdf(url: string) {
  if (typeof window === "undefined" || !url) return null;

  try {
    let objectUrl = "";
    let imageSource = url;

    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok && !url.startsWith("blob:")) {
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        imageSource = objectUrl;
      }
    } catch {
      imageSource = url;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load report photo"));
      img.src = imageSource;
    });

    const maxEdge = 900;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    const base64 = dataUrl.split(",")[1];
    const binary = window.atob(base64);
    let hex = "";

    for (let index = 0; index < binary.length; index += 1) {
      hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    return {
      hex,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

async function loadReportPhotoBlobForPdf(blob: Blob) {
  if (typeof window === "undefined") return null;

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadReportPhotoForPdf(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function pdfCirclePath(cx: number, cy: number, radius: number) {
  const c = radius * 0.5522847498;
  return [
    `${cx + radius} ${cy} m`,
    `${cx + radius} ${cy + c} ${cx + c} ${cy + radius} ${cx} ${cy + radius} c`,
    `${cx - c} ${cy + radius} ${cx - radius} ${cy + c} ${cx - radius} ${cy} c`,
    `${cx - radius} ${cy - c} ${cx - c} ${cy - radius} ${cx} ${cy - radius} c`,
    `${cx + c} ${cy - radius} ${cx + radius} ${cy - c} ${cx + radius} ${cy} c`,
  ].join(" ");
}

async function createReportPdfBlob(report: AdminReport) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const soft = "0.973 0.977 0.984";
  const reportType = formatReportType(report.type);
  const shortId = report._id.slice(-8).toUpperCase();
  const booking = report.booking;
  const currency = booking?.currency || "GBP";
  const reportPhotoUrl = resolveReportPhotoUrl(report.photo?.url);
  let reportPhotoImage: Awaited<ReturnType<typeof loadReportPhotoForPdf>> = null;

  if (report.photo?.url) {
    try {
      const photoBlob = await getAdminReportPhotoBlob(report._id);
      reportPhotoImage = await loadReportPhotoBlobForPdf(photoBlob);
    } catch {
      reportPhotoImage = reportPhotoUrl ? await loadReportPhotoForPdf(reportPhotoUrl) : null;
    }
  }
  const content: string[] = [];

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
    content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
  };
  const drawText = (
    value: unknown,
    x: number,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    content.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`);
  };
  const drawCenteredText = (
    value: string,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    const textWidth = safePdfText(value).length * size * 0.58;
    drawText(value, (width - textWidth) / 2, y, size, font, color);
  };
  const drawLabel = (
    label: string,
    value: unknown,
    x: number,
    y: number,
    maxChars = 38,
    maxLines = 2,
    valueSize = 10
  ) => {
    drawText(label.toUpperCase(), x, y, 8, "F2", muted);
    const lines = limitPdfLines(wrapPdfLines(value, maxChars), maxLines);
    lines.forEach((item, index) =>
      drawText(item, x, y - 14 - index * 12, valueSize, index === 0 ? "F2" : "F1", text)
    );
  };
  const drawSectionTitle = (title: string, x: number, y: number) => {
    content.push(`q ${yellow} RG 3 w ${x} ${y - 4} m ${x + 26} ${y - 4} l S Q`);
    drawText(title, x + 36, y - 8, 13, "F2", text);
  };
  const drawImageFit = (x: number, y: number, boxWidth: number, boxHeight: number) => {
    if (!reportPhotoImage) return;
    const scale = Math.min(boxWidth / reportPhotoImage.width, boxHeight / reportPhotoImage.height);
    const imageWidth = reportPhotoImage.width * scale;
    const imageHeight = reportPhotoImage.height * scale;
    const imageX = x + (boxWidth - imageWidth) / 2;
    const imageY = y + (boxHeight - imageHeight) / 2;
    rect(x, y, boxWidth, boxHeight, "1 1 1");
    strokeRect(x, y, boxWidth, boxHeight);
    content.push(`q ${imageWidth} 0 0 ${imageHeight} ${imageX} ${imageY} cm /Im1 Do Q`);
  };

  rect(0, 0, width, height, "1 1 1");
  rect(0, height - 112, width, 112, dark);
  rect(0, height - 118, width, 6, yellow);
  content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 54, 17)} S Q`);
  drawText("OWVO", 78, height - 62, 23, "F2", "1 1 1");
  drawCenteredText("Issue Report", height - 94, 18, "F2", "1 1 1");
  drawText(`Report #${shortId}`, 405, height - 51, 12, "F2", "1 1 1");
  drawText(`Generated ${formatPdfDate(new Date().toISOString())}`, 405, height - 72, 9, "F1", "0.820 0.847 0.886");

  rect(34, 642, 527, 72, soft);
  strokeRect(34, 642, 527, 72);
  drawLabel("Status", report.status, 54, 688, 22);
  drawLabel("Type", reportType, 182, 688, 28);
  drawLabel("Created", formatPdfDate(report.createdAt), 330, 688, 30);
  drawLabel("Report ID", report._id, 54, 657, 42, 1);

  drawSectionTitle("People Involved", 40, 614);
  rect(34, 450, 252, 140, "1 1 1");
  strokeRect(34, 450, 252, 140);
  drawText("Reporter", 54, 568, 12, "F2", text);
  drawLabel("Name", report.reporter?.name, 54, 545, 30, 2, 9);
  drawLabel("Email", report.reporter?.email, 54, 508, 30, 2, 9);
  drawLabel("Role", report.reporterRole || report.reporter?.role, 54, 471, 26, 1, 9);

  rect(309, 450, 252, 140, "1 1 1");
  strokeRect(309, 450, 252, 140);
  drawText("Reported User", 329, 568, 12, "F2", text);
  drawLabel("Name", report.reportedUser?.name, 329, 545, 30, 2, 9);
  drawLabel("Email", report.reportedUser?.email, 329, 508, 30, 2, 9);
  drawLabel("Role", report.reportedUser?.role, 329, 471, 26, 1, 9);

  drawSectionTitle("Booking Details", 40, 424);
  rect(34, 322, 527, 78, soft);
  strokeRect(34, 322, 527, 78);
  drawLabel("Booking ID", booking?._id, 54, 377, 36, 2, 9);
  drawLabel("Booking Status", booking?.status, 224, 377, 22, 1, 9);
  drawLabel("Final Price", formatPdfMoneyValue(booking?.finalPrice, currency), 370, 377, 24, 1, 9);
  drawLabel("Booking Date", formatPdfDate(booking?.bookingDate || booking?.createdAt), 54, 344, 38, 1, 9);

  drawSectionTitle("Report Description", 40, 286);
  rect(34, 140, 527, 120, "1 1 1");
  strokeRect(34, 140, 527, 120);
  wrapPdfLines(report.description, reportPhotoImage ? 54 : 88)
    .slice(0, 7)
    .forEach((item, index) => drawText(item, 54, 238 - index * 15, 10, "F1", text));

  if (reportPhotoImage) {
    drawText("Attached photo", 390, 238, 9, "F2", muted);
    drawImageFit(390, 153, 145, 78);
  } else if (reportPhotoUrl) {
    drawText("Attached photo", 54, 118, 9, "F2", muted);
    wrapPdfLines(reportPhotoUrl, 78)
      .slice(0, 2)
      .forEach((item, index) => drawText(item, 54, 104 - index * 12, 8, "F1", muted));
  }

  rect(34, 34, 527, 34, dark);
  drawText("OWVO ADMIN DASHBOARD", 54, 53, 10, "F2", "1 1 1");
  drawText("Professional issue report export for internal review and operations records.", 205, 53, 9, "F1", "0.820 0.847 0.886");
  rect(34, 28, 527, 4, yellow);

  const stream = content.join("\n");
  const imageResource = reportPhotoImage ? " /XObject << /Im1 7 0 R >>" : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${imageResource} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  if (reportPhotoImage) {
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${reportPhotoImage.width} /Height ${reportPhotoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${
        reportPhotoImage.hex.length + 1
      } >>\nstream\n${reportPhotoImage.hex}>\nendstream`
    );
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ReportDownloadButton({ report }: { report: AdminReport }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function download() {
    setIsDownloading(true);
    try {
      const blob = await createReportPdfBlob(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `owvo-report-${report._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <button className="mini-text-button" disabled={isDownloading} onClick={download} type="button">
      <Download size={15} />
      {isDownloading ? "Preparing" : "Download"}
    </button>
  );
}

function createProviderPayoutPdfBlob(payout: AdminPayout) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const soft = "0.973 0.977 0.984";
  const content: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
    content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
  };
  const drawText = (
    value: unknown,
    x: number,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    content.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`);
  };
  const drawCenteredText = (
    value: string,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    const textWidth = safePdfText(value).length * size * (font === "F2" ? 0.58 : 0.52);
    drawText(value, (width - textWidth) / 2, y, size, font, color);
  };
  const drawLabel = (label: string, value: unknown, x: number, y: number, maxChars = 44) => {
    drawText(label.toUpperCase(), x, y, 8, "F2", muted);
    wrapPdfLines(value, maxChars)
      .slice(0, 2)
      .forEach((item, index) => drawText(item, x, y - 16 - index * 13, 11, index === 0 ? "F2" : "F1", text));
  };

  rect(0, 0, width, height, "1 1 1");
  rect(0, height - 100, width, 100, dark);
  rect(0, height - 106, width, 6, yellow);
  content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 50, 17)} S Q`);
  drawText("OWVO", 78, height - 58, 23, "F2", "1 1 1");
  drawCenteredText("Manual Provider Payment Report", height - 84, 16, "F2", "1 1 1");
  drawText(`Record #${payout._id.slice(-8).toUpperCase()}`, 382, height - 46, 12, "F2", "1 1 1");
  drawText(`Generated ${formatPdfDate(new Date().toISOString())}`, 382, height - 66, 9, "F1", "0.820 0.847 0.886");

  rect(34, 610, 527, 96, soft);
  strokeRect(34, 610, 527, 96);
  drawLabel("Provider", payout.provider?.name || "Washer", 54, 676, 34);
  drawLabel("Provider email", payout.provider?.email || "Not provided", 54, 638, 38);
  drawLabel("Amount paid", moneyWithCurrency(payout.amount, payout.currency || "GBP"), 330, 676, 28);
  drawLabel("Status", payout.status, 330, 638, 20);

  rect(34, 462, 527, 112, "1 1 1");
  strokeRect(34, 462, 527, 112);
  drawLabel("Paid date", formatPdfDate(payout.paidAt || payout.createdAt), 54, 540, 34);
  drawLabel("Recorded date", formatPdfDate(payout.createdAt), 54, 502, 34);
  drawLabel("Payment mode", "Manual salary payment outside dashboard automation", 330, 540, 34);
  drawLabel("Admin note", payout.manualAdjustmentReason || "Manual provider salary marked paid by admin", 330, 502, 34);

  rect(34, 34, 527, 34, dark);
  drawText("OWVO ADMIN DASHBOARD", 54, 53, 10, "F2", "1 1 1");
  drawText("Manual payment confirmation for internal operations records.", 205, 53, 9, "F1", "0.820 0.847 0.886");
  rect(34, 28, 527, 4, yellow);

  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ProviderPayoutDownloadButton({ payout }: { payout: AdminPayout }) {
  function download() {
    const blob = createProviderPayoutPdfBlob(payout);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `owvo-provider-payment-${payout._id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button className="mini-text-button" onClick={download} type="button">
      <Download size={15} />
      Download
    </button>
  );
}

function ReportPhotoPreview({ report }: { report: AdminReport }) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const storedUrl = resolveReportPhotoUrl(report.photo?.url);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!report.photo?.url) {
      setPhotoUrl("");
      setState("error");
      return;
    }

    setPhotoUrl("");
    setState("loading");

    getAdminReportPhotoBlob(report._id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setPhotoUrl("");
        setState("error");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report._id, report.photo?.url]);

  if (!report.photo?.url) return null;

  if (state === "loading") {
    return (
      <div className="report-photo-preview">
        <div className="report-photo-state">
          <Loader2 size={18} />
          Loading attached photo...
        </div>
      </div>
    );
  }

  if (state === "error" || !photoUrl) {
    return (
      <div className="report-photo-preview report-photo-preview-error">
        <div className="report-photo-state">
          <FileText size={18} />
          <div>
            <strong>Attached photo unavailable</strong>
            <p>The report has a saved photo reference, but the image file could not be loaded from storage.</p>
          </div>
        </div>
        {storedUrl ? (
          <div className="report-photo-tools">
            <a className="mini-text-button" href={storedUrl} rel="noreferrer" target="_blank">
              Open stored URL
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="report-photo-preview">
      <a href={photoUrl} rel="noreferrer" target="_blank">
        <img alt="Attached report evidence" src={photoUrl} />
        <span>Attached report photo</span>
      </a>
      <div className="report-photo-tools">
        <a className="mini-text-button" href={photoUrl} rel="noreferrer" target="_blank">
          Open photo
        </a>
      </div>
    </div>
  );
}

function humanizeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatMetadataValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatMetadataValue(nestedValue);
        return formatted ? `${humanizeLabel(key)}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
}

function getLogTitle(action: string) {
  const titles: Record<string, string> = {
    "dashboard.login": "Dashboard login",
    "dashboard.logout": "Dashboard logout",
    "dashboard_account.updated": "Dashboard account updated",
    "booking.status_updated": "Booking status updated",
    "provider.verification_updated": "Provider verification updated",
    "provider.enforcement_updated": "Provider access updated",
    "report.status_updated": "Report status updated",
    "staff.created": "Staff account created",
    "staff.updated": "Staff account updated",
    "staff.disabled": "Staff access disabled",
    "staff.deleted": "Staff account deleted",
    "settings.updated": "Dashboard settings updated",
    "payout.created": "Provider payout created",
    "payout.status_updated": "Payout status updated",
    "admin.withdrawal_created": "Admin withdrawal created",
    "admin.withdrawal_status_updated": "Admin withdrawal updated",
    "service.catalog_updated": "Service catalog updated",
    "service.provider_updated": "Provider service updated",
    "user.status_updated": "User status updated",
    "user.role_updated": "User role updated",
    "user.deleted": "User deleted",
  };

  return titles[action] || humanizeLabel(action);
}

function getLogMetadataPairs(metadata?: Record<string, unknown>) {
  return Object.entries(metadata || {})
    .map(([key, value]) => ({
      label: humanizeLabel(key),
      value: formatMetadataValue(value),
    }))
    .filter((entry) => entry.value);
}

function getLogSummary(log: ActivityLog) {
  const pairs = getLogMetadataPairs(log.metadata);
  if (!pairs.length) return "No extra details recorded.";
  return pairs.map((entry) => `${entry.label}: ${entry.value}`).join(" | ");
}

function createActivityLogsPdfBlob(logs: ActivityLog[], rangeLabel: string) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const rowsPerPage = 18;
  const chunks: ActivityLog[][] = [];

  for (let index = 0; index < logs.length; index += rowsPerPage) {
    chunks.push(logs.slice(index, index + rowsPerPage));
  }

  if (!chunks.length) chunks.push([]);

  const makePage = (pageLogs: ActivityLog[], pageIndex: number) => {
    const content: string[] = [];
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
    };
    const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
      content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
    };
    const drawText = (
      value: unknown,
      x: number,
      y: number,
      size = 10,
      font: "F1" | "F2" = "F1",
      color = text
    ) => {
      content.push(
        `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`
      );
    };
    const drawCenteredText = (
      value: string,
      centerX: number,
      y: number,
      size = 10,
      font: "F1" | "F2" = "F1",
      color = text
    ) => {
      const approxWidth = value.length * size * (font === "F2" ? 0.58 : 0.52);
      drawText(value, centerX - approxWidth / 2, y, size, font, color);
    };

    rect(0, 0, width, height, "1 1 1");
    rect(0, height - 94, width, 94, dark);
    rect(0, height - 100, width, 6, yellow);
    content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 48, 17)} S Q`);
    drawText("OWVO", 78, height - 56, 23, "F2", "1 1 1");
    drawCenteredText("System Logs Report", width / 2, height - 81, 15, "F2", "1 1 1");
    drawText(rangeLabel, 405, height - 45, 11, "F2", "1 1 1");
    drawText(`Page ${pageIndex + 1} of ${chunks.length}`, 405, height - 64, 9, "F1", "0.820 0.847 0.886");

    let y = height - 130;
    rect(34, y - 12, 527, 24, "0.973 0.977 0.984");
    strokeRect(34, y - 12, 527, 24);
    drawText("ACTIVITY", 48, y - 2, 8, "F2", muted);
    drawText("ACTOR", 330, y - 2, 8, "F2", muted);
    drawText("TIME", 455, y - 2, 8, "F2", muted);
    y -= 34;

    pageLogs.forEach((log) => {
      const summary = getLogSummary(log);
      rect(34, y - 31, 527, 43, "1 1 1");
      strokeRect(34, y - 31, 527, 43);
      drawText(getLogTitle(log.action), 48, y - 1, 9, "F2", text);
      drawText(wrapPdfLines(summary, 60)[0] || "No details", 48, y - 15, 7, "F1", muted);
      drawText(log.actor?.name || log.actorRole || "System", 330, y - 1, 8, "F1", text);
      drawText(formatPdfDate(log.createdAt), 455, y - 1, 7, "F1", muted);
      y -= 45;
    });

    rect(34, 34, 527, 30, dark);
    drawText("OWVO ADMIN DASHBOARD", 54, 52, 9, "F2", "1 1 1");
    drawText("Professional audit export for admin and staff activity.", 220, 52, 8, "F1", "0.820 0.847 0.886");
    rect(34, 28, 527, 4, yellow);
    return content.join("\n");
  };

  const streams = chunks.map(makePage);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const kids: number[] = [];

  streams.forEach((stream) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = pageObjectNumber + 1;
    kids.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ActivityLogDownloadButton({ logs, rangeLabel }: { logs: ActivityLog[]; rangeLabel: string }) {
  function download() {
    const blob = createActivityLogsPdfBlob(logs, rangeLabel);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `owvo-system-logs-${rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button className="mini-text-button" disabled={!logs.length} onClick={download} type="button">
      <Download size={15} />
      Download PDF
    </button>
  );
}

export function WashersPageContent() {
  const dateRange = useDashboardDateRange();
  const washersQuery = useQuery({
    queryKey: ["washers", dateRange.queryKey],
    queryFn: () => getWashers(dateRange.query),
  });
  const washers = washersQuery.data || [];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Washers</h1>
          <p>Provider records, live status, verification, ratings, and enforcement state.</p>
        </div>
      </div>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Washer</th>
              <th>Status</th>
              <th>Verification</th>
              <th>Rating</th>
              <th>Service Area</th>
            </tr>
          </thead>
          <tbody>
            {washers.map((washer) => (
              <tr key={washer._id}>
                <td>
                  <AvatarName user={washer} fallback="Washer" />
                </td>
                <td>
                  <span className={`table-status ${washer.isOnline ? "approved" : "pending"}`}>
                    {washer.isOnline ? "online" : "offline"}
                  </span>
                </td>
                <td>
                  <span className={`table-status ${washer.adminVerification?.status || "not_submitted"}`}>
                    {statusText[washer.adminVerification?.status || "not_submitted"]}
                  </span>
                </td>
                <td>
                  <RatingSummary
                    average={washer.customerRatingAverage}
                    count={washer.customerRatingCount}
                  />
                </td>
                <td>{washer.serviceArea || "Not set"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {washersQuery.isLoading ? <EmptyState text="Loading washers..." /> : null}
        {!washersQuery.isLoading && washers.length === 0 ? (
          <EmptyState text="No provider accounts found." />
        ) : null}
      </TableShell>
    </section>
  );
}

export function CustomersPageContent() {
  const dateRange = useDashboardDateRange();
  const customersQuery = useQuery({
    queryKey: ["customers", dateRange.queryKey],
    queryFn: () => getCustomers(dateRange.query),
  });
  const customers = customersQuery.data || [];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Customers</h1>
          <p>Customer accounts connected to booking and report activity.</p>
        </div>
      </div>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Reviews</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer._id}>
                <td>
                  <AvatarName user={customer} fallback="Customer" />
                </td>
                <td>{customer.phoneNumber || "No phone"}</td>
                <td>
                  <CustomerReviewsSummary customer={customer} />
                </td>
                <td>
                  <span className={`table-status ${customer.accountStatus || "active"}`}>
                    {customer.accountStatus || "active"}
                  </span>
                </td>
                <td>{relativeDate(customer.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customersQuery.isLoading ? <EmptyState text="Loading customers..." /> : null}
      </TableShell>
    </section>
  );
}

export function EarningsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const earningsQuery = useQuery({
    queryKey: ["admin-earnings", dateRange.queryKey],
    queryFn: () => getAdminEarnings(dateRange.query),
    refetchInterval: 30000,
  });
  const earnings = earningsQuery.data;

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: user?._id ? { userId: user._id } : undefined,
      transports: ["websocket"],
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-earnings"] });
    socket.on("admin_booking_status_updated", refresh);
    socket.on("admin_payout_updated", refresh);
    return () => {
      socket.off("admin_booking_status_updated", refresh);
      socket.off("admin_payout_updated", refresh);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Earnings</h1>
          <p>Completed-booking earnings with OWVO commission and washer net income.</p>
        </div>
      </div>
      <div className="summary-grid">
        <article className="stat-card">
          <span>Today OWVO Earnings</span>
          <strong>{money(earnings?.summary.today.commissionAmount)}</strong>
        </article>
        <article className="stat-card">
          <span>This Week OWVO Earnings</span>
          <strong>{money(earnings?.summary.week.commissionAmount)}</strong>
        </article>
        <article className="stat-card">
          <span>Net Profit</span>
          <strong>{money(earnings?.summary.netProfit ?? earnings?.summary.pendingNet)}</strong>
        </article>
        <article className="stat-card">
          <span>Paid Out</span>
          <strong>{money(earnings?.summary.paidOut)}</strong>
        </article>
      </div>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Washer</th>
              <th>Service</th>
              <th className="numeric-cell">Gross</th>
              <th className="numeric-cell">OWVO 25%</th>
              <th className="numeric-cell">Washer Net</th>
            </tr>
          </thead>
          <tbody>
            {(earnings?.entries || []).map((entry) => (
              <tr key={entry.bookingId}>
                <td>
                  <strong>#{entry.bookingId.toString().slice(-6).toUpperCase()}</strong>
                  <span>{relativeDate(entry.date)}</span>
                </td>
                <td>{entry.provider?.name || "Washer"}</td>
                <td>{entry.service?.title || entry.service?.serviceType || "Wash Service"}</td>
                <td className="numeric-cell">{money(entry.grossAmount)}</td>
                <td className="numeric-cell">{money(entry.commissionAmount)}</td>
                <td className="numeric-cell">{money(entry.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {earningsQuery.isLoading ? <EmptyState text="Loading earnings..." /> : null}
      </TableShell>
    </section>
  );
}

export function PayoutsPaymentsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", dateRange.queryKey],
    queryFn: () => getAdminPayments("all", dateRange.query),
  });
  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts", dateRange.queryKey],
    queryFn: () => getAdminPayouts(dateRange.query),
  });
  const createPayoutMutation = useMutation({
    mutationFn: (balance: NonNullable<NonNullable<typeof payoutsQuery.data>["providerBalances"]>[number]) =>
      createAdminPayout({
        providerId: balance.provider?._id || "",
        amount: balance.payableAmount,
        currency: "GBP",
        status: "paid",
        manualAdjustmentReason: `Manual provider salary paid by admin for ${dateRange.label}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });
  const stripeBalance = payoutsQuery.data?.stripe?.balance;
  const stripeCurrency = stripeBalance?.currency || "GBP";
  const providerBalances = payoutsQuery.data?.providerBalances || [];
  const manualTotals = payoutsQuery.data?.manualTotals;
  const paidRecords = (payoutsQuery.data?.payouts || []).filter((payout) => payout.status === "paid");
  const statusTotals = payoutsQuery.data?.statusTotals || {};
  const commissionPercent = Math.round((payoutsQuery.data?.commissionRate || 0.25) * 100);
  const washerPercent = 100 - commissionPercent;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Payouts & Payments</h1>
          <p>Stripe payment records and admin payout tracking from the backend.</p>
        </div>
      </div>
      <div className="summary-grid">
        <article className="stat-card">
          <span>Pending Payouts</span>
          <strong>{money(manualTotals?.unpaidAmount)}</strong>
          <small>{manualTotals?.unpaidProviders || 0} unpaid washers</small>
        </article>
        <article className="stat-card">
          <span>Paid</span>
          <strong>{money(statusTotals.paid)}</strong>
          <small>{manualTotals?.paidProviders || 0} settled washers</small>
        </article>
        <article className="stat-card">
          <span>Failed</span>
          <strong>{money(statusTotals.failed)}</strong>
        </article>
        <article className="stat-card">
          <span>Stripe Available</span>
          <strong>{moneyWithCurrency(stripeBalance?.available, stripeCurrency)}</strong>
          <small>
            Pending {moneyWithCurrency(stripeBalance?.pending, stripeCurrency)} ·{" "}
            {stripeBalance?.configured ? (stripeBalance?.liveMode ? "Live mode" : "Test mode") : "Not configured"}
          </small>
        </article>
      </div>
      {stripeBalance?.error ? (
        <p className="form-error">Stripe: {stripeBalance.error}</p>
      ) : null}
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Provider Balance</th>
              <th className="numeric-cell">Gross</th>
              <th className="numeric-cell">OWVO {commissionPercent}%</th>
              <th className="numeric-cell">Washer {washerPercent}%</th>
              <th className="numeric-cell">Paid</th>
              <th className="numeric-cell">Payable</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {providerBalances.map((balance) => {
              const isPaid = balance.payableAmount <= 0 && balance.netAmount > 0;
              return (
                <tr key={balance.provider?._id || `${balance.grossAmount}-${balance.jobs}`}>
                  <td>
                    <strong>{balance.provider?.name || "Washer"}</strong>
                    <span>{balance.jobs} completed jobs</span>
                  </td>
                  <td className="numeric-cell">{money(balance.grossAmount)}</td>
                  <td className="numeric-cell">{money(balance.commissionAmount)}</td>
                  <td className="numeric-cell">{money(balance.netAmount)}</td>
                  <td className="numeric-cell">{money(balance.paidOut)}</td>
                  <td className="numeric-cell">{money(balance.payableAmount)}</td>
                  <td>
                    <span className={`table-status ${isPaid ? "paid" : "pending"}`}>
                      {isPaid ? "paid" : "not paid"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="mini-text-button"
                      disabled={
                        !balance.provider?._id ||
                        balance.payableAmount <= 0 ||
                        createPayoutMutation.isPending
                      }
                      onClick={() => {
                        const providerName = balance.provider?.name || "this washer";
                        const confirmed = window.confirm(
                          `Confirm ${money(balance.payableAmount)} has already been manually paid to ${providerName}?`
                        );
                        if (confirmed) createPayoutMutation.mutate(balance);
                      }}
                      type="button"
                    >
                      Paid
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
      {createPayoutMutation.error ? (
        <p className="form-error">{getApiErrorMessage(createPayoutMutation.error)}</p>
      ) : null}
      <TableShell>
        <div className="table-heading-row">
          <div>
            <h2>Manual Provider Payment Records</h2>
            <p>Saved records for salaries the admin has already paid manually.</p>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Record</th>
              <th>Provider</th>
              <th className="numeric-cell">Amount</th>
              <th>Status</th>
              <th>Paid Date</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {paidRecords.map((payout) => (
              <tr key={payout._id}>
                <td>
                  <strong>#{payout._id.slice(-6).toUpperCase()}</strong>
                  <span>{relativeDate(payout.createdAt)}</span>
                </td>
                <td>{payout.provider?.name || "Washer"}</td>
                <td className="numeric-cell">{money(payout.amount)}</td>
                <td>
                  <span className={`table-status ${payout.status}`}>{payout.status}</span>
                </td>
                <td>{relativeDate(payout.paidAt || payout.createdAt)}</td>
                <td><ProviderPayoutDownloadButton payout={payout} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!paidRecords.length ? <EmptyState text="No manual provider payments recorded for this period." /> : null}
      </TableShell>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Customer</th>
              <th>Provider</th>
              <th>Type</th>
              <th className="numeric-cell">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(paymentsQuery.data || []).map((payment: AdminPayment) => (
              <tr key={payment._id}>
                <td>
                  <strong>{payment.transactionId || `#${payment._id.slice(-6)}`}</strong>
                  <span>{relativeDate(payment.createdAt)}</span>
                </td>
                <td>{payment.userId?.name || "Customer"}</td>
                <td>{payment.providerId?.name || "Washer"}</td>
                <td>{payment.type || "booking"}</td>
                <td className="numeric-cell">{money(payment.price)}</td>
                <td>
                  <span className={`table-status ${payment.status}`}>{payment.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

function CatalogServiceRow({ service }: { service: AdminService }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(service.title || "");
  const [price, setPrice] = useState(service.price.toString());
  const [serviceType, setServiceType] = useState(service.serviceType);
  const [carSize, setCarSize] = useState(service.carSize);
  const [description, setDescription] = useState(service.description || "");
  const [isActive, setIsActive] = useState(service.isActive);
  const mutation = useMutation({
    mutationFn: () =>
      updateAdminCatalogService(service._id, {
        title,
        price: Number(price),
        serviceType,
        carSize,
        carName: service.carName || "Any car",
        carModel: service.carModel || "Any model",
        description,
        isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] }),
  });

  useEffect(() => {
    setTitle(service.title || "");
    setPrice(service.price.toString());
    setServiceType(service.serviceType);
    setCarSize(service.carSize);
    setDescription(service.description || "");
    setIsActive(service.isActive);
  }, [service]);

  return (
    <tr>
      <td>
        <input className="table-input" onChange={(event) => setTitle(event.target.value)} value={title} />
        <span>{service.catalogKey || "catalog"}</span>
      </td>
      <td>
        <select
          className="table-select"
          onChange={(event) => setServiceType(event.target.value as AdminService["serviceType"])}
          value={serviceType}
        >
          <option value="basic">Basic</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </td>
      <td>
        <select
          className="table-select"
          onChange={(event) => setCarSize(event.target.value as AdminService["carSize"])}
          value={carSize}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </td>
      <td className="numeric-cell">
        <input
          className="table-input numeric-table-input"
          min="1"
          onChange={(event) => setPrice(event.target.value)}
          type="number"
          value={price}
        />
      </td>
      <td>
        <input
          className="table-input"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </td>
      <td>
        <label className="check-label compact-check">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
          Active
        </label>
      </td>
      <td>
        <button className="approve-action" disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">
          <Save size={15} />
          Save
        </button>
      </td>
    </tr>
  );
}

function getProviderFromService(service: AdminService) {
  return typeof service.provider === "object" && service.provider !== null
    ? service.provider
    : null;
}

export function ServicesPricingPageContent() {
  const queryClient = useQueryClient();
  const servicesQuery = useQuery({
    queryKey: ["admin-services-pricing"],
    queryFn: getAdminServicesPricing,
  });
  const updateProviderServiceMutation = useMutation({
    mutationFn: ({
      providerId,
      serviceId,
      isActive,
    }: {
      providerId: string;
      serviceId: string;
      isActive: boolean;
    }) => updateAdminProviderService(providerId, serviceId, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] }),
  });
  const data = servicesQuery.data;
  const activeProviderServices = data?.providerServices.filter((service) => service.isActive).length || 0;
  const averageServices =
    data?.providerSummaries.length
      ? data.providerSummaries.reduce((sum, item) => sum + item.counts.active, 0) /
        data.providerSummaries.length
      : 0;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Services & Pricing</h1>
          <p>Platform-controlled service names, prices, and provider service availability.</p>
        </div>
      </div>
      <div className="summary-grid">
        <article className="stat-card">
          <span>Catalog Services</span>
          <strong>{data?.catalogServices.length || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Providers</span>
          <strong>{data?.providerSummaries.length || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Active Provider Services</span>
          <strong>{activeProviderServices}</strong>
        </article>
        <article className="stat-card">
          <span>Avg Services / Provider</span>
          <strong>{averageServices.toFixed(1)}</strong>
        </article>
      </div>
      <TableShell>
        <table className="admin-table service-pricing-table">
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Type</th>
              <th>Car Size</th>
              <th className="numeric-cell">Price</th>
              <th>Description</th>
              <th>Status</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            {(data?.catalogServices || []).map((service) => (
              <CatalogServiceRow key={service._id} service={service} />
            ))}
          </tbody>
        </table>
        {servicesQuery.isLoading ? <EmptyState icon={<BadgePoundSterling size={22} />} text="Loading services..." /> : null}
      </TableShell>
      <div className="split-grid">
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Service Area</th>
                <th>Active Services</th>
                <th>Total Services</th>
              </tr>
            </thead>
            <tbody>
              {(data?.providerSummaries || []).map((item) => (
                <tr key={item.provider._id}>
                  <td>
                    <AvatarName user={item.provider} fallback="Provider" />
                  </td>
                  <td>{item.provider.serviceArea || "Not set"}</td>
                  <td>{item.counts.active}</td>
                  <td>{item.counts.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider Service</th>
                <th>Provider</th>
                <th className="numeric-cell">Price</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {(data?.providerServices || []).map((service) => {
                const provider = getProviderFromService(service);
                return (
                  <tr key={service._id}>
                    <td>
                      <strong>{service.title || "Service"}</strong>
                      <span>{service.serviceType}</span>
                    </td>
                    <td>{provider?.name || provider?.email || "Provider"}</td>
                    <td className="numeric-cell">{money(service.price)}</td>
                    <td>
                      <button
                        className="mini-text-button"
                        disabled={updateProviderServiceMutation.isPending || !provider?._id}
                        onClick={() =>
                          provider?._id
                            ? updateProviderServiceMutation.mutate({
                                providerId: provider._id,
                                serviceId: service._id,
                                isActive: !service.isActive,
                              })
                            : undefined
                        }
                        type="button"
                      >
                        {service.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </div>
    </section>
  );
}

export function ReportsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const reportsQuery = useQuery({
    queryKey: ["admin-reports", status, type, dateRange.queryKey],
    queryFn: () => getAdminReports(status, type, dateRange.query),
  });
  const updateMutation = useMutation({
    mutationFn: ({ reportId, nextStatus }: { reportId: string; nextStatus: AdminReport["status"] }) =>
      updateAdminReportStatus(reportId, { status: nextStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });
  const reports = reportsQuery.data?.items || [];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Reports</h1>
          <p>Issue reports from customers and providers, viewable and downloadable.</p>
        </div>
        <div className="filter-pills">
          {["all", "open", "reviewing", "resolved", "dismissed"].map((item) => (
            <button className={status === item ? "filter-pill active" : "filter-pill"} key={item} onClick={() => setStatus(item)} type="button">
              {item}
            </button>
          ))}
          {reportTypes.map((item) => (
            <button className={type === item.value ? "filter-pill active" : "filter-pill"} key={item.value} onClick={() => setType(item.value)} type="button">
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="split-grid">
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Reporter</th>
                <th>Type</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id}>
                  <td>
                    <strong>#{report._id.slice(-6).toUpperCase()}</strong>
                    <span>{relativeDate(report.createdAt)}</span>
                  </td>
                  <td>{report.reporter?.name || report.reporterRole}</td>
                  <td>{formatReportType(report.type)}</td>
                  <td>
                    <span className={`table-status ${report.status}`}>{report.status}</span>
                  </td>
                  <td>
                    <button className="mini-text-button" onClick={() => setSelected(report)} type="button">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        <aside className="detail-panel">
          {selected ? (
            <>
              <h2>Report #{selected._id.slice(-6).toUpperCase()}</h2>
              <p>{selected.description}</p>
              <ReportPhotoPreview report={selected} />
              <div className="detail-actions">
                <ReportDownloadButton report={selected} />
              </div>
              <div className="row-actions">
                {(["reviewing", "resolved", "dismissed"] as const).map((nextStatus) => (
                  <button
                    className="mini-text-button"
                    key={nextStatus}
                    onClick={() => updateMutation.mutate({ reportId: selected._id, nextStatus })}
                    type="button"
                  >
                    {nextStatus}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={<FileText size={22} />} text="Select a report to view details." />
          )}
        </aside>
      </div>
    </section>
  );
}

function StaffEditPanel({
  staff,
  onClose,
}: {
  staff: AdminUser;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(staff.name || "");
  const [selectedMenus, setSelectedMenus] = useState<string[]>(
    staff.staffPermissions?.menus || []
  );
  const saveMutation = useMutation({
    mutationFn: () =>
      updateStaffAccount(staff._id, {
        name,
        staffPermissions: {
          menus: selectedMenus,
          actions: staff.staffPermissions?.actions || ["booking.status.update"],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
      onClose();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteStaffAccount(staff._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
      onClose();
    },
  });

  useEffect(() => {
    setName(staff.name || "");
    setSelectedMenus(staff.staffPermissions?.menus || []);
  }, [staff]);

  return (
    <form
      className="staff-form"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
    >
      <label>
        Staff name
        <input onChange={(event) => setName(event.target.value)} value={name} />
      </label>
      <label>
        Staff email
        <input disabled value={staff.email || ""} />
      </label>
      <div className="permission-grid">
        {menuOptions.map((menu) => (
          <label className="check-label" key={menu.key}>
            <input
              checked={selectedMenus.includes(menu.key)}
              onChange={(event) =>
                setSelectedMenus((current) =>
                  event.target.checked
                    ? [...current, menu.key]
                    : current.filter((key) => key !== menu.key)
                )
              }
              type="checkbox"
            />
            {menu.label}
          </label>
        ))}
      </div>
      <div className="row-actions">
        <button className="approve-action" disabled={saveMutation.isPending} type="submit">
          <Save size={15} />
          Save Access
        </button>
        <button className="mini-text-button" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="reject-action"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(`Delete staff account ${staff.email}?`)) {
              deleteMutation.mutate();
            }
          }}
          type="button"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </form>
  );
}

export function StaffManagementPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [menus, setMenus] = useState<string[]>(["bookings"]);
  const [editingStaff, setEditingStaff] = useState<AdminUser | null>(null);
  const staffQuery = useQuery({
    queryKey: ["staff-accounts", dateRange.queryKey],
    queryFn: () => getStaffAccounts(dateRange.query),
  });
  const createMutation = useMutation({
    mutationFn: (formData: FormData) =>
      createStaffAccount({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        staffPermissions: { menus, actions: ["booking.status.update"] },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ staffId, accountStatus }: { staffId: string; accountStatus: "active" | "disabled" }) =>
      updateStaffAccount(staffId, { accountStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (staffId: string) => deleteStaffAccount(staffId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(new FormData(event.currentTarget));
    event.currentTarget.reset();
  }

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Staff Management</h1>
          <p>Create staff accounts and choose exactly which dashboard menus they can access.</p>
        </div>
      </div>
      <form className="staff-form" onSubmit={submit}>
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" required type="email" />
        </label>
        <label>
          Password
          <input name="password" required type="password" />
        </label>
        <div className="permission-grid">
          {menuOptions.map((menu) => (
            <label className="check-label" key={menu.key}>
              <input
                checked={menus.includes(menu.key)}
                onChange={(event) =>
                  setMenus((current) =>
                    event.target.checked
                      ? [...current, menu.key]
                      : current.filter((key) => key !== menu.key)
                  )
                }
                type="checkbox"
              />
              {menu.label}
            </label>
          ))}
        </div>
        <button className="approve-action" disabled={createMutation.isPending} type="submit">
          <ShieldCheck size={15} />
          Create Staff
        </button>
      </form>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Status</th>
              <th>Menus</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {(staffQuery.data || []).map((staff) => (
              <tr key={staff._id}>
                <td>
                  <AvatarName user={staff} fallback="Staff" />
                </td>
                <td>
                  <span className={`table-status ${staff.accountStatus}`}>{staff.accountStatus}</span>
                </td>
                <td>{(staff.staffPermissions?.menus || []).join(", ") || "No menus"}</td>
                <td>
                  <div className="row-actions">
                    <button className="mini-text-button" onClick={() => setEditingStaff(staff)} type="button">
                      Edit
                    </button>
                    <button
                      className="mini-text-button"
                      onClick={() =>
                        updateMutation.mutate({
                          staffId: staff._id,
                          accountStatus: staff.accountStatus === "disabled" ? "active" : "disabled",
                        })
                      }
                      type="button"
                    >
                      {staff.accountStatus === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      className="mini-text-button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete staff account ${staff.email}?`)) {
                          deleteMutation.mutate(staff._id);
                        }
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      {editingStaff ? <StaffEditPanel onClose={() => setEditingStaff(null)} staff={editingStaff} /> : null}
    </section>
  );
}

export function NotificationsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications", dateRange.queryKey],
    queryFn: () => getAdminNotifications(dateRange.query),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: user?._id ? { userId: user._id } : undefined,
      transports: ["websocket"],
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
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
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Notifications</h1>
          <p>Booking, payment, payout, report, and system activity updates.</p>
        </div>
      </div>
      <div className="notification-list">
        {(notificationsQuery.data || []).map((notification: AdminNotification) => (
          <article className={`notification-card ${notification.severity}`} key={notification.id}>
            <Bell size={18} />
            <div>
              <h2>{notification.title}</h2>
              <p>{notification.message}</p>
              <span>{relativeDate(notification.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
      {notificationsQuery.isLoading ? (
        <EmptyState icon={<Loader2 size={22} />} text="Loading notifications..." />
      ) : null}
      {notificationsQuery.isError ? (
        <EmptyState icon={<Bell size={22} />} text="Notifications could not load. Please refresh after the backend is running with the latest changes." />
      ) : null}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && !notificationsQuery.data?.length ? (
        <EmptyState icon={<Bell size={22} />} text="No notifications for the selected time range." />
      ) : null}
    </section>
  );
}

export function SettingsPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const settingsQuery = useQuery({ queryKey: ["dashboard-settings"], queryFn: getDashboardSettings });
  const settings = settingsQuery.data;
  const profileMutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateAdminMe({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
      }),
    onSuccess: (updatedUser) => {
      const session = hydrateDashboardSession();
      if (session.token) {
        storeDashboardSession({
          accessToken: session.token,
          user: updatedUser,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-settings"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateDashboardSettings({
        commissionRate: Number(formData.get("commissionRate")) / 100,
        providerVerificationRequired: formData.get("providerVerificationRequired") === "on",
        autoPayoutEnabled: formData.get("autoPayoutEnabled") === "on",
        nextPayoutDay: String(formData.get("nextPayoutDay") || "Friday"),
        supportEmail: String(formData.get("supportEmail") || ""),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-settings"] }),
  });

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Settings</h1>
          <p>Admin-controlled platform settings connected to the backend.</p>
        </div>
      </div>
      <form
        className="settings-form"
        key={user?.email || "profile"}
        onSubmit={(event) => {
          event.preventDefault();
          profileMutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          Admin name
          <input defaultValue={user?.name || ""} name="name" />
        </label>
        <label>
          Admin email
          <input defaultValue={user?.email || ""} name="email" type="email" />
        </label>
        <button className="approve-action" disabled={profileMutation.isPending} type="submit">
          <Save size={15} />
          Save Admin Profile
        </button>
      </form>
      <form
        className="settings-form"
        key={settings?._id || "platform-settings"}
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          OWVO Commission %
          <input defaultValue={settings ? settings.commissionRate * 100 : 25} name="commissionRate" type="number" />
        </label>
        <label>
          Next payout day
          <input defaultValue={settings?.nextPayoutDay || "Friday"} name="nextPayoutDay" />
        </label>
        <label>
          Support email
          <input defaultValue={settings?.supportEmail || "support@owvo.co.uk"} name="supportEmail" type="email" />
        </label>
        <label className="check-label">
          <input defaultChecked={settings?.providerVerificationRequired ?? true} name="providerVerificationRequired" type="checkbox" />
          Require provider verification before going online
        </label>
        <label className="check-label">
          <input defaultChecked={settings?.autoPayoutEnabled ?? false} name="autoPayoutEnabled" type="checkbox" />
          Auto payout enabled
        </label>
        <button className="approve-action" disabled={updateMutation.isPending} type="submit">
          <SlidersHorizontal size={15} />
          Save Settings
        </button>
      </form>
    </section>
  );
}

export function SystemLogsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const logsQuery = useQuery({
    queryKey: ["activity-logs", dateRange.queryKey],
    queryFn: () => getActivityLogs(dateRange.query, 200),
  });
  const logs = logsQuery.data || [];

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: user?._id ? { userId: user._id } : undefined,
      transports: ["websocket"],
    });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    socket.on("admin_activity_log_created", refresh);
    return () => {
      socket.off("admin_activity_log_created", refresh);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>System Logs</h1>
          <p>Live audit trail for admin and staff actions.</p>
        </div>
        <ActivityLogDownloadButton logs={logs} rangeLabel={dateRange.label} />
      </div>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: ActivityLog) => {
              const pairs = getLogMetadataPairs(log.metadata);

              return (
                <tr key={log._id}>
                  <td>
                    <div className="log-activity-cell">
                      <strong>{getLogTitle(log.action)}</strong>
                      <span>{pairs.length ? getLogSummary(log) : "No extra details recorded."}</span>
                      {pairs.length ? (
                        <div className="log-chip-row">
                          {pairs.slice(0, 4).map((entry) => (
                            <em key={`${log._id}-${entry.label}`}>
                              {entry.label}: {entry.value}
                            </em>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <strong>{log.actor?.name || log.actorRole || "System"}</strong>
                    <span>{log.actor?.email || log.actorRole || "Audit"}</span>
                  </td>
                  <td>
                    <span className="log-entity-pill">{humanizeLabel(log.entityType)}</span>
                  </td>
                  <td>
                    <strong>{relativeDate(log.createdAt)}</strong>
                    <span>{formatPdfDate(log.createdAt)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logsQuery.isLoading ? <EmptyState icon={<Loader2 size={22} />} text="Loading system logs..." /> : null}
      </TableShell>
    </section>
  );
}
