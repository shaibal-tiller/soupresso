import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTaka } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log — Soupresso Ledger" };

const ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;
const ENTITY_TYPES = ["Entry", "DailySale", "Account", "Partner", "MenuItem"] as const;
const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-chart-good/10 text-chart-good border-chart-good/30",
  UPDATE: "",
  DELETE: "bg-chart-critical/10 text-chart-critical border-chart-critical/30",
};

interface AuditLogPageProps {
  searchParams: Promise<{ action?: string; entityType?: string; range?: string }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams;
  const action = ACTIONS.find((a) => a === params.action);
  const entityType = ENTITY_TYPES.find((t) => t === params.entityType);
  const range = params.range && RANGE_OPTIONS.some((r) => r.value === params.range) ? params.range : "30";

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (range !== "all") {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Number(range));
    where.occurredAt = { gte: since };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: 300,
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          A permanent record of every financial action — who did what, and when. Nothing here can be edited or deleted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" method="get">
            <select
              name="range"
              defaultValue={range}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              name="action"
              defaultValue={action ?? ""}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a.charAt(0) + a.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <select
              name="entityType"
              defaultValue={entityType ?? ""}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30"
            >
              <option value="">All record types</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
              Apply
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>{logs.length} record{logs.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity in this range.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(log.occurredAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">{log.actor}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACTION_STYLES[log.action]}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.entityType}</TableCell>
                      <TableCell className="max-w-96 text-sm">{log.summary}</TableCell>
                      <TableCell className="text-right text-sm">
                        {log.amount != null ? formatTaka(Number(log.amount)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
