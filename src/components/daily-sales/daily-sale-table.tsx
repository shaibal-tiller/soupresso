"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteDailySaleAction } from "@/app/daily-sales/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTaka, formatDate } from "@/lib/format";

export interface DailySaleRow {
  id: string;
  date: string;
  cashAmount: number;
  bankAmount: number;
  totalAmount: number;
  itemCount: number;
  notes: string | null;
}

export function DailySaleTable({ rows }: { rows: DailySaleRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Delete this daily sales record? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteDailySaleAction(id);
      toast.success("Daily sales record deleted");
    });
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No daily sales recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Bank</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-sm">{formatDate(row.date)}</TableCell>
              <TableCell className="text-right">{formatTaka(row.cashAmount)}</TableCell>
              <TableCell className="text-right">{formatTaka(row.bankAmount)}</TableCell>
              <TableCell className="text-right font-medium">{formatTaka(row.totalAmount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.itemCount} line{row.itemCount === 1 ? "" : "s"}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleDelete(row.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
