import type { DashboardRevenuePoint } from "@/lib/admin-api";
import { compactMoney } from "@/lib/format";
import type { DashboardDateRange } from "@/hooks/useDashboardDateRange";

type RevenueChartProps = {
  data: DashboardRevenuePoint[];
  range: DashboardDateRange;
  onRangeChange: (range: DashboardDateRange) => void;
  isLoading?: boolean;
};

const width = 610;
const height = 220;
const left = 48;
const right = 588;
const top = 34;
const bottom = 164;

function formatLabel(point: DashboardRevenuePoint, range: DashboardDateRange) {
  if (point.label) {
    if (range === "daily") return new Date(point.label).toLocaleTimeString("en-GB", { hour: "2-digit" });
    if (range === "yearly" || range === "all") {
      return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(
        new Date(`${point.label}-01T00:00:00`)
      );
    }
  }

  const value = new Date(`${point.date}T00:00:00`);
  if (range === "weekly") {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(value);
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(value);
}

function buildPoints(values: number[]) {
  const max = Math.max(...values, 1);
  const span = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: left + ((right - left) * index) / span,
    y: bottom - ((bottom - top) * value) / max,
  }));
}

function linePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function areaPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return `${linePath(points)} L ${points[points.length - 1].x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z`;
}

export function RevenueChart({ data, range, onRangeChange, isLoading }: RevenueChartProps) {
  const chartData = data.length ? data : [];
  const revenueValues = chartData.map((point) => Number(point.revenue) || 0);
  const bookingValues = chartData.map((point) => Number(point.bookings) || 0);
  const maxRevenue = Math.max(...revenueValues, 0);
  const revenuePoints = buildPoints(revenueValues);
  const bookingPoints = buildPoints(bookingValues);
  const axisValues = [0, maxRevenue / 2, maxRevenue];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Revenue Overview</h2>
      </div>
      <div className="toggle-row">
        <div className="toggle-group">
          {(["daily", "weekly", "monthly", "yearly"] as const).map((item) => (
            <button
              className={range === item ? "toggle-button active" : "toggle-button"}
              key={item}
              onClick={() => onRangeChange(item)}
              type="button"
            >
              {item === "daily"
                ? "Daily"
                : item === "weekly"
                  ? "Weekly"
                  : item === "monthly"
                    ? "Monthly"
                    : "Yearly"}
            </button>
          ))}
        </div>
        <div className="chart-legend">
          <span>
            <span className="legend-dot revenue" />
            Revenue ({"\u00a3"})
          </span>
          <span>
            <span className="legend-dot bookings" />
            Bookings
          </span>
        </div>
      </div>
      <div className="chart-shell" aria-label={`${range} revenue and bookings chart`}>
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
          <defs>
            <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ffbe12" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffbe12" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[34, 77, 120, 164].map((y) => (
            <line key={y} x1={left} x2={right} y1={y} y2={y} stroke="#eef1f4" strokeWidth="1" />
          ))}
          {axisValues.map((value, index) => (
            <text className="axis-text" key={`${value}-${index}`} x="5" y={164 - index * 65}>
              {compactMoney(value)}
            </text>
          ))}
          {revenuePoints.length ? (
            <>
              <path d={areaPath(revenuePoints)} fill="url(#revenueFill)" />
              <path
                d={linePath(revenuePoints)}
                fill="none"
                stroke="#f2b514"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <path
                d={linePath(bookingPoints)}
                fill="none"
                stroke="#111827"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              {chartData.map((point, index) => (
                <text
                  className="axis-text"
                  key={`${point.date}-${index}`}
                  textAnchor="middle"
                  x={revenuePoints[index].x}
                  y="200"
                >
                  {formatLabel(point, range)}
                </text>
              ))}
            </>
          ) : (
            <text className="axis-text" textAnchor="middle" x="315" y="105">
              {isLoading ? "Loading revenue..." : "No completed bookings yet"}
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}
