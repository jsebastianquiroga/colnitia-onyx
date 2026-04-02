#!/usr/bin/env python3
"""Migrate users from Open-WebUI (colnitio_gpt) to Onyx (colnitia-onyx).

Reads from source `user` + `auth` tables and inserts into target `user` table.
Safe to run multiple times (idempotent via ON CONFLICT DO NOTHING on email).

Environment variables:
    SOURCE_DATABASE_URL  Open-WebUI Postgres connection string
    TARGET_DATABASE_URL  Onyx Postgres connection string

Usage:
    # Dry run (default) — shows what would be migrated
    python migrate_users.py

    # Actually write to target database
    python migrate_users.py --execute
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
import sqlite3
import psycopg2  # type: ignore
import psycopg2.extras  # type: ignore

ROLE_MAP: dict[str, tuple[str, bool]] = {
    # source_role -> (target_role, is_superuser)
    "admin": ("ADMIN", True),
    "user": ("BASIC", False),
    "pending": ("LIMITED", False),
}

SOURCE_QUERY = """
SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    a.password AS hashed_password,
    a.active AS is_active
FROM "user" u
JOIN auth a ON a.id = u.id
ORDER BY u.email;
"""

INSERT_QUERY = """
INSERT INTO "user" (id, email, hashed_password, is_active, is_superuser, is_verified, role)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (email) DO NOTHING;
"""


def table_exists(conn, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s);",
            (table_name,),
        )
        return cur.fetchone()[0]


def fetch_source_users(source_url: str) -> list[dict]:
    if source_url.startswith("postgresql://"):
        conn = psycopg2.connect(source_url)
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(SOURCE_QUERY)
                return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()
    else:
        # Assume SQLite file path
        if not os.path.exists(source_url):
            raise FileNotFoundError(f"SQLite database not found at {source_url}")
        
        conn = sqlite3.connect(source_url)
        conn.row_factory = sqlite3.Row
        try:
            cur = conn.cursor()
            cur.execute(SOURCE_QUERY)
            return [dict(row) for row in cur.fetchall()]
        finally:
            conn.close()


def migrate(source_url: str, target_url: str, *, execute: bool = False) -> None:
    # --- Fetch source users ---
    users = fetch_source_users(source_url)
    print(f"Source: {len(users)} users found")

    if not users:
        print("Nothing to migrate.")
        return

    # --- Check target table ---
    target_conn = psycopg2.connect(target_url)
    try:
        if not table_exists(target_conn, "user"):
            print(
                'ERROR: Target "user" table does not exist. '
                "Run Onyx alembic migrations first (start api_server once).",
                file=sys.stderr,
            )
            sys.exit(1)

        migrated = 0
        skipped = 0

        for u in users:
            target_role, is_superuser = ROLE_MAP.get(u["role"], ("basic", False))

            # Ensure a valid UUID for the target id
            try:
                user_id = uuid.UUID(u["id"])
            except (ValueError, TypeError):
                user_id = uuid.uuid4()

            params = (
                str(user_id),
                u["email"],
                u["hashed_password"],
                bool(u["is_active"]),
                is_superuser,
                True,  # is_verified
                target_role,
            )

            if execute:
                with target_conn.cursor() as cur:
                    cur.execute(INSERT_QUERY, params)
                    if cur.rowcount == 1:
                        migrated += 1
                    else:
                        skipped += 1
            else:
                src_role = u["role"]
                print(
                    f"  [DRY-RUN] {u['email']:<40} "
                    f"{src_role:>8} -> {target_role:<8} "
                    f"superuser={is_superuser} active={u['is_active']}"
                )
                migrated += 1

        if execute:
            target_conn.commit()
            print(f"Migrated: {migrated}, Skipped (duplicates): {skipped}")
        else:
            print(f"\nDry run complete. {migrated} users would be migrated.")
            print("Re-run with --execute to apply.")
    finally:
        target_conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate users from Open-WebUI to Onyx.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually write to the target database (default is dry-run)",
    )
    parser.add_argument(
        "--source-url",
        default=os.environ.get("SOURCE_DATABASE_URL"),
        help="Source (Open-WebUI) Postgres URL or SQLite file path [env: SOURCE_DATABASE_URL]",
    )
    parser.add_argument(
        "--target-url",
        default=os.environ.get("TARGET_DATABASE_URL"),
        help="Target (Onyx) Postgres URL [env: TARGET_DATABASE_URL]",
    )
    args = parser.parse_args()

    if not args.source_url:
        parser.error("SOURCE_DATABASE_URL env var or --source-url required")
    if not args.target_url:
        parser.error("TARGET_DATABASE_URL env var or --target-url required")

    migrate(args.source_url, args.target_url, execute=args.execute)


if __name__ == "__main__":
    main()
