# ERP/POS System — Home Appliances Spare Parts
نظام إدارة المبيعات والمستودع لقطع غيار الأجهزة المنزلية

A full-stack Enterprise ERP/POS & Warehouse system built with **NestJS + PostgreSQL + Next.js 14**.

---

## Features

- **POS Terminal** — barcode scanner, cart, thermal receipt printing (80mm), shift management
- **Inventory Control** — multi-branch stock levels, movements ledger, low-stock alerts
- **Purchases** — supplier invoices, automatic stock increase, supplier balance tracking
- **Stock Transfers** — branch↔warehouse workflow (PENDING → APPROVED → IN_TRANSIT → COMPLETED)
- **Sales Reports** — revenue, profit, top products, Excel export
- **User Management** — roles (Admin / Cashier / Warehouse / Branch Manager), branch assignment
- **Categories & Brands** — product catalog management
- **Shift Management** — open/close shifts, cash reconciliation
- **Arabic RTL UI** — full bilingual support (Arabic primary, English secondary)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10, pg (node-postgres), bcrypt, JWT, Passport |
| Frontend | Next.js 14 (App Router), Zustand, React Query, Tailwind CSS, Recharts |
| Database | PostgreSQL 16 |
| Schema Reference | Prisma (schema only — pg driver used at runtime) |
| Auth | JWT access tokens + rotating refresh tokens, account lockout |

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- PostgreSQL 16
- npm 9+

### 1 — Database setup

```bash
# Create database and user
psql -U postgres << SQL
CREATE ROLE erp_user WITH LOGIN PASSWORD 'erp_password_dev';
CREATE DATABASE erp_pos OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE erp_pos TO erp_user;
SQL

# Run schema + seed
psql -h 127.0.0.1 -U erp_user -d erp_pos -f scripts/init.sql
```

### 2 — Backend

```bash
cd backend
cp .env.example .env          # edit DATABASE_URL and JWT secrets
npm install
npm run build
node dist/main.js             # production
# OR
npm run start:dev             # dev mode with watch
```

Backend runs at **http://localhost:3001/api**  
Swagger docs at **http://localhost:3001/api/docs**

### 3 — Frontend

```bash
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL if needed
npm install
npm run dev                   # dev  → http://localhost:3000
# OR
npm run build && npm start    # production
```

### Default credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `Admin@1234` |

> ⚠️ Change the admin password immediately after first login.

---

## Project Structure

```
erp-pos/
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── database/          ← pg Pool service
│   │   ├── common/            ← decorators, guards
│   │   └── modules/
│   │       ├── auth/
│   │       ├── products/
│   │       ├── inventory/
│   │       ├── sales/
│   │       ├── purchases/
│   │       ├── transfers/
│   │       ├── shifts/
│   │       ├── reports/
│   │       ├── users/
│   │       ├── categories/
│   │       ├── notifications/
│   │       └── health/
│   ├── prisma/schema.prisma   ← reference schema (not used at runtime)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/               ← Next.js App Router pages
│   │   ├── components/        ← Sidebar, Header, AppLayout
│   │   ├── lib/               ← API client, utils
│   │   └── store/             ← Zustand (auth, cart)
│   └── package.json
├── scripts/
│   ├── init.sql               ← Full schema + seed data
│   ├── backup.sh
│   └── restore.sh
└── docker-compose.yml
```

---

## API Modules

| Module | Base Route | Key Endpoints |
|---|---|---|
| Auth | `/api/v1/auth` | login, refresh, profile, change-password |
| Products | `/api/v1/products` | CRUD, barcode lookup, Excel import/export, low-stock |
| Inventory | `/api/v1/inventory` | stock, movements, adjust, count |
| Sales | `/api/v1/sales` | create, list, daily-summary, refund |
| Purchases | `/api/v1/purchases` | invoices, suppliers CRUD, report |
| Transfers | `/api/v1/transfers` | create, status workflow |
| Shifts | `/api/v1/shifts` | open, close, active, report |
| Reports | `/api/v1/reports` | dashboard, sales, profit, Excel export |
| Users | `/api/v1/users` | CRUD, branches, reset-password, audit-logs |
| Categories | `/api/v1/categories` | categories + brands CRUD |
| Notifications | `/api/v1/notifications` | list, unread-count, mark-read |
| Health | `/api/health` | database connectivity check |

---

## Docker (optional)

```bash
docker compose up -d          # starts postgres + backend + frontend
docker compose down
docker compose logs -f backend
```

---

## Roles & Permissions

| Role | Access |
|---|---|
| ADMIN | Everything |
| BRANCH_MANAGER | Sales, inventory, products, purchases, transfers, reports, users (read) |
| CASHIER | POS, shifts, dashboard |
| WAREHOUSE | Inventory, transfers, purchases |

---

## License
MIT
