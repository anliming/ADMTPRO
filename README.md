# ADMTPRO

AD domain management tool (BS architecture, separated frontend/backend) for self-service users and administrators.

## Features

- User login and self profile view (name/email/mobile)
- Self password change (old password + SMS code)
- Forgot password (SMS/email code)
- Admin login with OTP
- User management: CRUD / enable / disable / reset password / move OU
- Bulk actions: import/export, batch enable/disable/move
- Force change password at first login (create/reset)
- OU management: CRUD
- Audit logs for all DDL operations
- SMS log & retry (manual/auto)
- Password expiry reminders (SMS)
- In-app notifications (expiry records)
- Config center (system/LDAP/SMS/email/expiry + change history)
- Health checks (API/DB/LDAP)

## Tech Stack

- Backend: Python 3.12 + Flask
- Frontend: TypeScript + React + Vite
- Deployment: Docker Compose
- Dependencies: LDAP/LDAPS, PostgreSQL, Redis (optional)

## Structure

- `backend/` backend service
- `frontend/` frontend app
- `deploy/` nginx config
- `docker-compose.yml` local stack

## Quick Start

1) Copy env

```
cp .env.example .env
```

2) Fill LDAP/SMS/DB configs in `.env`

3) Start

```
docker compose up --build
```

4) Access

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api/health`

## Key Env Vars

- LDAP
  - `LDAP_URL` / `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` / `LDAP_BASE_DN` / `LDAP_CA_CERT`
- Admin group
  - `ADMIN_GROUP_DN`
- SMS (Aliyun)
  - `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`
  - `ALIYUN_SMS_SIGN_NAME`
  - `ALIYUN_SMS_TEMPLATE_RESET`
  - `ALIYUN_SMS_TEMPLATE_NOTIFY` (expiry template, param `{days}`)
- OTP
  - `OTP_ISSUER` / `OTP_WINDOW`
- SMS retry
  - `SMS_AUTO_RETRY` / `SMS_RETRY_INTERVAL`
- Password expiry reminder
  - `PASSWORD_EXPIRY_ENABLE`
  - `PASSWORD_EXPIRY_DAYS` (e.g. `7,3,1`)
  - `PASSWORD_EXPIRY_CHECK_INTERVAL`
- Session
  - `SESSION_TTL`
- Email (optional)
  - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM`
  - `SMTP_SSL` / `SMTP_TLS`
  - `EMAIL_RESET_SUBJECT` / `EMAIL_RESET_TEMPLATE`

## Notes

- Password expiry uses AD attribute `msDS-UserPasswordExpiryTimeComputed`.
- Dev mode returns `dev_code` for SMS/email flows.
- Config center supports email subject/template and keeps change history.
- Ensure SMS templates and signatures are approved in production.
- User search matches sAMAccountName / displayName / cn / mail / mobile (pinyin only if stored in those fields).
- Login failures trigger account lock based on configured thresholds.
- Audit logs support CSV export.

## API Summary

- Auth
  - `POST /api/auth/login`
  - `POST /api/auth/otp/setup`
  - `POST /api/auth/otp/verify`
- Self service
  - `GET /api/me`
  - `POST /api/me/password`
  - `POST /api/auth/forgot/reset`
  - `POST /api/auth/email/send`
  - `POST /api/auth/email/reset`
- SMS
  - `POST /api/auth/sms/send`
  - `POST /api/sms/retry`
  - `GET /api/sms/list`
- Password expiry
  - `GET /api/password-expiry/list`
  - `POST /api/password-expiry/trigger`
- Notifications
  - `GET /api/notifications`
- Config
  - `GET /api/config`
  - `PUT /api/config`
  - Saved config overrides runtime and can start SMS retry / expiry loops when enabled
  - `GET /api/config/history`
  - `POST /api/config/rollback`
- Health
  - `GET /api/health`
  - `GET /api/health/details`
- User/OU management
  - `GET /api/users` / `POST /api/users` / `PUT /api/users/:username`
  - `PATCH /api/users/:username/status` / `POST /api/users/:username/reset-password`
  - `DELETE /api/users/:username` / `POST /api/users/:username/move`
  - `GET /api/users/export` / `POST /api/users/import` / `POST /api/users/batch`
  - `GET /api/ous` / `POST /api/ous` / `PUT /api/ous` / `DELETE /api/ous`
- Audit
  - `GET /api/audit`
