"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createEntryAction, type ActionState } from "@/app/entries/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTRY_FORM_CATEGORIES,
  CATEGORIES_REQUIRING_PARTNER,
  CATEGORY_REQUIRES_MANUAL_ACCOUNTS,
  isPaymentMethodAllowed,
  PAYMENT_METHOD_LABELS,
  CATEGORY_LABELS,
  type EntryCategoryValue,
  type PaymentMethodValue,
} from "@/lib/entry-meta";

interface PartnerOption {
  id: string;
  name: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface FundSourceOption {
  id: string;
  name: string;
}

const initialState: ActionState = { success: false, message: "" };

const PAYMENT_METHODS: PaymentMethodValue[] = ["FUND_SOURCE", "CREDIT"];

const CATEGORY_GROUPS = Array.from(new Set(ENTRY_FORM_CATEGORIES.map((c) => c.group)));

export function EntryForm({
  partners,
  accounts,
  fundSources,
}: {
  partners: PartnerOption[];
  accounts: AccountOption[];
  fundSources: FundSourceOption[];
}) {
  const [state, formAction, pending] = useActionState(createEntryAction, initialState);
  const [category, setCategory] = useState<EntryCategoryValue>("RAW_MATERIAL");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("FUND_SOURCE");
  const [formKey, setFormKey] = useState(0);

  const needsPartner = CATEGORIES_REQUIRING_PARTNER.includes(category);
  const needsManualAccounts = category === CATEGORY_REQUIRES_MANUAL_ACCOUNTS;
  const needsFundSource = paymentMethod === "FUND_SOURCE";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const partnerLabels = useMemo(() => Object.fromEntries(partners.map((p) => [p.id, p.name])), [partners]);
  const accountLabels = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, `${a.code} — ${a.name}`])),
    [accounts],
  );
  const fundSourceLabels = useMemo(() => Object.fromEntries(fundSources.map((f) => [f.id, f.name])), [fundSources]);

  useEffect(() => {
    if (!isPaymentMethodAllowed(category, paymentMethod)) {
      setPaymentMethod("FUND_SOURCE");
    }
  }, [category, paymentMethod]);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setFormKey((k) => k + 1);
        setCategory("RAW_MATERIAL");
        setPaymentMethod("FUND_SOURCE");
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  return (
    <form key={formKey} action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Select name="category" value={category} onValueChange={(v) => v && setCategory(v as EntryCategoryValue)}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue>{(value: string | null) => (value ? CATEGORY_LABELS[value] : "Select category")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_GROUPS.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {ENTRY_FORM_CATEGORIES.filter((c) => c.group === group).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="e.g. Onions, chicken, spices from Karwan Bazar" required rows={2} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="amount">Amount (৳)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="quantity">Quantity (optional)</Label>
          <Input id="quantity" name="quantity" type="number" step="0.01" placeholder="e.g. 5" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unit">Unit (optional)</Label>
          <Input id="unit" name="unit" placeholder="kg, pcs, litre..." />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="vendor">Vendor / Payee (optional)</Label>
          <Input id="vendor" name="vendor" placeholder="e.g. Karwan Bazar vendor" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paymentMethod">Payment Method</Label>
          <Select name="paymentMethod" value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v as PaymentMethodValue)}>
            <SelectTrigger id="paymentMethod" className="w-full">
              <SelectValue>{(value: string | null) => (value ? PAYMENT_METHOD_LABELS[value] : "Select payment method")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.filter((pm) => isPaymentMethodAllowed(category, pm)).map((pm) => (
                <SelectItem key={pm} value={pm}>
                  {PAYMENT_METHOD_LABELS[pm]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsFundSource && (
        <div className="grid gap-1.5">
          <Label htmlFor="fundSourceAccountId">Cash / Bank Account</Label>
          <Select name="fundSourceAccountId" required>
            <SelectTrigger id="fundSourceAccountId" className="w-full">
              <SelectValue>{(value: string | null) => (value ? fundSourceLabels[value] : "Select account")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {fundSources.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fundSources.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No cash/bank accounts yet — add one on the Cash &amp; Bank page.
            </p>
          )}
        </div>
      )}

      {needsPartner && (
        <div className="grid gap-1.5">
          <Label htmlFor="partnerId">Partner</Label>
          <Select name="partnerId" required>
            <SelectTrigger id="partnerId" className="w-full">
              <SelectValue>{(value: string | null) => (value ? partnerLabels[value] : "Select partner")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {needsManualAccounts && (
        <div className="grid gap-4 rounded-md border border-dashed p-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="manualDebitAccountId">Debit Account</Label>
            <Select name="manualDebitAccountId" required>
              <SelectTrigger id="manualDebitAccountId" className="w-full">
                <SelectValue>{(value: string | null) => (value ? accountLabels[value] : "Select account")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="manualCreditAccountId">Credit Account</Label>
            <Select name="manualCreditAccountId" required>
              <SelectTrigger id="manualCreditAccountId" className="w-full">
                <SelectValue>{(value: string | null) => (value ? accountLabels[value] : "Select account")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving..." : "Add Entry"}
      </Button>
    </form>
  );
}
