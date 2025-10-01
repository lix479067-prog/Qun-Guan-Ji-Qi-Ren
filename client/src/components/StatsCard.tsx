import { TrendingUp } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  trend?: "up" | "down";
}

export default function StatsCard({ title, value, change, icon, trend }: StatsCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover-lift" data-testid={`card-stat-${title}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2" data-testid={`text-stat-${title}-value`}>
            {value}
          </p>
          {change && (
            <p className={`text-xs mt-2 flex items-center gap-1 ${trend === "up" ? "text-accent" : "text-muted-foreground"}`}>
              {trend === "up" && <TrendingUp className="w-3 h-3" />}
              {change}
            </p>
          )}
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
