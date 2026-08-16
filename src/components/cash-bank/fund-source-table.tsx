"use client";

import { useTransition } from "react";
import { toggleFundSourceActiveAction } from "@/app/cash-bank/actions";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import { EditFundSourceDialog } from "@/components/cash-bank/edit-fund-source-dialog";
import { SetBalanceDialog } from "@/components/cash-bank/set-balance-dialog";
import { Wallet } from "lucide-react";
import { useLang } from "@/components/language-provider";

export interface FundSourceRow {
  id: string;
  name: string;
  description: string | null;
  balance: number;
  isActive: boolean;
  isSystem: boolean;
}

export function FundSourceTable({ accounts }: { accounts: FundSourceRow[] }) {
  const { t } = useLang();
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await toggleFundSourceActiveAction(id, next);
    });
  }

  if (accounts.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("No cash/bank accounts yet. Add one above.")}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <Card key={account.id} className={!account.isActive ? "opacity-60" : undefined}>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium leading-tight">{account.name}</div>
                  {account.description && <div className="text-xs text-muted-foreground">{account.description}</div>}
                </div>
              </div>
              <Switch checked={account.isActive} disabled={isPending} onCheckedChange={(v) => handleToggle(account.id, v)} />
            </div>
            <div className="text-2xl font-semibold tabular-nums">{formatTaka(account.balance)}</div>
            <div className="flex items-center gap-1 border-t pt-2">
              <EditFundSourceDialog account={account} />
              <SetBalanceDialog account={account} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
