# Soupresso database backup — how to restore

This folder is a complete, self-contained copy of the Soupresso database. Every **Saturday 10:00 AM (Dhaka)** the backup file is
replaced with a fresh one. Nothing else is needed to restore.

| File | What it is |
|---|---|
| `soupresso-latest.dump.gpg` | The database backup (encrypted). Replaced every Saturday. |
| `restore.config` | The passphrase that opens the backup (`BACKUP_PASSPHRASE=...`). Plain text — keep this folder private. |
| `restore-backup.sh` | The restore program. |
| `README.md` | This file. |

## Restore in 3 steps

**1. Download this whole folder** from Google Drive to your computer (keep all files together in one folder).

**2. Make a new, EMPTY database to restore into.** Never use the live one — the program refuses it anyway.
In the Neon console (https://console.neon.tech):
- Open your project → **Branches** → your main branch → **Roles & Databases** → **Add database** (name it e.g. `restore_test`), **or**
- create a brand-new **Project** (starts empty — best if the live project is lost or broken).

Then click **Connect**, pick that database and copy its **connection string** (turn *Connection pooling* **off**).
It starts with `postgresql://`.

> Don't use a Neon *branch* as the target: a branch is a copy of its parent and already contains data, so it is not empty.

**3. Run the program.** Open **Terminal**, go into the folder, and run it:

```
cd ~/Downloads/Soupresso-Backups
bash restore-backup.sh
```

It finds the backup, opens it with the passphrase in `restore.config`, checks it, then asks:
`Connection string:` — paste the string from step 2 and press Enter. When it finishes it prints a quick summary
(number of daily entries, latest date, cash in hand).

Want to only test that the backup is good, without restoring? Run `bash restore-backup.sh check`.

## After restoring (only if you are replacing the live database)
In Vercel → your project → **Settings → Environment Variables**, change `DATABASE_URL` to the new database's connection string
(and `DATABASE_URL_UNPOOLED` if you use it), then **redeploy**. Check the app (recent daily entries and Cash in Hand) before relying on it.

## If something goes wrong
| You see | What it means |
|---|---|
| `Could not decrypt` | The passphrase in `restore.config` is not the one the backup was made with (it was changed after this backup). |
| `That database already has N tables` | The target isn't empty. Use a new empty database or a new project. |
| `Could not connect` | The connection string is wrong, or pooling is on. Copy it again with pooling **off**. |
| `gpg is missing` / `PostgreSQL 18 client tools are missing` | Say **y** when it offers to install them with Homebrew (Mac). Install Homebrew first from https://brew.sh if needed. |
| `No backup (*.dump.gpg) found` | Run the program from inside the folder, with the backup file next to it. |

## Good to know
- The backup is encrypted, but `restore.config` sits next to it, so anyone who can open this folder can read the data. Keep the folder private.
- Only the newest backup is kept here (it is replaced each Saturday). The GitHub Actions page also keeps the last ~9 days.
- Questions or problems: the full technical notes are in the project repo, `docs/BACKUP_RESTORE.md`.
