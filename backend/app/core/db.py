from contextlib import contextmanager
from typing import Iterator

import psycopg


@contextmanager
def get_conn(db_url: str) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(db_url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_url: str) -> None:
    with get_conn(db_url) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS otp_secrets (
              username TEXT PRIMARY KEY,
              secret TEXT NOT NULL,
              enabled BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
              id BIGSERIAL PRIMARY KEY,
              actor TEXT NOT NULL,
              actor_role TEXT NOT NULL,
              action TEXT NOT NULL,
              target TEXT NOT NULL,
              result TEXT NOT NULL,
              ip TEXT NOT NULL,
              ua TEXT NOT NULL,
              detail TEXT,
              before_json JSONB,
              after_json JSONB,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        conn.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS before_json JSONB")
        conn.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS after_json JSONB")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sms_codes (
              id BIGSERIAL PRIMARY KEY,
              username TEXT NOT NULL,
              phone TEXT NOT NULL,
              scene TEXT NOT NULL,
              code TEXT NOT NULL,
              sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ,
              send_status TEXT NOT NULL DEFAULT 'pending',
              send_attempts INT NOT NULL DEFAULT 0,
              last_error TEXT
            );
            """
        )
        conn.execute("ALTER TABLE sms_codes ADD COLUMN IF NOT EXISTS send_status TEXT NOT NULL DEFAULT 'pending'")
        conn.execute("ALTER TABLE sms_codes ADD COLUMN IF NOT EXISTS send_attempts INT NOT NULL DEFAULT 0")
        conn.execute("ALTER TABLE sms_codes ADD COLUMN IF NOT EXISTS last_error TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_expiry_notifies (
              id BIGSERIAL PRIMARY KEY,
              username TEXT NOT NULL,
              days_left INT NOT NULL,
              notify_date DATE NOT NULL,
              status TEXT NOT NULL,
              last_error TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS email_codes (
              id BIGSERIAL PRIMARY KEY,
              username TEXT NOT NULL,
              email TEXT NOT NULL,
              scene TEXT NOT NULL,
              code TEXT NOT NULL,
              sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login_attempts (
              username TEXT PRIMARY KEY,
              fail_count INT NOT NULL DEFAULT 0,
              locked_until TIMESTAMPTZ
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS system_config (
              key TEXT PRIMARY KEY,
              value_json JSONB NOT NULL,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS system_config_history (
              id BIGSERIAL PRIMARY KEY,
              key TEXT NOT NULL,
              value_json JSONB NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_otp_sessions (
              username TEXT PRIMARY KEY,
              verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL
            );
            """
        )
