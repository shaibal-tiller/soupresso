#!/usr/bin/env bash
# One-command helper for the weekly encrypted Neon backup (see docs/BACKUP_RESTORE.md).
#
#   scripts/restore-backup.sh setup                  save the backup passphrase once (here + in the Drive folder)
#   scripts/restore-backup.sh check                  download the latest backup from Drive, decrypt, verify, show contents
#   scripts/restore-backup.sh restore <NEW_DB_URL>   same, then load it into a NEW EMPTY database (e.g. a fresh Neon branch)
#
# Options: --file path/to/backup.dump.gpg   use a local file instead of downloading from Drive
#          --force                          allow restoring into a database that already has tables (never the live one)
#
# Needs (installs missing ones with Homebrew if you say yes): gnupg, postgresql@18, rclone (Drive download only).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" # Homebrew tools even when the shell's PATH is minimal

FOLDER="gdrive:Soupresso-Backups"
CONF_LOCAL="$HOME/.soupresso-restore.conf"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-check}"; shift || true
TARGET=""; FILE=""; FORCE=0
if [ "$MODE" = "restore" ]; then TARGET="${1:-}"; shift || true; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---- tools -----------------------------------------------------------------
find_pg18() {
  for d in /opt/homebrew/opt/postgresql@18/bin /usr/local/opt/postgresql@18/bin /usr/lib/postgresql/18/bin; do
    [ -x "$d/pg_restore" ] && { echo "$d"; return; }
  done
}
ensure() { # ensure <command> <brew-formula>
  command -v "$1" >/dev/null 2>&1 && return
  command -v brew >/dev/null 2>&1 || die "'$1' is missing and Homebrew isn't installed. Install $2 and run this again."
  read -r -p "'$1' is missing. Install $2 with Homebrew now? [y/N] " a
  [ "$a" = "y" ] || [ "$a" = "Y" ] || die "Cannot continue without $1."
  brew install "$2"
}
ensure gpg gnupg
PGBIN="$(find_pg18)"
if [ -z "$PGBIN" ]; then ensure brew-pg18-check postgresql@18 2>/dev/null || true; PGBIN="$(find_pg18)"; fi
[ -n "$PGBIN" ] || die "PostgreSQL 18 client tools not found (brew install postgresql@18). Neon runs 18; older tools can't read the backup."

TMP="$(mktemp -d)"
cleanup() { [ -d "$TMP" ] && { find "$TMP" -type f -exec rm -f {} + 2>/dev/null; rm -rf "$TMP"; }; }
trap cleanup EXIT

drive() { command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q '^gdrive:'; }

# ---- setup: save the passphrase ------------------------------------------------
if [ "$MODE" = "setup" ]; then
  read -r -s -p "Backup passphrase (the BACKUP_PASSPHRASE secret in GitHub): " P; echo
  read -r -s -p "Type it again: " P2; echo
  [ "$P" = "$P2" ] && [ -n "$P" ] || die "Passphrases didn't match."
  umask 077
  printf 'BACKUP_PASSPHRASE=%s\n' "$P" > "$CONF_LOCAL"
  echo "Saved to $CONF_LOCAL (plain text, only you can read it)."
  if drive; then
    rclone copyto "$CONF_LOCAL" "$FOLDER/restore.config" && echo "Also saved to Google Drive: Soupresso-Backups/restore.config"
  else
    echo "(rclone/Drive not set up here, so it was not copied to Drive.)"
  fi
  exit 0
fi

[ "$MODE" = "check" ] || [ "$MODE" = "restore" ] || die "Use: setup | check | restore <NEW_DB_URL>"

# ---- get the backup file ----------------------------------------------------------
if [ -z "$FILE" ]; then
  drive || die "Google Drive isn't connected on this Mac (rclone remote 'gdrive'). Download the file by hand and use: --file ~/Downloads/soupresso-latest.dump.gpg"
  say "Downloading the latest backup from Google Drive…"
  rclone copyto "$FOLDER/soupresso-latest.dump.gpg" "$TMP/backup.gpg"
  FILE="$TMP/backup.gpg"
fi
[ -f "$FILE" ] || die "Backup file not found: $FILE"

# ---- passphrase: env -> local config -> Drive config -> ask --------------------------
PASS="${BACKUP_PASSPHRASE:-}"
if [ -z "$PASS" ] && [ -f "$CONF_LOCAL" ]; then PASS="$(sed -n 's/^BACKUP_PASSPHRASE=//p' "$CONF_LOCAL" | head -1)"; fi
if [ -z "$PASS" ] && drive && rclone copyto "$FOLDER/restore.config" "$TMP/restore.config" 2>/dev/null; then
  PASS="$(sed -n 's/^BACKUP_PASSPHRASE=//p' "$TMP/restore.config" | head -1)"
fi
if [ -z "$PASS" ]; then read -r -s -p "Backup passphrase: " PASS; echo; fi

# ---- decrypt + verify ------------------------------------------------------------
say "Decrypting…"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --output "$TMP/backup.dump" --decrypt "$FILE" 3<<<"$PASS" \
  || die "Could not decrypt. Wrong passphrase, or the file is damaged."
"$PGBIN/pg_restore" --list "$TMP/backup.dump" > "$TMP/contents.txt" || die "Decrypted, but it is not a valid PostgreSQL backup."
for t in daily_entries bazar_plan_items cash_in_hand_ledger investments; do
  grep -Eq "TABLE DATA public $t( |$)" "$TMP/contents.txt" || die "Backup is missing table: $t"
done
TABLES="$(grep -c 'TABLE DATA' "$TMP/contents.txt")"
SIZE="$(du -h "$TMP/backup.dump" | cut -f1)"
say "✓ Backup is valid: $TABLES tables, $SIZE (decrypted)."

if [ "$MODE" = "check" ]; then
  echo "Nothing was restored. To load it into a new, empty database:"
  echo "  scripts/restore-backup.sh restore '<connection string of a NEW Neon branch>'"
  exit 0
fi

# ---- restore ---------------------------------------------------------------------
[ -n "$TARGET" ] || die "Give the NEW database connection string: restore '<url>'"
host_of() { echo "$1" | sed -E 's#^[a-zA-Z]+://[^@]*@([^/:?]+).*#\1#; s#-pooler##'; }
if [ -f "$HERE/../.env.local" ]; then
  for k in DATABASE_URL DATABASE_URL_UNPOOLED; do
    LIVE="$(grep "^$k=" "$HERE/../.env.local" | head -1 | sed 's/^[^=]*=//; s/^"//; s/"$//')"
    [ -n "$LIVE" ] && [ "$(host_of "$LIVE")" = "$(host_of "$TARGET")" ] && die "That is your LIVE database. Restore into a NEW Neon branch or database instead."
  done
fi
EXISTING="$("$PGBIN/psql" "$TARGET" -Atc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null)" || die "Could not connect to the target database."
if [ "$EXISTING" != "0" ] && [ "$FORCE" != "1" ]; then die "Target already has $EXISTING tables. Use a new empty database (or --force if you are sure)."; fi
say "Restoring into $(host_of "$TARGET") …"
"$PGBIN/pg_restore" --no-owner --no-privileges --dbname "$TARGET" "$TMP/backup.dump" || die "pg_restore reported errors (see above)."

say "✓ Restored. Quick look at the data:"
"$PGBIN/psql" "$TARGET" -At -F ' | ' -c "
 select 'daily entries', count(*)::text || ' (latest ' || max(entry_date)::text || ')' from daily_entries
 union all select 'bazar lines', count(*)::text from bazar_plan_items
 union all select 'investments', count(*)::text from investments
 union all select 'cash in hand (latest closing)', coalesce((select closing_balance::text from cash_in_hand_ledger order by entry_date desc limit 1),'-')"
echo
echo "To use it: set DATABASE_URL in Vercel to this database and redeploy (see docs/BACKUP_RESTORE.md)."
