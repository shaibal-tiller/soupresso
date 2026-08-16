"use client";

import { useTransition } from "react";
import { togglePartnerActiveAction } from "@/app/partners/actions";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartnerDialog } from "@/components/partners/partner-dialog";
import { formatTaka } from "@/lib/format";

export interface PartnerRow {
  id: string;
  name: string;
  phone: string | null;
  sharePercent: number | null;
  isActive: boolean;
  balance: number;
}

export function PartnerTable({ partners }: { partners: PartnerRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await togglePartnerActiveAction(id, next);
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Share %</TableHead>
            <TableHead className="text-right">Equity Balance</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.id}>
              <TableCell className="font-medium">{partner.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{partner.phone ?? "—"}</TableCell>
              <TableCell className="text-right text-sm">{partner.sharePercent != null ? `${partner.sharePercent}%` : "—"}</TableCell>
              <TableCell className="text-right font-medium">{formatTaka(partner.balance)}</TableCell>
              <TableCell>
                <Switch checked={partner.isActive} disabled={isPending} onCheckedChange={(v) => handleToggle(partner.id, v)} />
              </TableCell>
              <TableCell>
                <PartnerDialog partner={partner} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
