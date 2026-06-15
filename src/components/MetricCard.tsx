import type { LucideIcon } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  sub: string;
  change?: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "purple" | "amber" | "bank";
};

export function MetricCard({ label, value, sub, change, icon: Icon, tone }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-sub">
          {sub}
          {change ? <strong>{change}</strong> : null}
        </p>
      </div>
      <div className={`metric-icon ${tone}`}>
        <Icon size={27} strokeWidth={2.4} />
      </div>
    </article>
  );
}
