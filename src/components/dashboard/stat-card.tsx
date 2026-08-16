import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTaka } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

const HUE_CLASSES: Record<string, string> = {
  amber: "bg-brand-amber-soft text-brand-amber-deep",
  maroon: "bg-brand-maroon-soft text-brand-maroon",
  green: "bg-brand-green-soft text-brand-green",
  teal: "bg-brand-teal-soft text-brand-teal",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hue = "neutral",
  hint,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  tone?: "default" | "good" | "critical";
  hue?: "amber" | "maroon" | "green" | "teal" | "neutral";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "font-heading mt-1 truncate text-2xl font-semibold tabular-nums",
              tone === "good" && "text-chart-good",
              tone === "critical" && "text-chart-critical",
            )}
          >
            {formatTaka(value)}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("rounded-full p-2.5", HUE_CLASSES[hue])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
