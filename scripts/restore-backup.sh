#!/usr/bin/env bash
# Restore the weekly Soupresso database backup into a NEW, EMPTY database.
#
# Self-contained: keep this file in the same folder as the backup and its passphrase file
# (the Google Drive folder "Soupresso-Backups" has all three):
#     soupresso-latest.dump.gpg   the encrypted backup (replaced every Saturday)
#     restore.config              BACKUP_PASSPHRASE=...   (plain text, kept in your private Drive)
#     restore-backup.sh           this file
#
# Run it from that folder:
#     bash restore-backup.sh            -> finds the backup, decrypts, verifies, then asks for the new database's
#                                          connection string and restores into it
#     bash restore-backup.sh check      -> only decrypt + verify, restore nothing
# (You can also pass the connection string directly:  bash restore-backup.sh 'postgresql://…'  )
#
# Safety: it refuses any database that already has tables, so it can never overwrite your live database.
# Needs gnupg and the PostgreSQL 18 client tools (offers to install them with Homebrew).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

ARG="${1:-}"
CHECK_ONLY=0; TARGET=""
if [ "$ARG" = "check" ]; then CHECK_ONLY=1; else TARGET="$ARG"; fi

# ---- tools -------------------------------------------------------------------
find_pg18() {
  for d in /opt/homebrew/opt/postgresql@18/bin /usr/local/opt/postgresql@18/bin /usr/lib/postgresql/18/bin; do
    [ -x "$d/pg_restore" ] && { echo "$d"; return; }
  done
}
install_with_brew() { # install_with_brew <formula>
  command -v brew >/dev/null 2>&1 || die "Homebrew isn't installed, so I can't install $1 for you. Install it from https://brew.sh and run this again."
  read -r -p "Install $1 with Homebrew now? [y/N] " a
  [ "$a" = "y" ] || [ "$a" = "Y" ] || die "Cannot continue without $1."
  brew install "$1"
}
command -v gpg >/dev/null 2>&1 || { echo "gpg is missing (needed to decrypt)."; install_with_brew gnupg; }
PGBIN="$(find_pg18)"
if [ -z "$PGBIN" ]; then echo "PostgreSQL 18 client tools are missing (Neon runs 18; older tools can't read the backup)."; install_with_brew postgresql@18; PGBIN="$(find_pg18)"; fi
[ -n "$PGBIN" ] || die "PostgreSQL 18 client tools still not found."

TMP="$(mktemp -d)"
cleanup() { [ -d "$TMP" ] && { find "$TMP" -type f -exec rm -f {} + 2>/dev/null; rm -rf "$TMP"; }; }
trap cleanup EXIT

# ---- find the backup + passphrase in this folder -------------------------------
FILE="$(ls -t "$HERE"/*.dump.gpg 2>/dev/null | head -1 || true)"
[ -n "$FILE" ] || die "No backup (*.dump.gpg) found in $HERE. Put this script in the same folder as the backup."
say "Backup file: $(basename "$FILE")  ($(du -h "$FILE" | cut -f1), saved $(date -r "$FILE" '+%d %b %Y' 2>/dev/null || echo 'unknown date'))"

PASS="${BACKUP_PASSPHRASE:-}"
if [ -z "$PASS" ] && [ -f "$HERE/restore.config" ]; then PASS="$(sed -n 's/^BACKUP_PASSPHRASE=//p' "$HERE/restore.config" | head -1)"; fi
if [ -z "$PASS" ]; then read -r -s -p "restore.config not found. Backup passphrase: " PASS; echo; fi

# ---- decrypt + verify ----------------------------------------------------------
say "Decrypting…"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --output "$TMP/backup.dump" --decrypt "$FILE" 3<<<"$PASS" \
  || die "Could not decrypt. The passphrase in restore.config doesn't match this backup (or the file is damaged)."
"$PGBIN/pg_restore" --list "$TMP/backup.dump" > "$TMP/contents.txt" || die "Decrypted, but it is not a valid PostgreSQL backup."
for t in daily_entries bazar_plan_items cash_in_hand_ledger investments; do
  grep -Eq "TABLE DATA public $t( |$)" "$TMP/contents.txt" || die "Backup is missing table: $t"
done
say "✓ Backup is valid: $(grep -c 'TABLE DATA' "$TMP/contents.txt") tables, $(du -h "$TMP/backup.dump" | cut -f1) decrypted."
[ "$CHECK_ONLY" = "1" ] && { echo "Check only — nothing was restored."; exit 0; }

# ---- restore into the new database ---------------------------------------------
if [ -z "$TARGET" ]; then
  echo
  echo "Now the NEW, EMPTY database to restore into (a new Neon database or project — NOT your live one; a Neon branch is not empty)."
  read -r -p "Connection string: " TARGET
fi
[ -n "$TARGET" ] || die "No connection string given."
EXISTING="$("$PGBIN/psql" "$TARGET" -Atc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null)" \
  || die "Could not connect with that connection string. Check it and try again."
[ "$EXISTING" = "0" ] || die "That database already has $EXISTING tables — it looks like it is in use (maybe your live one). Create a new empty Neon database (or project) and use its connection string."

say "Restoring…"
"$PGBIN/pg_restore" --no-owner --no-privileges --dbname "$TARGET" "$TMP/backup.dump" || die "pg_restore reported errors (see above)."

say "✓ Restored. Quick look at the data:"
"$PGBIN/psql" "$TARGET" -At -F ' | ' -c "
 select 'daily entries', count(*)::text || ' (latest ' || max(entry_date)::text || ')' from daily_entries
 union all select 'bazar lines', count(*)::text from bazar_plan_items
 union all select 'investments', count(*)::text from investments
 union all select 'cash in hand (latest closing)', coalesce((select closing_balance::text from cash_in_hand_ledger order by entry_date desc limit 1),'-')"
echo
echo "To use it: set DATABASE_URL in Vercel to this database and redeploy."
