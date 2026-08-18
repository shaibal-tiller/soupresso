"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteEntryAction } from "@/app/entries/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTaka, formatDate, CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { useLang } from "@/components/language-provider";

export interface EntryRow {
  id: string;
  date: string;
  category: string;
  description: string;
  vendor: string | null;
  amount: number;
  paymentMethod: string;
  partnerName: string | null;
  debitAccountName: string | null;
  creditAccountName: string | null;
}

export function EntryTable({ entries }: { entries: EntryRow[] }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm(t("Delete this entry? This cannot be undone."))) return;
    startTransition(async () => {
      await deleteEntryAction(id);
      toast.success(t("Entry deleted"));
    });
  }

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("No entries yet. Add your first entry above.")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Date")}</TableHead>
            <TableHead>{t("Category")}</TableHead>
            <TableHead>{t("Description")}</TableHead>
            <TableHead>{t("Flow")}</TableHead>
            <TableHead>{t("Payment")}</TableHead>
            <TableHead className="text-right">{t("Amount")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap text-sm">{formatDate(entry.date)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{t(CATEGORY_LABELS[entry.category] ?? entry.category)}</Badge>
              </TableCell>
              <TableCell className="max-w-64">
                <div className="truncate">{t(entry.description)}</div>
                {(entry.vendor || entry.partnerName) && (
                  <div className="truncate text-xs text-muted-foreground">{entry.vendor ?? entry.partnerName}</div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {entry.debitAccountName} → {entry.creditAccountName}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{t(PAYMENT_METHOD_LABELS[entry.paymentMethod] ?? entry.paymentMethod)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium">{formatTaka(entry.amount)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleDelete(entry.id)}
                  aria-label={t("Delete entry")}
                >
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
