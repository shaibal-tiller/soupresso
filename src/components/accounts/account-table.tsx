"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleAccountActiveAction } from "@/app/accounts/actions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { formatTaka } from "@/lib/format";

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  balance: number;
}

export function AccountTable({ accounts }: { accounts: AccountRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      const result = await toggleAccountActiveAction(id, next);
      if (!result.success) toast.error(result.message);
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">{account.code}</TableCell>
              <TableCell>
                <div className="font-medium">{account.name}</div>
                {account.description && <div className="text-xs text-muted-foreground">{account.description}</div>}
                {account.isSystem && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    Core
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right font-medium">{formatTaka(account.balance)}</TableCell>
              <TableCell>
                <Switch
                  checked={account.isActive}
                  disabled={isPending || account.isSystem}
                  onCheckedChange={(v) => handleToggle(account.id, v)}
                />
              </TableCell>
              <TableCell>
                <AccountDialog account={account} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
