"use client";

import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACTOR_COOKIE } from "@/lib/actor-shared";
import { useLang } from "@/components/language-provider";

function readActorCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTOR_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeActorCookie(name: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${ACTOR_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

export function ActorBadge({ className }: { className?: string }) {
  const { t } = useLang();
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const current = readActorCookie();
    setName(current);
    setHydrated(true);
    if (!current) setOpen(true);
  }, []);

  function handleOpen() {
    setDraft(name ?? "");
    setOpen(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    writeActorCookie(trimmed);
    setName(trimmed);
    setOpen(false);
  }

  if (!hydrated) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className ?? "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"}
      >
        <UserCircle className="h-4 w-4" />
        {name ?? t("Set your name")}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{t("Who's using this device?")}</DialogTitle>
              <DialogDescription>
                {t("Your name is attached to every entry, edit, and deletion you make, so the audit log stays accountable.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="actorName">{t("Your Name")}</Label>
              <Input
                id="actorName"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("e.g. Rahim")}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">{t("Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
