import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTaka } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  tone?: "default" | "good" | "critical";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 truncate text-2xl font-semibold tabular-nums",
              tone === "good" && "text-chart-good",
              tone === "critical" && "text-chart-critical",
            )}
          >
            {formatTaka(value)}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
